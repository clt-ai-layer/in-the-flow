import os
import re
from datetime import datetime
from typing import List, Dict, Any
from sqlmodel import Session, select
from database import Task, Project, Setting, sync_task_to_record

PLANNING_DIR = r""

def get_active_planning_file() -> str:
    if not os.path.exists(PLANNING_DIR):
        raise FileNotFoundError(f"Planning directory not found at: {PLANNING_DIR}")
    
    files = os.listdir(PLANNING_DIR)
    current_planning_files = [f for f in files if f.startswith("Current_Planning_") and f.endswith(".md")]
    
    if not current_planning_files:
        raise FileNotFoundError("No active weekly planning file (prefixed with 'Current_Planning_') found.")
    
    # Sort just in case there are multiple, grab the latest alphabetically
    current_planning_files.sort()
    return os.path.join(PLANNING_DIR, current_planning_files[-1])

def parse_weekly_plan(file_path: str) -> List[Dict[str, Any]]:
    tasks = []
    
    # Regex to parse checklist line:
    # Matches: - [ ] Ⓑ **Task Name**: description
    # Group 1: status (space, /, x, X)
    # Group 2: owner (Ⓑ, 🅾️, 🤝)
    # Group 3: task title
    # Group 4: description/detail
    task_re = re.compile(r'^\s*-\s*\[([ xX/])\]\s*([Ⓑ🅾️🤝])\s*(?:🔁\s*)?\*\*(.*?)\*\*:?\s*(.*)$')
    
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    in_checklist = False
    current_category = "business" # default
    
    for line in lines:
        line_stripped = line.strip()
        
        # Check if we enter the checklist section
        if line_stripped.startswith("### Week:"):
            in_checklist = True
            continue
            
        # Check if we exit the checklist section
        if in_checklist and (line_stripped.startswith("---") or (line_stripped.startswith("#") and not line_stripped.startswith("####"))):
            in_checklist = False
            
        if not in_checklist:
            continue
            
        # Parse category headers
        if line_stripped.startswith("####"):
            header_text = line_stripped.lower()
            if "development" in header_text or "implementation" in header_text or "💻" in header_text:
                current_category = "dev"
            else:
                current_category = "business"
            continue
            
        # Parse task checkbox
        match = task_re.match(line_stripped)
        if match:
            status_char = match.group(1).lower()
            owner_char = match.group(2)
            title = match.group(3).strip()
            desc = match.group(4).strip()
            
            # Map status
            if status_char == 'x':
                status = "done"
            elif status_char == '/':
                status = "in_progress"
            else:
                status = "backlog"
                
            # Map owner prefix for description
            owner_text = "Shared"
            if owner_char == 'Ⓑ':
                owner_text = "Alice"
            elif owner_char == '🅾️':
                owner_text = "Bob"
                
            full_description = f"Owner: {owner_text} | {desc}" if desc else f"Owner: {owner_text}"
            
            tasks.append({
                "name": title,
                "description": full_description,
                "status": status,
                "category": current_category,
                "owner": owner_text
            })
            
    return tasks

def sync_weekly_plan(session: Session, force: bool = False) -> Dict[str, Any]:
    import hashlib
    import json
    
    file_path = get_active_planning_file()
    file_name = os.path.basename(file_path)
    
    # Read file and compute hash
    with open(file_path, "r", encoding="utf-8") as f:
        file_content = f.read()
        
    file_hash = hashlib.sha256(file_content.encode("utf-8")).hexdigest()
    
    # Fetch stored hash
    hash_setting = session.exec(
        select(Setting).where(Setting.key == "sync_active_file_hash")
    ).first()
    stored_data = json.loads(hash_setting.value) if (hash_setting and hash_setting.value) else {}
    
    if not force and stored_data.get("file_name") == file_name and stored_data.get("hash") == file_hash:
        return {
            "status": "skipped",
            "reason": "File content hash has not changed.",
            "file_parsed": file_name,
            "parser_mode": "skipped",
            "tasks_created": 0,
            "tasks_updated": 0,
            "tasks_archived": 0,
            "total_parsed": 0
        }
        
    parsed_tasks = parse_weekly_plan(file_path)
    
    # AI Fallback: If structured regex parsing yields no tasks, invoke Gemini
    is_ai_parsed = False
    if not parsed_tasks:
        print("Regex parsing returned 0 tasks. Invoking AI parsing fallback...")
        try:
            # Fetch API Key from settings
            api_key_setting = session.exec(
                select(Setting).where((Setting.key == "GEMINI_API_KEY") | (Setting.key == "gemini_api_key"))
            ).first()
            api_key = api_key_setting.value if api_key_setting else None
            
            from services.gemini_service import GeminiService
            gemini = GeminiService(api_key=api_key)
            ai_result = gemini.parse_weekly_plan_ai(file_content)
            parsed_tasks = ai_result.get("tasks", [])
            if parsed_tasks:
                is_ai_parsed = True
                print(f"AI parsing fallback successful. Extracted {len(parsed_tasks)} tasks.")
        except Exception as e:
            print(f"AI parsing fallback error: {e}")
            
    # Get all projects to perform matching
    projects = session.exec(select(Project)).all()
    project_map = {p.name.lower(): p.id for p in projects}
    
    def guess_project_id(title: str, desc: str, category: str) -> str:
        return next(iter(project_map.values()), None)
        
    def guess_task_grouping(title: str, desc: str, category: str) -> str:
        text = (title + " " + desc).lower()
        if category == "dev":
            if "chat" in text or "sse" in text or "pipeline" in text or "middleware" in text:
                return "AI"
            if "access" in text or "auth" in text or "orguser" in text or "invitation" in text:
                return "Access Control"
            if "dsm" in text or "enrich" in text:
                return "Backend"
            if "zod" in text or "validator" in text:
                return "Testing"
            return "AI"
        else:
            if "workflow" in text:
                return "DevOps"
            if "distribution" in text:
                return "Infrastructure"
            if "widget" in text:
                return "Frontend"
            if "demo" in text:
                return "Design"
            if "icp" in text:
                return "Documentation"
            if "linkedin" in text or "comment" in text or "post" in text:
                return "Documentation"
            if "agent" in text or "productivity" in text:
                return "DevOps"
            return "Documentation"
            
    created_count = 0
    updated_count = 0
    
    for task_data in parsed_tasks:
        # Check if task already exists
        existing_task = session.exec(
            select(Task).where(Task.name == task_data["name"], Task.source == "planning")
        ).first()
        
        project_id = guess_project_id(task_data["name"], task_data["description"], task_data["category"])
        owner = task_data.get("owner", "Alice")
        grouping = guess_task_grouping(task_data["name"], task_data["description"], task_data["category"])
        
        if existing_task:
            # Update fields if they changed
            existing_task.description = task_data["description"]
            existing_task.status = task_data["status"]
            existing_task.category = task_data["category"]
            existing_task.owner = owner
            existing_task.task_grouping = grouping
            if project_id:
                existing_task.project_id = project_id
            existing_task.updated_at = datetime.utcnow()
            session.add(existing_task)
            session.commit()
            
            # Sync to EAV DatabaseRecord
            try:
                sync_task_to_record(session, existing_task)
            except Exception as e:
                print(f"Error syncing task to dynamic record: {e}")
                
            updated_count += 1
        else:
            # Create new task
            new_task = Task(
                name=task_data["name"],
                description=task_data["description"],
                status=task_data["status"],
                category=task_data["category"],
                source="planning",
                project_id=project_id,
                owner=owner,
                task_grouping=grouping,
                archived=False
            )
            session.add(new_task)
            session.commit()
            session.refresh(new_task)
            
            # Sync to EAV DatabaseRecord
            try:
                sync_task_to_record(session, new_task)
            except Exception as e:
                print(f"Error syncing task to dynamic record: {e}")
                
            created_count += 1
            
    # Auto-archive done tasks completed in previous weeks
    parsed_names = {t["name"] for t in parsed_tasks}
    done_tasks = session.exec(
        select(Task).where(Task.source == "planning", Task.status == "done", Task.archived == False)
    ).all()
    
    archived_count = 0
    for dt in done_tasks:
        if dt.name not in parsed_names:
            dt.archived = True
            dt.updated_at = datetime.utcnow()
            session.add(dt)
            try:
                sync_task_to_record(session, dt)
            except Exception as e:
                print(f"Error syncing archived task to dynamic record: {e}")
            archived_count += 1
            
    session.commit()
    
    # Save hash settings
    if not hash_setting:
        hash_setting = Setting(key="sync_active_file_hash", value="")
    hash_setting.value = json.dumps({"file_name": file_name, "hash": file_hash})
    session.add(hash_setting)
    session.commit()
    
    return {
        "status": "success",
        "file_parsed": file_name,
        "parser_mode": "ai" if is_ai_parsed else "regex",
        "tasks_created": created_count,
        "tasks_updated": updated_count,
        "tasks_archived": archived_count,
        "total_parsed": len(parsed_tasks)
    }
