# OpenWiki — InTheFlow

InTheFlow is a **desktop productivity workspace** for project planning and execution. It combines task management, dynamic workspace views, weekly calendar scheduling, AI assistance, and weekly plan sync — all in a standalone Electron app.

**Tech stack:** Electron + React frontend, Express + Emmett event sourcing backend, MongoDB.

## Wiki index

### Backend

Deep-dive into the server architecture, API surface, data model, and event sourcing patterns.

- [Event sourcing architecture](backend/event-sourcing.md) — Emmett patterns, command handling, projections
- [API routes reference](backend/api.md) — All REST endpoints with request/response schemas
- [Data model & Mongo collections](backend/data-model.md) — Entity schemas, EAV structure, seeding
- [Operations & configuration](backend/operations.md) — Environment, Mongo setup, testing

### Frontend

Electron shell, React pages, state management, and theme system.

- [Pages reference](frontend/pages.md) — Dashboard, Calendar, KanbanBoard, Backlog, AiHub, Settings
- [State, IPC & theme](frontend/state-and-ipc.md) — App.jsx orchestration, Electron IPC, theme tokens, grouping colors

### Domain

Core business models, workflows, and lifecycle rules.

- [Task lifecycle](domain/task-lifecycle.md) — Status model, creation flows, deletion cascades, EAV dual-write
- [Models & workflows](domain/models-and-workflows.md) — Project, DailyTask, Settings, EAV, planning sync

### Operations

Setup, testing, and known limitations.

- [Environment & configuration](operations/environment.md) — Prerequisites, MongoDB, AI providers, startup
- [Testing strategy](operations/testing.md) — Test commands, high-value test areas, recommendations
- [Known limitations](operations/known-limitations.md) — v1 deferrals, EAV caveats, infrastructure notes

## Quick start

### Development

```powershell
# From project root
pnpm install
# Terminal 1: backend
cd backend-js; pnpm dev
# Terminal 2: frontend
pnpm dev
# Terminal 3: electron
$env:NODE_ENV="development"; pnpm start
```

Or use the launcher: `start.bat`

### Key source files

| Concern | Path |
| ------- | ---- |
| App root state | `frontend/src/App.jsx` |
| API client | `frontend/src/api.js` |
| Backend bootstrap | `backend-js/src/index.ts` |
| App assembly | `backend-js/src/platform/app.ts` |
| Task integration | `backend-js/src/task/integration/TaskIntegrationHandler.ts` |
| Query engine | `backend-js/src/views/queryEngine/QueryEngine.ts` |
| Electron main | `frontend/electron.js` |
| Theme | `frontend/src/utils/theme.js` |

## Existing reference docs

The `docs/reference/` folder contains the authoritative reference documentation (00-Overview through 07-Known-Limitations). The `docs/emmett/` folder contains Emmett framework guides. This OpenWiki is a navigable summary — when in doubt, verify against those references and the source code.
