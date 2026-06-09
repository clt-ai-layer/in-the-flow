from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import glob
from database import Task, Project, Setting, get_session, AiLog
from services.gemini_service import GeminiService

router = APIRouter(prefix="/api/ai", tags=["AI Integration"])

# Helper to get GeminiService initialized with DB key
def get_gemini_service(session: Session = Depends(get_session)) -> GeminiService:
    api_key_setting = session.get(Setting, "gemini_api_key") or session.get(Setting, "GEMINI_API_KEY")
    api_key = api_key_setting.value if api_key_setting else None
    return GeminiService(api_key=api_key)

# Request schemas
class ClassifyRequest(BaseModel):
    name: str
    description: Optional[str] = None

class EnhanceRequest(BaseModel):
    name: str
    description_stub: Optional[str] = None

@router.post("/classify")
def auto_classify_task(
    req: ClassifyRequest, 
    session: Session = Depends(get_session),
    ai_service: GeminiService = Depends(get_gemini_service)
):
    projects = session.exec(select(Project)).all()
    project_names = [p.name for p in projects]
    
    result = ai_service.classify_task(req.name, req.description or "", project_names)
    
    # Audit log
    prompt_str = f"Classify task: {req.name}\nDescription: {req.description}"
    log = AiLog(action="classify_task", prompt=prompt_str, response=str(result), tokens_used=0)
    session.add(log)
    session.commit()
    
    # Try to map project name back to ID for UI convenience
    if result.get("project_name"):
        matched_project = next((p for p in projects if p.name == result["project_name"]), None)
        if matched_project:
            result["project_id"] = matched_project.id
            
    return result

@router.post("/weekly-plan")
def compile_weekly_plan(
    session: Session = Depends(get_session),
    ai_service: GeminiService = Depends(get_gemini_service)
):
    # Retrieve planning path
    path_setting = session.get(Setting, "planning_folder_path")
    planning_path = path_setting.value if path_setting else r""
    
    planning_context = ""
    
    # Scan files in directory
    if os.path.exists(planning_path):
        md_files = glob.glob(os.path.join(planning_path, "*.md"))
        for file_path in md_files:
            # Skip archive folder
            if "archive" in file_path.lower():
                continue
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    filename = os.path.basename(file_path)
                    planning_context += f"\n\n--- File: {filename} ---\n{content}"
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")
    else:
        # Fallback to loading whatever is available in target folder or stub
        planning_context = "No planning markdown files found."

    result = ai_service.compile_weekly_plan(planning_context)
    
    # Audit log
    log = AiLog(action="weekly_plan_compilation", prompt="Loaded planning folder md files", response=str(result), tokens_used=0)
    session.add(log)
    session.commit()
    
    return result

@router.post("/flow-analyzer")
def diagnose_flow_blockers(
    session: Session = Depends(get_session),
    ai_service: GeminiService = Depends(get_gemini_service)
):
    # Load all active tasks
    active_tasks = session.exec(select(Task).where(Task.status != "done")).all()
    tasks_data = []
    for t in active_tasks:
        tasks_data.append({
            "name": t.name,
            "status": t.status,
            "category": t.category,
            "estimated_duration": t.estimated_duration,
            "current_duration": t.current_duration
        })
        
    result = ai_service.diagnose_flow(tasks_data)
    
    # Audit log
    log = AiLog(action="flow_blocker_diagnosis", prompt=f"Analyzing {len(tasks_data)} tasks", response=str(result), tokens_used=0)
    session.add(log)
    session.commit()
    
    return result

@router.post("/enhance-ticket")
def enhance_ticket(
    req: EnhanceRequest,
    session: Session = Depends(get_session),
    ai_service: GeminiService = Depends(get_gemini_service)
):
    # Retrieve planning path
    path_setting = session.get(Setting, "planning_folder_path")
    planning_path = path_setting.value if path_setting else r""
    
    context_str = ""
    if os.path.exists(planning_path):
        md_files = glob.glob(os.path.join(planning_path, "*.md"))
        for file_path in md_files:
            filename = os.path.basename(file_path).lower()
            if "archive" in file_path.lower():
                continue
            if "mvp" in filename or "week" in filename or "planning" in filename:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        context_str += f"\n\n--- Context File: {os.path.basename(file_path)} ---\n{content}"
                except Exception as e:
                    print(f"Error reading context file {file_path}: {e}")

    result = ai_service.enhance_ticket(req.name, req.description_stub or "", context=context_str)
    
    # Audit log
    log = AiLog(action="ticket_description_enhancement", prompt=f"Enhance: {req.name}", response=str(result), tokens_used=0)
    session.add(log)
    session.commit()
    
    return result
