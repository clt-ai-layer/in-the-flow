# InTheFlow: AI Capabilities Specification

This document describes the prompt engineering, expected output structures, and Python SDK configuration for integration with the Google Gemini API using the **gemini-3.1-flash-lite** model.

---

## 1. Gemini Configuration & SDK Setup

The Python backend uses the official `google-generativeai` library. To minimize latency and cost, uvicorn interacts with the `gemini-3.1-flash-lite` model, using JSON-mode outputs where structured processing is needed.

### Initialization Code (`services/gemini_service.py`)
```python
import google.generativeai as genai
import os
import json
from typing import Optional, Dict, Any

class GeminiService:
    def __init__(self, api_key: Optional[str] = None):
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if key:
            genai.configure(api_key=key)
        self.model_name = "gemini-3.1-flash-lite"

    def generate_json_response(self, system_instruction: str, prompt: str) -> Dict[str, Any]:
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_instruction
        )
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            return {"error": "Failed to decode LLM response", "raw": response.text}
```

---

## 2. Prompt Specifications

### A. Task Classification & Estimation Pipeline
* **System Prompt**:
  ```
  You are an expert project manager. Analyze the provided task name and description. 
  Determine if the task is a Business task (Marketing, Legal, Strategy, Product design) or a Dev task (Coding, Testing, DevOps, Database, Schema validation).
  Classify the task into one of the known project names.
  Estimate the task completion duration in minutes.
  
  Known Projects:
   - Sample Project: Production DDD/CQRS TypeScript modular monolith.
  - StoryWeaver: Story variation and curriculum-based educational story generator.
  - Productivity & Agents: LinkedIn automation and coding agent productivity experiments.
  
  You must output a JSON object matching this schema:
  {
    "category": "business" | "dev",
     "project_name": "Sample Project" | "StoryWeaver" | "Productivity & Agents",
    "estimated_duration": integer,
    "confidence": float,
    "rationale": string
  }
  ```
* **User Prompt**:
  ```json
  {
    "name": "Check Legal requirements for stripe",
    "description": "Understand European payment compliance for launching SaaS"
  }
  ```

### B. Weekly Planning Compiler & Fallback Parser
Reads the markdown documents from the local workspace to compile a unified view of the week's goals. Additionally, it serves as a robust fallback mechanism during database sync (`sync_service.py`): if standard regex structural parsing fails to find tasks, the Gemini AI takes over to extract tasks from the markdown intelligently.
* **System Prompt**:
  ```
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
  ```
* **User Prompt**: Inject contents of `Current_Planning_May-18-to-25.md` and `MVP_Planning.md`.

### C. Flow Friction & Blocker Diagnostic
* **System Prompt**:
  ```
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
  ```

### D. Ticket Enhancer (Description Auto-Generation)
Auto-populates description markdown for quick-created tasks.
* **System Prompt**:
  ```
  You are an expert product analyst. Take the short task name and optional brief outline. 
  Auto-generate a professional, markdown-formatted ticket description matching Notion / Jira standards.
  Include sections: Description, Requirements, Preconditions, and Verification/Testing Steps.
  
  Output a JSON object matching this schema:
  {
    "enhanced_description_markdown": "Complete markdown string"
  }
  ```
