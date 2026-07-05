# Task Lifecycle & Status Model

## Task as the primary unit

Tasks are the central domain entity in InTheFlow. They are event-sourced aggregates stored as MongoDB streams via Emmett. Every task has a status that determines its visibility and position in Kanban views.

## Status values and transitions

| Canonical status | Aliases accepted on import | UI column |
| ---------------- | -------------------------- | --------- |
| `backlog` | `todo`, `to_do`, `not_started`, `pending`, `open` | Backlog |
| `ready_to_start` | `ready` | Ready to Start |
| `in_progress` | `wip`, `in-progress` | In Progress |
| `on_hold` | `hold`, `on-hold` | On Hold |
| `done` | `complete`, `completed` | Done |

There is **no formal state machine** — any status can transition to any other status. The UI enforces visual conventions (Kanban column position), but the backend accepts any valid status value on update.

### Validation

- `validate_task_status()` — strict validation for API requests, returns 422 on invalid status
- `normalize_status()` — permissive validation for seed/import, maps aliases to canonical values

## Task fields

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `id` | UUID string | auto-generated | Primary key |
| `name` | string | — | Indexed |
| `description` | string? | null | Markdown-capable in UI |
| `status` | string | `backlog` | See status enum above |
| `category` | string | `business` | `business` or `dev` |
| `source` | string | `user_created` | `user_created`, `notion_arch`, `planning` |
| `owner` | string? | `Alice` | `Alice`, `Bob`, `Shared` |
| `task_grouping` | string? | `General` | Kanban/calendar color key |
| `archived` | bool | false | Hidden from default views |
| `estimated_duration` | int? | null | Minutes |
| `current_duration` | int? | 0 | Minutes invested |
| `project_id` | string? | null | FK → Project |
| `created_at` | datetime | UTC now | |
| `updated_at` | datetime | UTC now | |

## Task creation flows

### Manual creation (UI)

1. User clicks "+" or "Create Task" in KanbanBoard/Backlog
2. TaskModal opens with defaults: `status: 'backlog'`, `category: 'business'`, `owner: 'Alice'`, `task_grouping: 'General'`, `estimated_duration: 60`
3. On save → `POST /api/tasks` → Emmett command → event stored → EAV record synced via `TaskIntegrationHandler`

### Bulk sync (planning import)

1. `POST /api/tasks/bulk-sync` with `{ updates: [...], creations: [...] }`
2. Creations set `source: "planning"`, default project = Sample Project
3. Status validated via `validate_task_status()` (422 on invalid)
4. Each created/updated task triggers `TaskIntegrationHandler` EAV sync

### Weekly plan sync

1. Triggered via Sidebar → Sync Weekly Plan or `POST /api/settings/sync-planning`
2. Regex parser extracts tasks from `Current_Planning_*.md` markdown files
3. Existing planning tasks matched by name + `source=planning` → updated
4. New tasks created with `source: "planning"`
5. Done tasks not in current file → auto-archived

## Task deletion side effects

Deleting a task triggers cascading cleanup via `TaskIntegrationHandler`:

1. **EAV record deleted** — matching `DatabaseRecord` removed from Mongo
2. **Linked daily tasks deleted** — all `DailyTask` rows with `task_id` pointing to the deleted task

This is application-level cascade, not database-level.

## Task → EAV dual-write

Tasks are the source of truth in event streams. Kanban/views read **EAV `database_records`** instead.

```
Task CRUD → Event Stream → TaskIntegrationHandler → database_records (Mongo)
                                                   → DailyTask parent field sync
```

The `TaskIntegrationHandler` runs synchronously before the HTTP response returns (awaited `handle()`).

### EAV property mapping

Task fields are stored as PascalCase EAV properties:

| Task field | EAV property |
| ---------- | ------------ |
| `name` | `Name` |
| `description` | `Description` |
| `status` | `Status` |
| `category` | `Category` |
| `owner` | `Owner` |
| `task_grouping` | `TaskGrouping` |
| `estimated_duration` | `Estimated Duration` |
| `current_duration` | `Current Duration` |
| `archived` | `Archived` |

## Task grouping inference

For planning-sourced tasks, `guess_task_grouping()` uses keyword heuristics to assign groupings automatically:

- Keywords like `ai`, `model`, `llm` → "AI"
- Keywords like `api`, `endpoint`, `route` → "API"
- Keywords like `auth`, `login`, `permission` → "Auth"
- Keywords like `backend`, `server`, `database` → "Backend"
- And so on for 22 default groupings
- Fallback: "General"

## Source files

- `backend-js/src/task/` — Task aggregate, commands, projections
- `backend-js/src/task/api/routes.ts` — Task REST API
- `backend-js/src/task/integration/TaskIntegrationHandler.ts` — EAV + daily task sync
- `backend-js/src/settings/syncPlanning/syncService.ts` — Weekly plan sync service
