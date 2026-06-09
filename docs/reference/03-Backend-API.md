# InTheFlow — Backend API

> **Type**: Reference (live code truth)  
> **Base URL**: `http://localhost:8000`  
> **API prefix**: `/api`  
> **Last Updated**: 2026-05-25

## Backend implementations

| Stack | GET `/` version | Entry |
| ----- | --------------- | ----- |
| **backend-js** (Emmett) | `"version": "2.0.0"` | `backend-js/src/index.ts` |
| Python FastAPI (legacy) | No version marker | `backend/main.py` |

When health returns version **2.0.0**, the Emmett-backed Node service is running. Router paths and the `{ detail }` error format are unchanged for `api.js` compatibility.

## Root

| Method | Path | Response |
| ------ | ---- | -------- |
| GET | `/` | `{ status, app, version }` — backend-js returns `"version": "2.0.0"` |

## Router Summary

| Router | Prefix | Python file | backend-js module |
| ------ | ------ | ----------- | ----------------- |
| Tasks | `/api/tasks` | `backend/routers/tasks.py` | `backend-js/src/task/` |
| Daily Tasks | `/api/daily-tasks` | `backend/routers/daily_tasks.py` | `backend-js/src/dailyTask/` |
| Projects | `/api/projects` | `backend/routers/projects.py` | `backend-js/src/project/` |
| Settings | `/api/settings` | `backend/routers/settings.py` | `backend-js/src/settings/` |
| AI | `/api/ai` | `backend/routers/ai.py` | `backend-js/src/ai/` |
| Views | `/api/views` | `backend/routers/views.py` | `backend-js/src/views/` |

---

## Tasks (`/api/tasks`)

### GET `/api/tasks`

List tasks with optional filters.

| Query param | Type | Default | Description |
| ----------- | ---- | ------- | ----------- |
| `category` | string | — | Filter by `business` or `dev` |
| `status` | string | — | Filter by status |
| `project_id` | string | — | Filter by project |
| `search` | string | — | LIKE match on name or description |
| `include_archived` | bool | `false` | Include archived tasks |

**Response**: `Task[]`

### GET `/api/tasks/{task_id}`

**Response**: `Task`  
**Errors**: 404 if not found

### POST `/api/tasks`

Create task. Body: full `Task` model (id auto-generated).

**Response**: 201 + `Task`  
**Side effect**: `sync_task_to_record()`

### PUT `/api/tasks/{task_id}`

Full update. Excludes `id`, `created_at` from copy.

**Response**: `Task`  
**Side effect**: `sync_task_to_record()`

### DELETE `/api/tasks/{task_id}`

**Response**: `{ status, message }`  
**Side effects**: Deletes matching `DatabaseRecord`; deletes linked `DailyTask` rows

### POST `/api/tasks/bulk-sync`

Bulk update/create for planning integrations.

**Request body**:

```json
{
  "updates": [{ "id": "...", "name": "...", "status": "...", ... }],
  "creations": [{ "name": "...", "status": "backlog", "category": "business", ... }]
}
```

**Response**:

```json
{
  "status": "success",
  "tasks_updated": 0,
  "tasks_created": 0
}
```

- Updates validate status via `validate_task_status()` (422 on invalid)
- Creations set `source: "planning"` and default project to Sample Project

---

## Daily Tasks (`/api/daily-tasks`)

### GET `/api/daily-tasks`

**Requires one of two query modes:**

| Mode | Params | Purpose |
| ---- | ------ | ------- |
| Calendar range | `start_date` + `end_date` (both required) | Week fetch; optional `task_id` narrows within range |
| Task-scoped | `task_id` alone | All blocks for a parent task |

**Errors**:

- 400 if neither mode satisfied
- 400 if only one of `start_date`/`end_date` provided

**Response**: `DailyTaskResponse[]` ordered by date, start_time

```json
{
  "id": "uuid",
  "task_id": "uuid|null",
  "date": "YYYY-MM-DD",
  "start_time": "HH:mm",
  "end_time": "HH:mm",
  "title": "string|null",
  "created_at": "datetime",
  "updated_at": "datetime",
  "parent_task_name": "string|null",
  "parent_task_grouping": "string|null",
  "parent_project_id": "string|null",
  "parent_status": "string|null",
  "parent_archived": "bool|null"
}
```

Denormalized parent fields come from LEFT JOIN on `Task`.

### POST `/api/daily-tasks`

**Request body**:

```json
{
  "date": "YYYY-MM-DD",
  "start_time": "HH:mm",
  "end_time": "HH:mm",
  "title": "optional",
  "task_id": "optional uuid"
}
```

**Validation** (`validate_schedule`):

| Rule | Error |
| ---- | ----- |
| Date matches `^\d{4}-\d{2}-\d{2}$` | 422 |
| Times match `^\d{2}:\d{2}$` | 422 |
| Minutes divisible by 15 | 422 |
| `end_time > start_time` same day | 422 |
| Duration ≥ 15 minutes | 422 |
| `task_id` references existing task | 404 |

**Response**: 201 + `DailyTaskResponse`

### PATCH `/api/daily-tasks/{daily_task_id}`

Partial update. All fields optional. Re-validates full schedule after merge.

**Response**: `DailyTaskResponse`  
**Errors**: 404 not found, 422 validation

### DELETE `/api/daily-tasks/{daily_task_id}`

**Response**: `{ status, message }`

---

## Projects (`/api/projects`)

### GET `/api/projects`

**Response**: `Project[]`

### POST `/api/projects`

**Request body**: `Project` (name, description, color)

**Errors**: 400 if name already exists  
**Response**: 201 + `Project`

---

## Settings (`/api/settings`)

### GET `/api/settings`

**Response**: `Record<string, string>` — all key-value pairs

### POST `/api/settings`

Upsert settings. Body: `{ "key": "value", ... }`

**Response**:

```json
{
  "status": "success",
  "settings_updated": ["key1", "key2"]
}
```

### POST `/api/settings/sync-planning`

Trigger weekly plan markdown sync.

| Query param | Type | Default | Description |
| ----------- | ---- | ------- | ----------- |
| `force` | bool | `false` | Skip hash check |

**Response (success)**:

```json
{
  "status": "success",
  "file_parsed": "Current_Planning_2026-05-20.md",
  "parser_mode": "regex|ai",
  "tasks_created": 0,
  "tasks_updated": 0,
  "tasks_archived": 0,
  "total_parsed": 0
}
```

**Response (skipped)**:

```json
{
  "status": "skipped",
  "reason": "File content hash has not changed.",
  ...
}
```

**Errors**: 404 if planning file missing, 500 on sync failure

### Settings keys

| Key | Format | Purpose |
| --- | ------ | ------- |
| `gemini_api_key` | string | Google Gemini API key (also accepts legacy `GEMINI_API_KEY`) |
| `planning_folder_path` | string | Folder scanned by AI endpoints; default `""` (user-configurable) |
| `sync_active_file_hash` | JSON string | `{"file_name": "...", "hash": "sha256..."}` — dedup for weekly sync |
| `theme` | `light` \| `dark` | Persisted appearance preference |
| `task_grouping_colors` | JSON string | Map of grouping name → `#RRGGBB` hex overrides |

---

## AI (`/api/ai`)

All endpoints require Gemini key in settings or env for live responses. Without key, stub fallbacks apply (see [05-AI-Capabilities.md](05-AI-Capabilities.md)).

### POST `/api/ai/classify`

**Request**:

```json
{ "name": "Task title", "description": "optional" }
```

**Response**:

```json
{
  "category": "business|dev",
  "project_name": "Sample Project",
  "project_id": "uuid",
  "estimated_duration": 60,
  "confidence": 0.9,
  "rationale": "..."
}
```

**Side effect**: Creates `AiLog` entry (`action: classify_task`)

### POST `/api/ai/weekly-plan`

Scans planning folder markdown files (skips archive paths).

**Response**:

```json
{
  "week_summary": "...",
  "priorities": [{ "name", "category", "project" }],
  "suggested_calendar": [{ "day": "Monday", "tasks": ["..."] }]
}
```

**Side effect**: `AiLog` (`action: weekly_plan_compilation`)

### POST `/api/ai/flow-analyzer`

Analyzes all non-`done` tasks.

**Response**:

```json
{
  "friction_score": 0-100,
  "identified_blockers": [{ "task_name", "blocker_type", "description" }],
  "remediation_actions": ["..."],
  "split_recommendations": [{ "original_task", "sub_tasks": [] }]
}
```

**Side effect**: `AiLog` (`action: flow_blocker_diagnosis`)

### POST `/api/ai/enhance-ticket`

**Request**:

```json
{ "name": "Task title", "description_stub": "optional outline" }
```

**Response**:

```json
{ "enhanced_description_markdown": "### Description\n..." }
```

Loads planning context from files containing `mvp`, `week`, or `planning` in filename.

**Side effect**: `AiLog` (`action: ticket_description_enhancement`)

---

## Views (`/api/views`)

Dynamic EAV view management and query execution.

### GET `/api/views`

**Response**: Array of view metadata objects (id, database_id, database_name, name, layout_type, filters, sorts, grouping, visible_properties)

### GET `/api/views/{view_id}`

**Response**: View metadata + `properties` array from parent database schema

### POST `/api/views`

Create or update view. Body: config dict with optional `id` for upsert.

**Required for create**: `name`, `layout_type`  
**Defaults**: Binds to first `Database` if `database_id` omitted

**Response**: `{ status: "success", id: "uuid" }`

### POST `/api/views/{view_id}/update-config`

Update filters, sorts, grouping, visible_properties only.

### DELETE `/api/views/{view_id}`

**Response**: `{ status: "success" }`

### POST `/api/views/{view_id}/execute`

Runs `executeView()` (backend-js) / `QueryEngine.execute_view()` (Python).

**Response:** Query result — structure depends on view config.

When `grouping.group_by` is set and `grouping.subgroup_by` is null:

```json
{ "grouped": true, "group_by": "Status", "subgroup_by": null, "groups": { "backlog": [ {...} ] }, "records": [] }
```

When **both** are set (Sprint Board default in backend-js):

```json
{
  "grouped": true,
  "group_by": "Status",
  "subgroup_by": "TaskGrouping",
  "groups": {
    "backlog": {
      "AI": [ { "id": "...", "Name": "...", "TaskGrouping": "AI", "Status": "backlog", ... } ],
      "Backend": [ ... ]
    }
  },
  "records": []
}
```

EAV fields use **PascalCase** (`TaskGrouping`, not `task_grouping`). No fallback to `/api/tasks` when EAV is empty.

**Errors**: 404 view not found, 500 query failure

---

## Error Format

Unchanged across Python and backend-js — FastAPI-compatible:

```json
{ "detail": "Error message string" }
```

Frontend `api.js` throws `Error(detail)` on non-OK responses.
