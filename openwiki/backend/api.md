# Backend: API Routes

## Overview

The HTTP API is mounted under `/api` by `backend-js/src/platform/app.ts`. The frontend talks to it exclusively through `frontend/src/api.js`.

The route families are:

- `/api/tasks`
- `/api/daily-tasks`
- `/api/projects`
- `/api/settings`
- `/api/ai`
- `/api/views`

All route handlers use `asyncHandler(...)`, and error responses are normalized into a FastAPI-like `{ detail }` payload.

## Common response conventions

- Success responses are JSON.
- Create routes usually return `201`.
- Delete routes usually return a small status object instead of the deleted record.
- Not-found and validation failures become structured error responses through the shared error middleware.

## Tasks: `/api/tasks`

File: `backend-js/src/task/api/routes.ts`

### GET `/api/tasks`

Query parameters:

- `category` — optional string
- `status` — optional string
- `project_id` — optional string
- `search` — optional string
- `include_archived` — optional bool-like string (`true`, `1`, `false`, missing)

The handler:

- loads the full `task_list` projection
- applies Mongo-style filtering via `filterReadModels(...)`
- applies a text search over `name` and `description`
- excludes archived tasks unless `include_archived` is truthy

Response: `TaskListDocument[]`

Representative shape:

```json
{
  "id": "uuid",
  "name": "Implement endpoint",
  "description": "...",
  "status": "backlog",
  "category": "business",
  "source": "user_created",
  "owner": "Alice",
  "task_grouping": "General",
  "archived": false,
  "estimated_duration": 60,
  "current_duration": 0,
  "project_id": "uuid|null",
  "created_at": "2026-05-25T12:00:00.000Z",
  "updated_at": "2026-05-25T12:00:00.000Z"
}
```

### GET `/api/tasks/:taskId`

- looks up the inline projection by stream name
- returns `404` with a `NotFoundError` if the task is missing

### POST `/api/tasks`

Request body is loose JSON, but the handler maps the following fields:

- `name` required-ish, coerced with `String(...)`
- `description`
- `status`
- `category`
- `source`
- `owner`
- `task_grouping`
- `archived`
- `estimated_duration`
- `current_duration`
- `project_id`

Important behavior:

- a new UUID is generated for the task id
- the command uses `CreateTask`
- the persisted task is read back from the inline projection after the bus completes

Response: `201` + `TaskListDocument | null`

### PUT `/api/tasks/:taskId`

- builds a patch by removing immutable fields (`id`, `created_at`)
- sends `UpdateTask`
- returns the updated inline projection

### DELETE `/api/tasks/:taskId`

- sends `DeleteTask`
- returns `{ status: "success", message: "Task '...' deleted." }`

### POST `/api/tasks/bulk-sync`

This route exists for planning-import workflows.

Request body:

```json
{
  "updates": [
    { "id": "...", "name": "...", "status": "done" }
  ],
  "creations": [
    { "name": "New item", "status": "backlog", "category": "business" }
  ]
}
```

Behavior:

- updates are normalized and validated
- invalid status values throw `IllegalStateError`
- creations default to:
  - `status: backlog`
  - `category: business`
  - `owner: Alice`
  - `task_grouping: General`
  - `estimated_duration: 60`
  - `current_duration: 0`
  - `source: planning`
  - `archived: false`
- if a project exists in the `project_list` projection, the first one is used as the default project
- commands are dispatched in parallel with `Promise.all(...)`

Response:

```json
{
  "status": "success",
  "tasks_updated": 0,
  "tasks_created": 0
}
```

## Daily tasks: `/api/daily-tasks`

File: `backend-js/src/dailyTask/api/routes.ts`

The daily-task API is intentionally more constrained than the task API because the calendar needs strict scheduling guarantees.

### GET `/api/daily-tasks`

Two supported query modes:

1. calendar range: `start_date` + `end_date`
2. task-scoped: `task_id` alone

If neither is satisfied, the route returns a `422`-style validation error.

Response: `DailyTaskDocument[]`, sorted by `date` and `start_time`.

Representative shape:

```json
{
  "id": "uuid",
  "task_id": "uuid|null",
  "date": "2026-05-25",
  "start_time": "09:00",
  "end_time": "09:30",
  "title": "Focus block",
  "owner": "Alice",
  "parent_task_name": "Parent Task",
  "parent_task_grouping": "Sprint A",
  "parent_project_id": "uuid|null",
  "parent_status": "in_progress",
  "parent_archived": false,
  "created_at": "...",
  "updated_at": "..."
}
```

### POST `/api/daily-tasks`

Request body:

```json
{
  "date": "YYYY-MM-DD",
  "start_time": "HH:mm",
  "end_time": "HH:mm",
  "title": "optional",
  "task_id": "optional uuid"
}
```

Validation is enforced in the aggregate via `validateSchedule(...)`.

### PATCH `/api/daily-tasks/:dailyTaskId`

- merges the patch into the existing record
- re-validates the full schedule after merge
- re-validates owner if provided

### DELETE `/api/daily-tasks/:dailyTaskId`

Returns a success message after soft delete.

## Projects: `/api/projects`

File: `backend-js/src/project/api/routes.ts`

### GET `/api/projects`

Returns the `project_list` projection as an array.

### POST `/api/projects`

Request body:

```json
{
  "name": "Project Name",
  "description": "optional",
  "color": "#RRGGBB"
}
```

Important behavior:

- project names must be unique across the current projection
- duplicate names raise `ValidationError`
- response is read back from the projection after the bus completes

Response: `201` + project document.

## Settings: `/api/settings`

File: `backend-js/src/settings/api/routes.ts`

### GET `/api/settings`

Returns a flat key/value map of settings.

Common keys surfaced in code and UI:

- `gemini_api_key`
- `planning_folder_path`
- `planning_sync_enabled`
- `task_grouping_colors`
- `theme`
- `sync_hash`

### POST `/api/settings`

Request body: arbitrary key/value pairs.

The handler compares incoming values to the current setting map and only emits `UpsertSetting` for changed keys.

Response:

```json
{
  "status": "success",
  "settings_updated": ["theme", "planning_folder_path"]
}
```

### POST `/api/settings/sync-planning`

This is the server-side weekly planning sync trigger.

Query param:

- `force` — truthy string or boolean to bypass hash checks

Behavior is implemented in `settings/syncPlanning/syncService.ts`.

## AI: `/api/ai`

File: `backend-js/src/ai/routes.ts`

### POST `/api/ai/classify`

Request body:

```json
{
  "name": "Task title",
  "description": "optional description"
}
```

The handler loads projects and sends the project names to the AI service so the response can map `project_name` back to `project_id` when possible.

### POST `/api/ai/weekly-plan`

No request body required.

The handler loads the planning markdown directory and asks the AI service to compile a weekly plan.

### POST `/api/ai/flow-analyzer`

No request body required.

The handler loads active tasks, excluding `done`, and passes a reduced task shape to the AI service.

### POST `/api/ai/enhance-ticket`

Request body:

```json
{
  "name": "Ticket title",
  "description_stub": "short draft"
}
```

The handler also loads planning context to give the model more local context for enhancement.

### AI logging

Every AI route calls `appendAiLog(...)` with:

- action
- prompt
- response
- tokens_used
- model
- optional error

This creates an audit trail even when the model returns invalid JSON.

## Views: `/api/views`

File: `backend-js/src/views/api/routes.ts`

### GET `/api/views`

Returns all saved views, plus resolved database name from the current schema store when available.

### GET `/api/views/:viewId`

Returns a single view config and its associated database schema properties.

### POST `/api/views`

Two modes:

- update existing view if `id` already exists
- create new view otherwise

Request body keys used by the handler:

- `id` optional
- `database_id`
- `name`
- `layout_type`
- `filters`
- `sorts`
- `grouping`
- `visible_properties`

Defaults when omitted:

- `database_id` → tasks database
- `name` → `Untitled View`
- `layout_type` → `table`
- `filters` → `{}`
- `sorts` → `[]`
- `grouping` → `{}`
- `visible_properties` → `[]`

### POST `/api/views/:viewId/update-config`

Updates only the config fields on an existing view.

### DELETE `/api/views/:viewId`

Deletes the view aggregate.

### POST `/api/views/:viewId/execute`

Loads the view, schema, and raw records, then executes the query engine.

The response shape is documented in the query-engine page because it depends on grouping, filters, and computed fields.

## Source references

- `backend-js/src/task/api/routes.ts`
- `backend-js/src/dailyTask/api/routes.ts`
- `backend-js/src/project/api/routes.ts`
- `backend-js/src/settings/api/routes.ts`
- `backend-js/src/ai/routes.ts`
- `backend-js/src/views/api/routes.ts`
- `frontend/src/api.js`
