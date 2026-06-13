# InTheFlow backend-js

Node.js backend for the InTheFlow desktop app using **Emmett** (event sourcing) and **MongoDB**.

The legacy Python FastAPI backend remains at `InTheFlow/backend/` — use `start-python.bat` from the InTheFlow root if you need SQLite. **`start.bat` launches this package by default.**

## Prerequisites

- Node.js 20+
- pnpm
- MongoDB connection string (Atlas or local)

## MongoDB credentials

Resolution order:

1. `MONGODB_URI` environment variable
2. `Documentation/3-Development/InTheFlow/JsBackend/.mongo-key` (repo-relative, gitignored content)
3. `MONGO_KEY_PATH` environment variable (absolute path override)

If none are configured, startup fails with a setup message (acceptance criterion #17).

### Database names

| Context | Database |
| --- | --- |
| Local dev | `intheflow_dev` |
| Vitest integration | `intheflow_test` |
| Override | `MONGODB_DB_NAME` |

Never run tests against `intheflow_dev`.

## Quick start

```powershell
cd InTheFlow/backend-js
pnpm install
pnpm dev
```

Server listens on **http://127.0.0.1:8000** (same port as Python for drop-in comparison).

### Ports

| Mode | backend-js port | Frontend |
| ---- | --------------- | -------- |
| Primary (cutover dev) | 8000 | Default `api.js` → `localhost:8000` |
| Side-by-side comparison | 8001 | Python on `:8000`; set `VITE_API_BASE=http://127.0.0.1:8001/api` locally (not committed) |

Run only one backend on port 8000 at a time.

### AI provider

Set `AI_PROVIDER` to `kimi` (default) or `gemini`. Optional `AI_MODEL` overrides the provider default (`kimi-k2.6` / `gemini-2.0-flash`).

| Provider | Env key | Key file fallback |
| -------- | ------- | ----------------- |
| Kimi | `KIMI_API_KEY` | `backend-js/.kimi-api-key` |
| Gemini | `GEMINI_API_KEY` | `backend-js/.gemini-api-key` |

Settings UI still labels the key field "Google Gemini API Key" (`gemini_api_key`); when `AI_PROVIDER=kimi`, that value is treated as a Kimi key (legacy). Use `kimi_api_key` or `KIMI_API_KEY` for Kimi explicitly.

### AI routes

Paths match `InTheFlow/frontend/src/api.js`:

| Method | Path |
| ------ | ---- |
| POST | `/api/ai/classify` |
| POST | `/api/ai/weekly-plan` |
| POST | `/api/ai/flow-analyzer` |
| POST | `/api/ai/enhance-ticket` |

Health check:

```powershell
curl http://127.0.0.1:8000/
```

Expected response:

```json
{ "status": "online", "app": "InTheFlow Backend API", "version": "2.0.0" }
```

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Watch mode via `tsx` |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled output |
| `pnpm test` | Vitest unit/API tests |
| `pnpm test:json` | Vitest with JSON reporter (CI artifacts) |
| `pnpm test:golden` | Golden fixture comparison only |
| `pnpm test:integration` | Mongo + gated AI integration specs |

## Testing

### Tiers

| Tier | Command | When |
| --- | --- | --- |
| Unit/API | `pnpm test` | Every commit (in-memory Emmett) |
| Golden | `pnpm test:golden` | Pre-cutover parity checks |
| Integration | `pnpm test:integration` | CI (TestContainers) or local `.mongo-key` + `intheflow_test` |
| AI live | `$env:RUN_INTHEFLOW_AI_TESTS='true'; pnpm test:integration` | Manual/nightly (requires Kimi key) |

### Helpers

| File | Role |
| --- | --- |
| `test/helpers/mongoTestContext.ts` | TestContainers Mongo or shared cluster truncate |
| `test/helpers/apiTestClient.ts` | Supertest wrapper for `createApp()` |
| `test/helpers/normalizeGolden.ts` | Key sort, volatile field strip, shape assert |
| `test/helpers/aiTestGate.ts` | `RUN_INTHEFLOW_AI_TESTS` + `LLM_API_KEY` / `.kimi-api-key` |

### Golden capture (Python baseline)

With Python backend on `:8000`:

```powershell
cd InTheFlow/backend-js
.\scripts\capture-python-golden.ps1
```

Fixtures land in `test/fixtures/python-golden/`. Vitest compares normalized responses in `test/golden/*.golden.spec.ts`.

### AI integration gate

```powershell
$env:RUN_INTHEFLOW_AI_TESTS = "true"
$env:LLM_API_KEY = "your-moonshot-key"
# or place key in InTheFlow/backend-js/.kimi-api-key (gitignored)
pnpm test:integration
```

Live Kimi tests skip automatically when the gate is off or no key is configured.

---

## Cutover acceptance checklist

**Prerequisites**: MongoDB credentials configured; `pnpm test:json` green before manual pass. `start.bat` starts backend-js automatically.

| # | Item | Automated supplement | Manual step |
| - | ---- | -------------------- | ----------- |
| 1 | All `api.js` namespaces | Golden + API specs (`tasks`, `projects`, `daily-tasks`, `settings`, `views`, `ai`) | Spot-check each namespace in UI (Scenario M1) |
| 2 | Calendar week CRUD + parent fields | `test/dailyTask/dailyTasks.api.spec.ts` | Visual calendar week |
| 3 | sync-planning regex + hash skip | `test/settings/syncPlanning.api.spec.ts` | Trigger sync from Settings UI |
| 4 | Kanban + Backlog execute | `test/golden/views.execute.golden.spec.ts` | Drag-free visual check |
| 5 | AI stub × 4 endpoints | `test/golden/ai.stub.golden.spec.ts` | Settings AI panel offline |
| 6 | AI live smoke when gated | `test/integration/ai.integration.spec.ts` | Optional with real Kimi key |
| 7 | Electron dev smoke | — | **Manual**: frontend only against js backend (Scenario M2) |
| 8 | No Python on :8000 during verify | — | **Manual**: confirm port owner with `netstat` |

### Manual scenarios

**M1 — Full api.js namespace spot check**

1. Open InTheFlow app connected to `:8000`
2. Navigate Tasks, Projects, Calendar, Settings, Views (Kanban/Backlog), AI classify
3. Confirm each call hits `/api/*` and returns 200/201 without shape errors

**M2 — Electron smoke with default launcher**

1. Run `start.bat` from InTheFlow root (starts backend-js + Electron)
2. Complete one task edit + view refresh + calendar view
3. Kanban shows updated task name immediately (validates checklist #7)

**M3 — ADR-001 fresh seed acknowledgment**

1. Read [ADR-001](../../Documentation/3-Development/InTheFlow/JsBackend/implementationPlans/12.ADR.master.md) and SuccessCriteria §4
2. Confirm SQLite data from `intheflow.db` will **not** migrate in v1
3. Sign off in the checklist below before production cutover

### ADR-001: Fresh MongoDB seed (no full SQLite import)

v1 cutover uses a **fresh MongoDB seed** matching the Python first-run experience (default projects, seed tasks, EAV schemas, four views). **Calendar blocks are not seeded** — use the import script below if you have data in `intheflow.db`.

**Before switching backends**, users must:

1. Back up `intheflow.db` if they need to preserve existing data
2. Start backend-js once (or run seed) so tasks/projects exist in MongoDB
3. Import calendar blocks: `pnpm import:daily-tasks` (see below)
4. Re-sync planning markdown via Settings to repopulate planning-derived tasks
5. Acknowledge that unmatched SQLite task UUIDs may leave calendar blocks unlinked until tasks are imported or matched by name

### Import calendar blocks from SQLite

Legacy calendar data lives in `InTheFlow/backend/intheflow.db` (`dailytask` table). To copy it into MongoDB:

```powershell
cd InTheFlow/backend-js

# Preview (no writes)
pnpm import:daily-tasks -- --dry-run

# Import (skips IDs already in MongoDB)
pnpm import:daily-tasks

# Custom SQLite path
pnpm import:daily-tasks -- --sqlite C:\path\to\intheflow.db
```

**Task linking:** preserves daily-block UUIDs from SQLite. Links to Mongo tasks by task UUID first, then by task name if IDs changed after re-seed. Blocks with no match keep `task_id` from SQLite and parent fields from the SQLite join.

**Requirements:** MongoDB credentials configured; backend-js should have tasks loaded (run `pnpm dev` once or sync planning) so name-based linking works.

This is documented behavior, not a defect. See `Documentation/3-Development/InTheFlow/JsBackend/implementationPlans/00.SuccessCriteria.md` §4 and `12.ADR.master.md`.

### Cutover sign-off

- [ ] Automated: `pnpm test:json` — ___ passed, ___ skipped
- [ ] Checklist items 1–6 verified
- [ ] Item 7 Electron smoke — date: ___
- [ ] Item 8 Python stopped — verified by: ___
- [ ] ADR-001 acknowledged — user: ___
- Sign-off: _______________

### Troubleshooting

| Issue | Action |
| ----- | ------ |
| Port 8000 in use | Stop Python uvicorn; confirm with `netstat -ano \| findstr :8000` |
| Empty Kanban | Check Mongo seed; use fresh `intheflow_dev` database |
| Integration skipped in CI | Enable Docker TestContainers job |
| AI stub 503 | Bug — stubs must return HTTP 200 |

---

## Acceptance ↔ test traceability

Full mapping of `Documentation/3-Development/InTheFlow/JsBackend/implementationPlans/00.SuccessCriteria.md` checklist items:

| # | Acceptance item | Test file(s) |
| - | --- | --- |
| 1 | Idempotent startup seed (no duplicate entities on restart) | `test/integration/SeedIdempotency.integration.spec.ts`, `test/platform/seedService.spec.ts` |
| 2 | Health endpoint returns version `2.0.0` | `test/platform/health.spec.ts`, `test/integration/mongo.integration.spec.ts` |
| 3 | AI stub × 4 endpoints HTTP 200 when unconfigured | `test/golden/ai.stub.golden.spec.ts` |
| 4 | POST `/api/tasks` returns server-generated UUID | `test/task/tasks.api.spec.ts`, `test/task/taskDecider.spec.ts` |
| 5 | PUT partial merge preserves omitted fields | `test/task/tasks.api.spec.ts` |
| 6 | Duplicate project name returns HTTP 400 with exact detail | `test/project/projects.api.spec.ts` |
| 7 | Task rename visible in Kanban immediately after PUT | `test/integration/TaskSideEffectsFreshness.integration.spec.ts` |
| 8 | DELETE task cascades daily tasks and view record | `test/integration/TaskDeleteCascade.integration.spec.ts` |
| 9 | Calendar week range with denormalized parent fields | `test/dailyTask/dailyTasks.api.spec.ts` |
| 10 | 15-minute schedule boundary validation (422) | `test/dailyTask/validateSchedule.spec.ts`, `test/dailyTask/dailyTasks.api.spec.ts` |
| 11 | `start_date` and `end_date` required together | `test/dailyTask/dailyTasks.api.spec.ts` |
| 12 | Invalid task status returns 422, no stream created | `test/task/tasks.api.spec.ts`, `test/task/taskDecider.spec.ts` |
| 13 | sync-planning hash skip when unchanged | `test/settings/syncPlanning.api.spec.ts` |
| 14 | sync-planning imports modified markdown | `test/settings/syncPlanning.api.spec.ts` |
| 15 | Four seeded view execute shapes match golden | `test/golden/views.execute.golden.spec.ts`, `test/views/execute.api.spec.ts` |
| 16 | POST project creates Projects Workspace DatabaseRecord | `test/integration/ProjectEavSync.integration.spec.ts` |
| 17 | Missing Mongo credentials fail fast at startup | `test/platform/mongoConfig.spec.ts` |
| 18 | Invalid AI JSON returns 500 + ai_logs error | `test/ai/ai.invalidJson.spec.ts`, `test/integration/ai.integration.spec.ts` (live gate) |

---

## Parallel development with Python

| Backend | Port | Stack |
| --- | --- | --- |
| Python (`InTheFlow/backend/`) | 8000 | FastAPI + SQLite |
| backend-js (this package) | 8000 | Express + Emmett + MongoDB |

Run only one backend on port 8000 at a time. Point the Electron/React frontend at the active backend.

## Startup seed

Seed JSON assets live in `seed/`:

- `seed_tasks.json` — copied from Python backend
- `eav-ids.json` — deterministic view/database UUIDs
- `tasks-workspace-schema.json` — Tasks Workspace EAV schema

Actual seed execution uses `registerSeedPhase()` hooks registered by domain modules (plans 03/07). All data is appended via Emmett `handle()` — never direct MongoDB inserts.

First run against an empty MongoDB database populates default projects, tasks, and views. Re-seeding requires a fresh database or manual stream cleanup.

## Error format

HTTP errors return FastAPI-compatible JSON:

```json
{ "detail": "Human-readable message" }
```

This preserves compatibility with `InTheFlow/frontend/src/api.js` without frontend changes.

## Project structure

```
src/
  platform/     Express bootstrap, mongo config, error adapter, seed hooks
  task/         Task decider, API routes, projections, side effects
  project/      Project decider, API routes, EAV sync
  dailyTask/    Calendar blocks, schedule validation
  settings/     Settings + sync-planning
  views/        EAV QueryEngine, view execute
  ai/           Kimi service, stub responses
  index.ts      Entry point
seed/             JSON seed assets
test/             Vitest specs
```
