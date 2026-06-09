# InTheFlow Documentation Router

> **Category**: Desktop App  
> **Status**: Active  
> **Last Updated**: 2026-05-25

## What This Is

InTheFlow is a **standalone desktop productivity workspace** (Electron + React + **backend-js** on MongoDB). A **legacy Python/FastAPI + SQLite** stack remains under `backend/` for parity testing. This router indexes **reference documentation** that describes live code.

## Responsibilities

1. **Desktop app reference** — Architecture, database, API, frontend, AI, calendar feature
2. **Live-code authority** — Reference docs supersede historical Specs when they conflict
3. **Cross-linking** — Connects to Weekly Plan Calendar / JsBackend dev artifacts

## Reference vs Specs

| Location | Purpose |
| -------- | ------- |
| **This folder** (numbered `00`–`07` docs) | Authoritative documentation of **live code today** |
| **[Specs/](Specs/)** | Historical planning-era specifications; preserved, not overwritten |

## Quick Navigation

### Reference Documentation (live truth)

| Doc | Topic |
| --- | ----- |
| [00-Overview.md](00-Overview.md) | What InTheFlow is, how to run, directory layout, capabilities |
| [01-Architecture.md](01-Architecture.md) | Electron + backend-js startup, IPC, navigation, EAV dual-write |
| [02-Database.md](02-Database.md) | Mongo event streams + EAV; legacy SQLite models |
| [03-Backend-API.md](03-Backend-API.md) | All REST routers, endpoints, settings keys |
| [04-Frontend.md](04-Frontend.md) | Pages, App state, api.js, Kanban swimlanes, CSS tokens |
| [05-AI-Capabilities.md](05-AI-Capabilities.md) | Kimi integration, weekly plan sync |
| [06-Weekly-Plan-Calendar.md](06-Weekly-Plan-Calendar.md) | DailyTask, calendar UX, grouping colors, theme |
| [07-Known-Limitations.md](07-Known-Limitations.md) | v1 deferrals, doc drift, light-mode gaps |

### Historical Specs

| Folder | Purpose |
| ------ | ------- |
| [Specs/](Specs/) | Planning-era specs (00-Summary through 07-Enhanced-Notion-DB-Spec) |

## Key Source Paths

| Area | Path |
| ---- | ---- |
| App root | `.` |
| **Primary backend** | `backend-js/src/index.ts` |
| Task → EAV sync | `backend-js/src/integration/taskSideEffects.ts` |
| Query engine | `backend-js/src/views/queryEngine/QueryEngine.ts` |
| View seed (Sprint Board subgroups) | `backend-js/src/views/seed/registerViewsSeed.ts` |
| Legacy backend | `backend/main.py`, `database.py`, `routers/` |
| React app | `frontend/src/App.jsx` |
| HTTP client | `frontend/src/api.js` |
| Electron main | `frontend/electron.js` |
| Dev launcher | `start.bat` (backend-js) |

## Stack Summary

| Layer | Technology (primary) |
| ----- | -------------------- |
| Desktop | Electron 27 |
| UI | React 18, Vite 5, Lucide icons |
| API | Express, Emmett, TypeScript |
| Database | MongoDB (event streams + `database_records` EAV) |
| AI | Moonshot Kimi (`KimiService.ts`) |
| Legacy API | FastAPI, SQLModel, SQLite (`backend/`) |

---

**Version**: 1.1  
**Maintainer**: InTheFlow / Weekly Plan Calendar initiative
