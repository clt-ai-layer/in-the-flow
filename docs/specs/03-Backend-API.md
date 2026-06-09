# InTheFlow: Backend API Specification

This document specifies the REST API endpoints exposed by the Python FastAPI server. The API runs on `http://localhost:8000` and serves JSON payloads.

---

## 1. Task Endpoints (`/api/tasks`)

### A. List Tasks
* **URL**: `GET /api/tasks`
* **Query Parameters**:
  * `category` (optional): `business` | `dev`
  * `status` (optional): `backlog` | `ready_to_start` | `in_progress` | `on_hold` | `done`
  * `project_id` (optional): Filter by project UUID.
  * `search` (optional): String match filter for task name or description.
  * `include_archived` (optional): Boolean. Defaults to `false`. When false, archived tasks are filtered out of the response to keep active boards clean.
* **Response (200 OK)**:
```json
[
  {
    "id": "e67417e0-94d7-493f-a65c-6b3a9d20c5b3",
    "name": "LinkedIn Commenting (Daily Strategy)",
    "description": "Engage on target engineering profiles",
    "status": "in_progress",
    "category": "business",
    "source": "planning",
    "estimated_duration": 30,
    "current_duration": 15,
    "project_id": "cce-api-uuid",
    "created_at": "2026-05-20T11:00:00Z",
    "updated_at": "2026-05-20T11:30:00Z"
  }
]
```

### B. Create Task
* **URL**: `POST /api/tasks`
* **Request Body**:
```json
{
  "name": "Add Advanced Payment Handling",
  "description": "Integration testing of 3D secure authentication",
  "status": "ready_to_start",
  "category": "business",
  "project_id": "cce-api-uuid",
  "estimated_duration": 120
}
```
* **Response (201 Created)**: Returns the complete created `Task` object including `id` and timestamps.

### C. Update Task
* **URL**: `PUT /api/tasks/{task_id}`
* **Request Body**:
```json
{
  "name": "Updated Task Name",
  "description": "Updated Description",
  "status": "in_progress",
  "category": "dev",
  "project_id": "cce-api-uuid",
  "estimated_duration": 60,
  "current_duration": 20
}
```
* **Response (200 OK)**: Returns the updated `Task` object.

### D. Delete Task
* **URL**: `DELETE /api/tasks/{task_id}`
* **Response (200 OK)**: `{"status": "success", "message": "Task deleted"}`

---

## 2. Project Endpoints (`/api/projects`)

### A. List Projects
* **URL**: `GET /api/projects`
* **Response (200 OK)**:
```json
[
  {
    "id": "cce-api-uuid",
    "name": "Sample Project",
    "description": "Production DDD/CQRS/Event Sourcing platform",
    "color": "#3B82F6",
    "created_at": "2026-05-20T08:00:00Z"
  }
]
```

### B. Create Project
* **URL**: `POST /api/projects`
* **Request Body**:
```json
{
  "name": "StoryWeaver",
  "description": "Interactive storytelling application",
  "color": "#10B981"
}
```
* **Response (201 Created)**: Returns the created `Project` object.

---

## 3. AI Endpoints (`/api/ai`)

### A. Auto-Classify Task
Runs the input task through `gemini-3.1-flash-lite` to predict the best project, category, and estimated duration.
* **URL**: `POST /api/ai/classify`
* **Request Body**:
```json
{
  "name": "Test website checkout from US VPN",
  "description": "Verify date localization and Stripe pricing display"
}
```
* **Response (200 OK)**:
```json
{
  "category": "dev",
  "project_id": "cce-api-uuid",
  "estimated_duration": 45,
  "confidence": 0.95,
  "rationale": "Testing site localization and stripe payments falls under dev category for the active Sample Project."
}
```

### B. Compile Weekly Plan
Scans planning markdown files under `Documentation/` (path defined in settings), parses tasks, and suggests a prioritized schedule.
* **URL**: `POST /api/ai/weekly-plan`
* **Response (200 OK)**:
```json
{
  "week_summary": "Active sprints on AI Chat API and Access Control API.",
  "suggested_agenda": [
    {
      "day": "Monday",
      "tasks": ["Review quality tests", "Figma Design for Workbench"]
    }
  ]
}
```

### C. Flow Blocker Analyzer
Analyzes task durations and status transitions to flags friction (e.g. tasks on hold, exceeded estimation) and suggests solutions.
* **URL**: `POST /api/ai/flow-analyzer`
* **Request Body**:
```json
{
  "recent_tasks": [
    {
      "name": "Zod Schema Validator",
      "estimated_duration": 30,
      "current_duration": 180,
      "status": "in_progress"
    }
  ]
}
```
* **Response (200 OK)**:
```json
{
  "friction_score": 75,
  "blockers": ["Zod Schema Validator has exceeded the estimated duration by 600%."],
  "remediation": "Recommend splitting the Zod schema validation into individual sub-tasks for ProductCategory and ProductInventory to avoid getting stuck in a single monolithic task."
}
```

### D. Enhance Ticket Description
Uses the `google.genai` SDK to convert a stub/brief description into a structured markdown description formatted with Requirements, Preconditions, and Verification Steps.
* **URL**: `POST /api/ai/enhance-ticket`
* **Request Body**:
```json
{
  "name": "Implement user authentication",
  "description_stub": "Use jwt token"
}
```
* **Response (200 OK)**:
```json
{
  "enhanced_description_markdown": "### Description\nImplement user authentication using JWT tokens...\n\n### Requirements\n- ..."
}
```

---

## 4. Settings Endpoints (`/api/settings`)

### A. Get Settings
* **URL**: `GET /api/settings`
* **Response (200 OK)**:
```json
{
  "gemini_api_key": "AIzaSy...",
  "planning_folder_path": ""
}
```

### B. Update Settings
* **URL**: `POST /api/settings`
* **Request Body**:
```json
{
  "gemini_api_key": "AIzaSy...",
  "planning_folder_path": ""
}
```
* **Response (200 OK)**: `{"status": "success", "settings_updated": ["gemini_api_key", "planning_folder_path"]}`

### C. Sync Weekly Planning
Triggers the system to read the current week's planning document and sync tasks into the database. Uses Gemini AI parsing as a fallback if structured regex parsing yields 0 tasks.
* **URL**: `POST /api/settings/sync-planning`
* **Query Parameters**:
  * `force` (optional): Boolean. Defaults to `false`. If `true`, bypasses the file hash check and forces a re-sync.
* **Response (200 OK)**:
```json
{
    "status": "success",
    "file_parsed": "Current_Planning_May-18-to-25.md",
    "parser_mode": "regex",
    "tasks_created": 5,
    "tasks_updated": 2,
    "tasks_archived": 1,
    "total_parsed": 8
}
```
