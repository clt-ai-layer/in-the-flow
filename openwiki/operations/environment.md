# Environment & Configuration

## Prerequisites

| Requirement | Version | Notes |
| ----------- | ------- | ----- |
| Node.js | 20+ LTS | Required for both backend and Electron |
| pnpm | Latest | Package manager (no npm/yarn) |
| MongoDB | 6+ | Required — backend fails fast without it |

## MongoDB connection

The backend resolves MongoDB credentials in priority order:

| Source | Key | Priority |
| ------ | --- | -------- |
| Environment variable | `MONGODB_URI` | 1 (highest) |
| Environment variable | `MONGO_URI` | 2 (fallback) |
| Key file | `backend-js/.mongo-key` | 3 (gitignored) |
| Environment variable | `MONGO_KEY_PATH` | 4 (custom path) |

If none are configured, the backend throws a clear setup error on startup.

### Database names

| Context | Database name | Override |
| ------- | ------------- | -------- |
| Development | `intheflow_dev` | `MONGODB_DB_NAME` env |
| Test (Vitest) | `intheflow_test` | Always `_test` in test mode |

## AI provider configuration

| Source | Key | Values |
| ------ | --- | ------ |
| Settings DB | `ai_provider` | `kimi` (default), `gemini` |
| Environment | `AI_PROVIDER` | Override setting |

### Kimi key resolution

| Source | Key | Priority |
| ------ | --- | -------- |
| Settings DB | `gemini_api_key` | Primary (legacy UI label) |
| Settings DB | `kimi_api_key` | Alternate |
| Environment | `KIMI_API_KEY` / `GEMINI_API_KEY` | Fallback |
| File | `backend-js/.kimi-api-key` | Local dev (gitignored) |

### Gemini key resolution

| Source | Key | Priority |
| ------ | --- | -------- |
| Settings DB | `gemini_api_key` | Primary |
| Environment | `GEMINI_API_KEY` | Fallback |
| File | `backend-js/.gemini-api-key` | Local dev (gitignored) |

### Model override

| Provider | Default model | Override env |
| -------- | ------------- | ------------ |
| Kimi | `kimi-k2.6` | `KIMI_MODEL` |
| Gemini | `gemini-2.0-flash` | `GEMINI_MODEL` |

Universal override: `AI_MODEL` env applies to whichever provider is active.

## Startup

### Quick start (`start.bat`)

```bat
start.bat
```

This script:
1. Installs/builds the React frontend (`pnpm install`, `pnpm build`)
2. Starts backend-js on `127.0.0.1:8000` (`pnpm dev` in `backend-js/`)
3. Waits 5 seconds for the API to boot
4. Launches Electron (`pnpm start`)

### Manual development

| Step | Command | Location |
| ---- | ------- | -------- |
| Install deps | `pnpm install` | project root |
| Frontend dev server | `pnpm dev` | Vite on port 5173 |
| Backend API | `pnpm dev` | `backend-js/` on port 8000 |
| Electron (dev) | `NODE_ENV=development pnpm start` | Loads `http://localhost:5173` |

### Seed phases on startup

Backend-js runs idempotent seed phases on every startup via `registerSeedPhase()`:

| Phase | Purpose |
| ----- | ------- |
| `default-projects` | Sample Project stream |
| `seed-settings` | Default settings keys |
| `seed-tasks` | Tasks from `seed/seed_tasks.json` |
| `eav-database-schemas` | Tasks/Projects Workspace schema |
| `seed-database-views` | Four default views + EAV backfill from projections |
| `patch-sprint-board-task-grouping-subgroups` | Upgrades Sprint Board to `subgroup_by: TaskGrouping` |

## Infrastructure notes

| Aspect | Detail |
| ------ | ------ |
| CORS | `cors({ origin: "*" })` — all origins allowed for Electron dev compatibility |
| Auth | None — localhost trust model |
| Backend spawn | Electron does **not** start the API server — must be started separately |
| Error format | FastAPI-compatible: `{ "detail": "Error message" }` |

## Source files

- `backend-js/src/index.ts` — Server bootstrap
- `backend-js/src/platform/env.ts` — Environment resolution
- `backend-js/src/config/appConfig.ts` — App configuration
- `backend-js/src/platform/seed.ts` — Seed phase orchestration
- `start.bat` — Launch script
