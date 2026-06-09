import google.generativeai as genai
import os
import json
from typing import Optional, Dict, Any, List

class GeminiService:
    def __init__(self, api_key: Optional[str] = None):
        # Fallback to loading dotenv if key is not yet present in environment
        if not api_key and not os.environ.get("GEMINI_API_KEY"):
            from pathlib import Path
            from dotenv import load_dotenv
            service_dir = Path(__file__).resolve().parent
            load_dotenv(dotenv_path=service_dir.parent / ".env", override=True)
            load_dotenv(dotenv_path=service_dir.parent.parent / ".env", override=True)

        # Prefer provided key, fallback to env variable
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.is_configured = False
        
        if self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.is_configured = True
            except Exception as e:
                print(f"Error configuring Google Gemini: {e}")
        
        print(f"--- GeminiService INIT ---")
        print(f"Provided api_key arg: {api_key}")
        print(f"os.environ['GEMINI_API_KEY']: {os.environ.get('GEMINI_API_KEY')}")
        print(f"self.api_key: {self.api_key}")
        print(f"self.is_configured: {self.is_configured}")
        
        self.model_name = "gemini-3.1-flash-lite"

    def _generate_json(self, system_instruction: str, prompt: str) -> Dict[str, Any]:
        if not self.is_configured:
            return {"error": "Gemini API key is not configured. Please add it in Settings.", "is_stub": True}

        try:
            model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=system_instruction
            )
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"Gemini generation error: {e}")
            return {"error": str(e)}

    def classify_task(self, name: str, description: str, project_names: List[str]) -> Dict[str, Any]:
        system_instruction = f"""
        You are an expert project manager. Analyze the provided task name and description. 
        Determine if the task is a Business task (Marketing, Legal, Strategy, Product design) or a Dev task (Coding, Testing, DevOps, Database, Schema validation).
        Classify the task into one of the known project names.
        Estimate the task completion duration in minutes.
        
        Known Projects:
        {json.dumps(project_names, indent=2)}
        
        You must output a JSON object matching this schema:
        {{
          "category": "business" | "dev",
          "project_name": "Match one of the known project names exactly, or output null",
          "estimated_duration": integer,
          "confidence": float,
          "rationale": "Brief reasoning description"
        }}
        """
        
        prompt = json.dumps({"name": name, "description": description or ""})
        
        result = self._generate_json(system_instruction, prompt)
        
        # Stub fallback if not configured
        if result.get("is_stub"):
            is_dev = any(keyword in name.lower() or keyword in (description or '').lower() 
                         for keyword in ["code", "test", "api", "database", "zod", "middleware", "dev"])
            result = {
                "category": "dev" if is_dev else "business",
                "project_name": project_names[0] if project_names else "My Project",
                "estimated_duration": 60,
                "confidence": 0.5,
                "rationale": "Stub auto-classification (Gemini API key not configured)."
            }
        return result

    def compile_weekly_plan(self, planning_contents: str) -> Dict[str, Any]:
        system_instruction = """
        You are an executive project assistant. Read the provided markdown files summarizing the current week planning and MVP backlog. 
        Extract all active business and technical tasks. Compile a structured summary of priorities.
        Output a JSON object matching this schema:
        {
          "week_summary": "High-level summary of the week's strategic focus",
          "priorities": [
             {"name": "Task name", "category": "business" | "dev", "project": "Project name"}
          ],
          "suggested_calendar": [
             {
               "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Weekend",
               "tasks": ["Task name 1", "Task name 2"]
             }
          ]
        }
        """
        
        result = self._generate_json(system_instruction, planning_contents)
        
        # Stub fallback
        if result.get("is_stub"):
            result = {
                "week_summary": "Weekly plan overview (Stub - Gemini key not configured).",
                "priorities": [
                    {"name": "Complete AI integration", "category": "dev", "project": "My Project"}
                ],
                "suggested_calendar": [
                    {"day": "Monday", "tasks": ["Review task backlog"]},
                    {"day": "Wednesday", "tasks": ["Perform business validation checks"]}
                ]
            }
        return result

    def diagnose_flow(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        system_instruction = """
        You are a developer coach specializing in flow state optimization. 
        Analyze the log of active and stalled tasks. Identify tasks that are "On Hold", tasks whose "current_duration" exceeds "estimated_duration", and tasks with frequent status revisions.
        Provide a friction score (0 to 100), identify specific blockers, and suggest remediation (e.g. recommend splitting a large task, taking a break, or seeking specification reviews).
        
        Output a JSON object matching this schema:
        {
          "friction_score": integer,
          "identified_blockers": [
             {
               "task_name": "Task Name",
               "blocker_type": "estimation_exceeded" | "on_hold" | "unclear_spec",
               "description": "Brief description of the blocker"
             }
          ],
          "remediation_actions": ["Actionable step 1", "Actionable step 2"],
          "split_recommendations": [
             {
               "original_task": "Task Name",
               "sub_tasks": ["Sub-task 1", "Sub-task 2", "Sub-task 3"]
             }
          ]
        }
        """
        
        result = self._generate_json(system_instruction, json.dumps(tasks))
        
        # Stub fallback
        if result.get("is_stub"):
            # Simple manual scan for friction
            blockers = []
            remediations = []
            for t in tasks:
                est = t.get("estimated_duration") or 0
                cur = t.get("current_duration") or 0
                if t.get("status") == "on_hold":
                    blockers.append({
                        "task_name": t.get("name"),
                        "blocker_type": "on_hold",
                        "description": "Task is on hold."
                    })
                elif cur > est > 0:
                    blockers.append({
                        "task_name": t.get("name"),
                        "blocker_type": "estimation_exceeded",
                        "description": f"Spent {cur}m, estimated {est}m."
                    })
                    
            if blockers:
                remediations.append("Consider breaking down overdue tasks into smaller sub-tasks.")
                friction = min(30 + 15 * len(blockers), 100)
            else:
                remediations.append("All tasks running smoothly. Keep up the flow!")
                friction = 10
                
            result = {
                "friction_score": friction,
                "identified_blockers": blockers,
                "remediation_actions": remediations,
                "split_recommendations": [
                    {
                        "original_task": b["task_name"],
                        "sub_tasks": [f"Part 1: Research {b['task_name']}", f"Part 2: Implement {b['task_name']}"]
                    } for b in blockers if b["blocker_type"] == "estimation_exceeded"
                ]
            }
        return result

    def enhance_ticket(self, name: str, description_stub: str, context: Optional[str] = None) -> Dict[str, Any]:
        system_instruction = """
        You are an expert product analyst. Take the short task name, optional brief outline, and project planning context. 
        Auto-generate a professional, markdown-formatted ticket description matching Notion / Jira standards.
        Ensure the generated requirements, preconditions, and description align with the business context and technical architecture defined in the project description and context.
        Include sections: Description, Requirements, Preconditions, and Verification/Testing Steps.
        
        Output a JSON object matching this schema:
        {
          "enhanced_description_markdown": "Complete markdown string"
        }
        """
        
        prompt_data = {
            "name": name,
            "outline": description_stub or ""
        }
        if context:
            prompt_data["project_context"] = context
            
        prompt = json.dumps(prompt_data)
        result = self._generate_json(system_instruction, prompt)
        
        # Stub fallback
        if result.get("is_stub"):
            result = {
                "enhanced_description_markdown": f"""### Description
{description_stub or "No description provided."}

### Requirements
- Complete implementations for: {name}
- Secure verification parameters

### Preconditions
- Setup API endpoints or configurations

### Verification Steps
1. Verify feature matches core requirements
2. Run visual validation checks
"""
            }
        return result

    def parse_weekly_plan_ai(self, planning_contents: str) -> Dict[str, Any]:
        system_instruction = """
        You are a project manager. Read the provided markdown weekly plan.
        Locate the weekly priorities or task checklists (usually under the "### Week: ..." header).
        Extract all individual tasks and format them as a JSON list.
        
        For each task, extract:
        1. "name": The short, descriptive title of the task.
        2. "description": Detailed description, prepended with the owner name (e.g. "Owner: Alice | details").
        3. "status": Determine the status: "done" (if completed/marked checked like [x] or [X] or ✅), "in_progress" (if marked in progress like [/]), or "backlog" (if unchecked [ ]).
        4. "category": Either "dev" (for coding, testing, backend/frontend engineering) or "business" (for marketing, strategy, comment campaigns, operations, etc.).
        5. "owner": Either "Alice", "Bob", or "Shared" based on markers Ⓑ, 🅾️, 🤝.
        
        Output a JSON object matching this schema:
        {
          "tasks": [
             {
               "name": "string",
               "description": "string",
               "status": "backlog" | "in_progress" | "done",
               "category": "dev" | "business",
               "owner": "Alice" | "Bob" | "Shared"
             }
          ]
        }
        """
        
        result = self._generate_json(system_instruction, planning_contents)
        
        # Stub fallback (if Gemini API key is not configured, return empty list)
        if result.get("is_stub"):
            result = {"tasks": []}
            
        return result
