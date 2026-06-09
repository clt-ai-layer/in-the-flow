# InTheFlow — Known Limitations

> **Type**: Reference (live code truth)  
> **Last Updated**: 2026-05-25

This document records **intentional v1 deferrals**, **documentation drift**, and **partial implementations** observed in live code.

---

## v1 Deferred Features

### Calendar

| Limitation | Detail |
| ---------- | ------ |
| Fixed grid hours | Calendar displays 07:00–22:00 only; not configurable in Settings |
| Same-day blocks only | No overnight spans; `end_time` must exceed `start_time` on same `date` |
| No block description | DailyTask has optional `title` only — no notes or per-block color column |
| No AI calendar import | AI weekly-plan compiler is advisory; does not create DailyTask rows |
| Header create default | "Create block" uses fixed 09:00–10:00, not viewport scroll position |

### Theme

| Limitation | Detail |
| ---------- | ------ |
| Binary theme only | Light or Dark — no system/native theme follow |
| Partial light-mode coverage | KanbanBoard, Backlog, AiHub, and Dashboard retain some dark-era inline colors (hardcoded HSL/hex in component styles) |
| Sidebar brand gradient | Logo text gradient uses hardcoded `#fff` — may look off in light mode |

### Grouping colors

| Limitation | Detail |
| ---------- | ------ |
| STATUS_COLOR_MAP duplication | Status colors defined in both `KanbanBoard.jsx` (`STATUS_COLUMNS`) and `groupingColors.js` (`STATUS_COLOR_MAP`) — must be kept in sync manually |
| EAV orphan records after wipe | Wiping task streams without `database_records` leaves stale Kanban cards — run `pnpm backfill:task-records` or include EAV in reset |

### AI

| Limitation | Detail |
| ---------- | ------ |
| Stub mode without key | All AI endpoints return heuristic stubs (HTTP 200) when Kimi key missing |
| Token tracking | Python `AiLog.tokens_used` often 0; backend-js populates when live |
| Planning path hardcoded | `sync_service.PLANNING_DIR` is hardcoded; AI endpoints use setting with same default |
| No classify UI | `/api/ai/classify` exists but no dedicated frontend workflow |
| Legacy settings label | UI says "Gemini API Key"; backend-js stores Kimi key in `gemini_api_key` |

### Cutover / backend-js

| Limitation | Detail |
| ---------- | ------ |
| Fresh MongoDB seed (ADR-001) | v1 cutover does **not** import SQLite `intheflow.db` — back up before switching; re-sync planning markdown after cutover |
| Python launcher | **`start.bat` starts backend-js** (default since cutover). Use `start-python.bat` for legacy FastAPI |
| MongoDB required | backend-js fails fast without `MONGODB_URI`, `.mongo-key`, or `MONGO_KEY_PATH` |

### Infrastructure

| Limitation | Detail |
| ---------- | ------ |
| CORS wide open | `allow_origins=["*"]` — acceptable for local desktop, not production-hardened |
| SQLite FK not enforced (Python) | DailyTask cascade and EAV deletes are application-level |
| No auth | API has no authentication — localhost trust model |
| Electron does not spawn backend | API must be started separately (`start.bat` → backend-js, or manual `pnpm dev`) |

---

## Documentation Drift

### Reference vs Specs folder

Historical specs live in [Specs/](Specs/). Known divergences from live code:

| Spec topic | Drift |
| ---------- | ----- |
| File naming | Specs use `00-Summary.md`, `02-Database-Schema.md`; reference docs use `00-Overview.md`, `02-Database.md` |
| Electron paths | Some specs reference `electron/` - live IPC is in `frontend/electron.js` and `frontend/preload.js` |
| DailyTask response | Reference adds `parent_archived` field not in original API spec |
| Sidebar nav order | Specs implied Calendar between Dashboard and workspace views; live order is Dashboard → AI Hub → Calendar |

**Rule**: Reference docs in this folder supersede Specs when they conflict.

### Sibling legacy reference files

Older reference files may still exist alongside this set:

- `00-Summary.md`, `02-Database-Schema.md`, `04-Frontend-UI.md`, etc.

Prefer the numbered `00-Overview.md` through `07-Known-Limitations.md` series for current truth.

### Implementation drift validation

Drift validation (2026-05-24) flagged Settings Appearance as missing. **This was subsequently fixed** - Appearance toggle now exists in `Settings.jsx`. The drift doc remains as historical record.

---

## Light Mode Partial Coverage

Components with **good token coverage** (use CSS variables):

- App shell, Sidebar, Calendar, TaskModal, Settings, modals, Toast

Components with **residual hardcoded dark colors**:

| Component | Examples |
| --------- | -------- |
| `KanbanBoard.jsx` | `STATUS_COLUMNS` uses literal HSL/hex; some column backgrounds |
| `Backlog.jsx` | Table row hover, status badges |
| `AiHub.jsx` | Gradient buttons use `color: 'white'` |
| `Dashboard.jsx` | Timer card backgrounds, some stat colors |
| `Sidebar.jsx` | Brand logo gradient text |

Light mode is functional for daily calendar workflow but not pixel-perfect across all pages.

---

## EAV / Dual-Write Caveats

| Caveat | Impact |
| ------ | ------ |
| View engine reads EAV | Kanban/views read Mongo `database_records`, not task streams directly. After DB wipe, run `pnpm backfill:task-records`. Python legacy: direct SQLite edits without sync leave views stale |
| Project create EAV sync | **Fixed in backend-js** — `projectSideEffects.onProjectCreated` creates Projects Workspace `DatabaseRecord`; Python legacy still lacks this |
| Formula evaluation uses `eval()` | Query engine formula properties have sanitized eval — complex formulas may fail silently |

---

## Weekly Plan Sync Caveats

| Caveat | Detail |
| ------ | ------ |
| Single planning directory | Hardcoded planning folder path (user-configurable) |
| Filename convention | Requires `Current_Planning_*.md` prefix |
| Checklist format | Regex parser expects specific markdown checkbox + owner emoji format |
| Hash skip | Unchanged file content skips sync unless `force=true` |
| Done task archival | Done planning tasks absent from current file are auto-archived |

---

## Testing Gaps

Per feature-creation config, automated tests were not required for Weekly Plan Calendar v1. Backend has `test_router_behavior.py` for some router checks; no frontend test suite.

---

## Related

- [06-Weekly-Plan-Calendar.md](06-Weekly-Plan-Calendar.md) — Feature reference
- Feature success criteria - Explicit out-of-scope list
- [Specs/](Specs/) — Historical planning documents
