# Known Limitations & Caveats

## v1 Deferred Features

### Calendar

| Limitation | Detail |
| ---------- | ------ |
| Fixed grid hours | 07:00–22:00 only; not configurable in Settings |
| Same-day blocks only | No overnight spans; `end_time` must exceed `start_time` |
| No block description | DailyTask has optional `title` only — no notes |
| No AI calendar import | Weekly-plan compiler is advisory; does not create blocks |
| Header create default | Fixed 09:00–10:00, not viewport scroll position |

### Theme

| Limitation | Detail |
| ---------- | ------ |
| Binary only | Light or Dark — no system/native theme follow |
| Partial light coverage | KanbanBoard, Backlog, AiHub, Dashboard retain hardcoded dark-era colors |
| Sidebar gradient | Logo text uses hardcoded `#fff` |

### AI

| Limitation | Detail |
| ---------- | ------ |
| Stub mode | All AI endpoints return heuristic stubs (HTTP 200) when key missing |
| No classify UI | `/api/ai/classify` exists but no frontend workflow |
| Legacy label | UI says "Gemini API Key" but stores Kimi key in `gemini_api_key` |

### Infrastructure

| Limitation | Detail |
| ---------- | ------ |
| CORS wide open | `cors({ origin: "*" })` — localhost trust model only |
| No auth | API has no authentication |
| Backend not spawned | Electron does not start the API — must be started separately |

## EAV / Dual-Write Caveats

| Caveat | Impact |
| ------ | ------ |
| View engine reads EAV only | Kanban/views use `database_records`, not task streams. After DB wipe, run backfill script |
| Formula eval uses `eval()` | Sanitized but complex formulas may fail silently |
| EAV orphan records | Wiping task streams without `database_records` leaves stale Kanban cards |

## Weekly Plan Sync Caveats

| Caveat | Detail |
| ------ | ------ |
| Single directory | One configurable planning folder |
| Filename convention | Requires `Current_Planning_*.md` prefix |
| Checklist format | Regex parser expects specific checkbox + owner emoji format |
| Hash skip | Unchanged content skips sync unless `force=true` |
| Auto-archive | Done planning tasks absent from current file are archived |

## Maintenance scripts

| Script | Purpose |
| ------ | ------- |
| `backend-js/scripts/backfill-task-records.ts` | Purges orphan EAV rows, re-upserts from task projections |

Run after any MongoDB data wipe or when Kanban views show stale data.

## Source files

- `docs/reference/07-Known-Limitations.md` — Full limitations reference
