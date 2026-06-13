# InTheFlow — Overview

> **Type**: Reference (live code truth)  
> **Router**: [_InTheFlowAppRouter.md](_InTheFlowAppRouter.md)  
> **Last Updated**: 2026-05-25

## What InTheFlow Is

InTheFlow is a **desktop productivity workspace** for project planning and execution. It combines:

- **Task management** — Jira-style tickets with status workflow, projects, owners, and task groupings
- **Dynamic workspace views** — Notion-inspired EAV databases with Kanban boards, tables, and lists
- **Weekly calendar** — Time-blocked daily schedule linked to parent tasks
- **AI assistance** — Moonshot Kimi integration for classification, planning, flow diagnostics, and ticket enhancement
- **Weekly plan sync** — Imports tasks from markdown planning files (CLI or optional in-app sync)

The app is a standalone desktop application. It is **not** part of any DDD/CQRS backend framework.

**Primary backend (default):** `backend-js` — Express, Emmett event sourcing, MongoDB.

## How to Run

### Development (`start.bat`)

From the project root:

```bat
start.bat
```

This script:

1. Installs/builds the React frontend (`pnpm install`, `pnpm build`)
2. Starts **backend-js** on `127.0.0.1:8000` (`pnpm dev` in `backend-js/`)
3. Waits 5 seconds for the API to boot
4. Launches Electron (`pnpm start`)

### Manual development

| Step | Command | Location |
| ---- | ------- | -------- |
| Install deps | `pnpm install` | project root |
| Frontend dev server | `pnpm dev` | Vite on port 5173 |
| **Primary API** | `pnpm dev` | `backend-js/` |
| Electron (dev) | `NODE_ENV=development pnpm start` | Loads `http://localhost:5173` |

### Other launchers

| File | Purpose |
| ---- | ------- |
| `InTheFlow.vbs` | Silent Windows launcher |

## Directory Layout

```
.
├── start.bat                 # Default launcher (backend-js + Electron)
├── package.json              # Electron + Vite + React
├── backend-js/               # PRIMARY — Emmett + MongoDB API (:8000)
│   ├── src/index.ts          # Express entry, seed phases, routes
│   ├── src/task/             # Task aggregate, bulk-sync
│   ├── src/dailyTask/        # DailyTask aggregate
│   ├── src/views/            # EAV QueryEngine, view execute
│   ├── src/task/integration/ # TaskIntegrationHandler → EAV + daily parent sync
│   └── es-kit/               # Event sourcing utilities
├── frontend/
│   ├── electron.js           # Electron main process
│   └── src/
│       ├── App.jsx           # Root state, navigation, modals
│       ├── api.js            # HTTP client (localhost:8000)
│       ├── pages/            # Dashboard, Calendar, KanbanBoard, Backlog, Settings
│       └── utils/            # theme.js, groupingColors.js
└── dist/                     # Vite build output (Electron production load)
```

## Main User-Facing Capabilities

| Capability | Navigation | Description |
| ---------- | ----------- | ----------- |
| **Dashboard** | Sidebar → Dashboard | Focus timer, friction score, AI remediation hints, task stats |
| **AI Flow Hub** | Sidebar → AI Flow Hub | Weekly plan compiler, flow blocker diagnostics |
| **Calendar** | Sidebar → Calendar | Mon–Sun weekly grid (07:00–22:00), drag-create/resize/move blocks |
| **Workspace views** | Sidebar → WORKSPACE VIEWS | Dynamic Kanban boards and table/list views from EAV query engine |
| **Backlog** | Via table/list views | Filtered task tables (e.g. "Backlog Table", "Archived Tasks History") |
| **Settings** | Sidebar → Settings | Kimi API key (legacy label: Gemini), planning folder, theme, grouping colors |
| **Sync Weekly Plan** | Sidebar footer (when enabled) | Parses `Current_Planning_*.md` — default off; use CLI for manual sync |

### Default seeded views

On first run, backend-js seeds four workspace views against "Tasks Workspace":

| View | Layout | Grouping | Purpose |
| ---- | ------ | -------- | ------- |
| Sprint Board | `board` | Status columns + **TaskGrouping swimlanes** | Kanban with grouping-colored rows |
| Backlog Table | `table` | — | All non-archived tasks |
| AI Flow Hub List | `list` | — | Compact list for AI hub context |
| Archived Tasks History | `table` | — | Archived tasks only |

Users can create additional custom views (board or table layout) via the **+** button in the workspace views section.

When in doubt, trust the reference docs and verify against the source code.

## Related Documentation

- [01-Architecture.md](01-Architecture.md) — Dual-process model, IPC, navigation
- [06-Weekly-Plan-Calendar.md](06-Weekly-Plan-Calendar.md) — Calendar + Kanban grouping deep dive
- [backend-js README](../../backend-js/README.md) — Mongo setup, seed phases, backfill scripts
