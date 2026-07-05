# Frontend Pages

InTheFlow uses **string-based view routing** — no React Router. `App.jsx` holds a `currentView` state string that determines which page renders.

## Page Map

| Page | File | `currentView` value | Data source |
| ---- | ---- | ------------------- | ----------- |
| Dashboard | `pages/Dashboard.jsx` | `dashboard` | `App.tasks`, `App.projects` |
| AI Flow Hub | `pages/AiHub.jsx` | `ai-hub` | AI endpoints on demand |
| Calendar | `pages/Calendar.jsx` | `calendar` | Local `api.dailyTasks.list()` — bypasses `App.tasks` |
| Kanban Board | `pages/KanbanBoard.jsx` | view UUID | `api.views.execute()` + `api.tasks.list()` |
| Backlog / Table | `pages/Backlog.jsx` | view UUID | `api.views.execute()` |
| Settings | `pages/Settings.jsx` | `settings` | `api.settings.get/update` |

When `currentView` is a UUID string, `App.jsx` fetches the view metadata via `api.views.get(id)` and executes it via `api.views.execute(id)`. The `layout_type` field determines whether `KanbanBoard.jsx` (board) or `Backlog.jsx` (table/list) renders.

## Dashboard

File: `frontend/src/pages/Dashboard.jsx`

The Dashboard is the default landing page. It shows:

- **Focus timer** — Pomodoro-style work timer
- **Friction score** — AI-powered flow diagnostics via `api.ai.flowAnalyzer()` (called on task load)
- **Remediation hints** — AI-suggested blockers and split recommendations
- **Task stats** — Counts by status, category, and project

Data: Receives `tasks` and `projects` from `App.jsx` props. Tasks are the full unfiltered list (excluding archived).

## AI Flow Hub

File: `frontend/src/pages/AiHub.jsx`

Two main features:

- **Compile Sprint Plan** — Calls `api.ai.weeklyPlan()` to summarize markdown planning files into priorities and a suggested calendar. Advisory only — does not write tasks to the database.
- **Flow Diagnostics** — Calls `api.ai.flowAnalyzer()` to identify blockers, friction scores, and task split recommendations.

Both features use the active AI provider (Kimi default, Gemini alternative). Without an API key, deterministic stub responses are returned (HTTP 200).

## Calendar

File: `frontend/src/pages/Calendar.jsx`

Weekly time-blocking grid for daily scheduling. Key characteristics:

| Parameter | Value |
| --------- | ----- |
| `SLOT_MINUTES` | 15 |
| Visible hours | 07:00 – 22:00 |
| `SLOT_HEIGHT` | 20px per slot |
| Week start | ISO Monday |

### Interactions

| Action | Behavior |
| ------ | -------- |
| Click-drag empty slot | Create preview → BlockModal on release |
| Drag block body | Move to new day/time (duration preserved) |
| Drag top/bottom edge | Resize start or end independently |
| Single click linked block | Fetch full task → open TaskModal |
| Single click unlinked block | Open BlockModal in edit mode |
| Right-click / Delete key | Confirm delete block |
| Prev/Next week | Shift 7 days, refetch range |
| Today button | Reset to current ISO week |

### Data isolation

Calendar owns its data fetch — it does **not** use `App.tasks`:

```javascript
api.dailyTasks.list({ start_date: monday, end_date: sunday })
```

Refetch triggers: `weekStartDate` change, `dailyTasksVersion` increment from `App.jsx`.

### Block color priority

`getDailyBlockAccentColor()` resolves the accent stripe via:

1. Parent `task_grouping` → grouping colors map
2. Parent `project_id` → project color
3. Parent `status` → `STATUS_COLOR_MAP`
4. Neutral `#64748B`

### Overlap layout

`assignOverlapColumns()` computes side-by-side columns for overlapping blocks on the same day.

### Error recovery

Failed PATCH after drag/resize reverts block to its snapshot position and shows a Toast notification.

## KanbanBoard

File: `frontend/src/pages/KanbanBoard.jsx`

Renders from `viewResult.groups` (EAV via QueryEngine), **not** raw `Task[]`.

- **Default Sprint Board:** columns = **Status**; swimlanes = **TaskGrouping** (`subgroup_by`)
- Swimlane headers use grouping colors (4px left accent + tinted background)
- Cards use `getGroupingCardChromeStyle()` — surface tint + 4px left stripe + grouping badge
- Local filters default to **All categories** / **All owners** (tabs above board)
- `STATUS_COLUMNS` defines column header colors when grouped by Status
- Drag-and-drop finds tasks in nested `groups` structure; preserves `task_grouping` on update
- Context menu (right-click): edit, duplicate, delete

### Grouping modes

| `group_by` | `subgroup_by` | Layout |
| ---------- | ------------- | ------ |
| Status | null | Status columns, flat |
| Status | TaskGrouping | Status columns × TaskGrouping swimlanes (default) |
| TaskGrouping | null | Grouping columns, column headers tinted with grouping color |

## Backlog

File: `frontend/src/pages/Backlog.jsx`

Table/list layout for dynamic views. Used for "Backlog Table", "Archived Tasks History", and any user-created table/list views.

Renders from `viewResult` execution data. Supports the same `ViewControlBar` filter/sort/group controls as KanbanBoard.

## Settings

File: `frontend/src/pages/Settings.jsx`

Sections:

- **AI Provider** — Select Kimi or Gemini, enter API key
- **Planning Folder** — Set path for weekly plan markdown files (uses Electron `openDirectory` IPC)
- **Planning Sync** — Enable/disable sidebar sync button
- **Appearance** — Dark/Light theme toggle (immediate apply + auto-save)
- **Task Grouping Colors** — Color editor for the 22 default groupings + user overrides

## Components

| Component | File | Role |
| --------- | ---- | ---- |
| Sidebar | `components/Sidebar.jsx` | Navigation (Dashboard → AI Hub → Calendar → Views → Settings), sync, refresh |
| TaskModal | `components/TaskModal.jsx` | Create/edit task, scheduled blocks list, AI enhance button |
| ViewControlBar | `components/ViewControlBar.jsx` | Filter/sort/group controls for dynamic views |
| Toast | `components/Toast.jsx` | Transient notifications (Calendar errors) |

### TaskModal detail

Two-column layout: details (left) + parameters (right).

- **Scheduled blocks** section (edit mode only): lists linked DailyTasks with click-to-navigate
- **Add to calendar**: inline form with next 15-min slot defaults
- **AI Enhance**: calls `api.ai.enhanceTicket()` to generate markdown description
- **Duplicate**: creates new task without id

## Source files

- `frontend/src/App.jsx` — Root orchestrator
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/AiHub.jsx`
- `frontend/src/pages/Calendar.jsx`
- `frontend/src/pages/KanbanBoard.jsx`
- `frontend/src/pages/Backlog.jsx`
- `frontend/src/pages/Settings.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/TaskModal.jsx`
- `frontend/src/components/ViewControlBar.jsx`
- `frontend/src/components/Toast.jsx`
