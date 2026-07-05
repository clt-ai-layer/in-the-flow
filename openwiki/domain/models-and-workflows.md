# Domain Models & Workflows

## Project model

Projects group tasks and feed both the task UI and the EAV records layer.

### Fields

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `id` | UUID string | auto | Primary key |
| `name` | string | — | Unique, indexed |
| `description` | string? | null | |
| `color` | string | `#3B82F6` | Hex color for UI |
| `created_at` | datetime | UTC now | |

### Creation side effects

When a project is created, `projectSideEffects.onProjectCreated` automatically creates a matching `DatabaseRecord` in the "Projects Workspace" EAV database. This keeps the EAV layer in sync without manual backfill.

### Seeded project

On first run, the backend seeds a default project:

```json
{ "name": "Sample Project", "color": "#3B82F6", "description": "Production DDD/CQRS/Event Sourcing platform" }
```

Planning-sourced tasks are assigned to this project by default.

---

## DailyTask (Calendar blocks)

DailyTasks are time-blocked schedule entries on the weekly calendar. They are distinct from sprint Task tickets — they represent **when** work happens, not **what** the work is.

### Fields

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `id` | UUID string | auto | Primary key |
| `task_id` | string? | null | Optional FK → Task |
| `date` | string | — | `YYYY-MM-DD` local date |
| `start_time` | string | — | `HH:mm`, 15-min aligned |
| `end_time` | string | — | `HH:mm`, must be after start |
| `title` | string? | null | Optional override label |
| `created_at` | datetime | UTC now | |
| `updated_at` | datetime | UTC now | |

### Two types of blocks

| Type | `task_id` | Display title |
| ---- | --------- | ------------- |
| **Linked block** | UUID of parent task | `parent_task_name` (inherited from task) |
| **Standalone block** | null | `title` field or "Untitled block" |

### Materialized parent fields

API responses include denormalized parent fields for display without joins:

- `parent_task_name` — from linked task
- `parent_task_grouping` — for accent color
- `parent_project_id` — for project color fallback
- `parent_status` — for status color fallback
- `parent_archived` — for opacity styling (0.7 when archived)

These are stored on the DailyTask projection and updated via `TaskIntegrationHandler.syncDailyTaskParentFields` when the parent task changes.

### Validation rules

| Rule | Error code |
| ---- | ---------- |
| Date matches `^\d{4}-\d{2}-\d{2}$` | 422 |
| Times match `^\d{2}:\d{2}$` | 422 |
| Minutes divisible by 15 | 422 |
| `end_time > start_time` same day | 422 |
| Duration ≥ 15 minutes | 422 |
| `task_id` references existing task (if provided) | 404 |

### Cascade on parent deletion

When a parent Task is deleted, all linked DailyTask rows are deleted automatically by `TaskIntegrationHandler`. This prevents orphan calendar blocks.

---

## Settings model

Key-value store for app configuration. Not event-sourced — simple Mongo collection.

### Known keys

| Key | Format | Purpose |
| --- | ------ | ------- |
| `gemini_api_key` | string | Legacy naming — stores active AI provider key |
| `kimi_api_key` | string | Kimi-specific API key |
| `ai_provider` | `kimi` \| `gemini` | Active AI provider (default: `kimi`) |
| `planning_folder_path` | string | Folder for weekly plan markdown files |
| `planning_sync_enabled` | `true` \| `false` | Sidebar sync button visibility |
| `sync_active_file_hash` | JSON string | `{"file_name": "...", "hash": "sha256..."}` — dedup for sync |
| `theme` | `light` \| `dark` | Persisted appearance preference |
| `task_grouping_colors` | JSON string | Map of grouping name → hex color overrides |

---

## EAV database model

The EAV (Entity-Attribute-Value) model powers dynamic workspace views (Kanban, tables, lists).

### Database (schema definition)

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | UUID string | |
| `name` | string | Unique, indexed |
| `icon` | string? | |
| `properties` | JSON string | Array of field definitions |

### DatabaseRecord (row data)

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | UUID string | Matches Task/Project ID |
| `database_id` | string | FK → Database |
| `property_values` | JSON string | Object of field values (PascalCase keys) |

### DatabaseView (saved view config)

| Field | Type | Default | Options |
| ----- | ---- | ------- | ------- |
| `id` | UUID string | auto | |
| `database_id` | string | FK | |
| `name` | string | indexed | |
| `layout_type` | string | `board` | `table`, `board`, `calendar`, `timeline`, `list` |
| `filters` | JSON string | `"{}"` | Filter AST |
| `sorts` | JSON string | `"[]"` | Sort rules |
| `grouping` | JSON string | `"{}"` | `{ group_by, subgroup_by }` |
| `visible_properties` | JSON string | `"[]"` | Field name list |

### Seeded databases

On first run, the backend creates two workspace databases:

1. **Projects Workspace** — Name, Description, Color properties
2. **Tasks Workspace** — Full task property schema (Name, Description, Status, Category, Source, Owner, TaskGrouping, Estimated Duration, Current Duration, Project, Archived, Remaining Duration formula)

### Seeded views

| View | Layout | Grouping | Purpose |
| ---- | ------ | -------- | ------- |
| Sprint Board | `board` | `{ group_by: "Status", subgroup_by: "TaskGrouping" }` | Kanban with grouping-colored swimlanes |
| Backlog Table | `table` | — | All non-archived tasks |
| AI Flow Hub List | `list` | — | Compact list for AI hub context |
| Archived Tasks History | `table` | — | Archived tasks only |

---

## Planning sync workflow

File: `backend-js/src/settings/syncPlanning/syncService.ts`

### Flow

1. **File discovery** — Finds latest `Current_Planning_*.md` in configured planning folder
2. **Hash check** — Compares SHA-256 hash against `sync_active_file_hash` setting. Skip if unchanged (unless `force=true`)
3. **Regex parse** — Extracts tasks from markdown checklist format
4. **AI fallback** — If regex yields 0 tasks, invokes AI parser (`parser_mode: "ai"`)
5. **Upsert** — Match existing tasks by `name + source=planning`, create new ones
6. **Archive** — Done planning tasks not in current file are auto-archived
7. **Response** — Returns counts: `tasks_created`, `tasks_updated`, `tasks_archived`, `total_parsed`

### Markdown format expected

```markdown
### Week: [date range]

#### 💼 Business
- [ ] Ⓑ **Task Name**: description
- [/] 🅾️ **In Progress Task**: description
- [x] 🤝 **Done Task**: description

#### 💻 Development
- [ ] Ⓑ **Dev Task**: description
```

| Marker | Mapping |
| ------ | ------- |
| `[ ]` | status `backlog` |
| `[/]` | status `in_progress` |
| `[x]` / `[X]` | status `done` |
| Ⓑ | owner `Alice` |
| 🅾️ | owner `Bob` |
| 🤝 | owner `Shared` |
| `#### 💻 Development` | category `dev` |
| Other `####` headers | category `business` |

## Source files

- `backend-js/src/project/` — Project aggregate
- `backend-js/src/dailyTask/` — DailyTask aggregate
- `backend-js/src/settings/` — Settings store
- `backend-js/src/settings/syncPlanning/syncService.ts` — Sync service
- `backend-js/src/views/` — EAV databases, views, query engine
- `backend-js/src/task/integration/TaskIntegrationHandler.ts` — Cross-entity sync
