# Testing Strategy

## Test commands

From `backend-js/`:

| Command | Purpose |
| ------- | ------- |
| `pnpm test` | Unit/API tests |
| `pnpm test:golden` | Golden parity tests |
| `pnpm test:integration` | Mongo + gated AI integration tests |
| `pnpm test:json` | JSON output for CI |

## Test framework

- **Vitest** — test runner and assertions
- Tests live in `backend-js/tests/`
- No frontend test suite exists (v1 deferral)

## High-value test areas

### Mongo URI / database name resolution

Tests confirm:
- `resolveMongoUri()` throws clear setup message if no URI or key file is configured
- `MONGODB_URI` is preferred over `MONGO_URI`
- `getDatabaseName()` returns `intheflow_test` in test mode
- Does not use `intheflow_dev` in test mode

### Task deletion cascades

Tests verify:
- Deleting a task removes linked daily tasks
- Deleting a task removes matching EAV record from view execution
- Multiple daily blocks referencing the same task are all removed

### Project EAV sync

Tests check:
- Creating a project upserts a corresponding `DatabaseRecord` in the Projects Workspace
- The record has the expected `database_id` and matching `id`

## Testing recommendations

When editing backend code:

1. Run focused tests for the area you changed
2. If you changed projections or command handlers, run integration tests as well as unit tests
3. If you changed configuration, verify both runtime startup and test-mode behavior
4. After DB wipe, run `backend-js/scripts/backfill-task-records.ts` to rebuild EAV records

## Testing gaps

- No frontend test suite (React components are untested)
- No formal E2E tests across Electron + backend
- Calendar feature (v1) shipped without automated tests per feature-creation config

## Source files

- `backend-js/tests/` — All backend test files
- `backend-js/vitest.config.ts` — Vitest configuration
