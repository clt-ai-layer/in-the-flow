# Backend: Operations, Configuration, and Testing

## Runtime configuration

The backend is configured through environment variables loaded by `backend-js/src/platform/env.ts` and `backend-js/src/config/appConfig.ts`.

Important patterns confirmed by tests:

- `resolveMongoUri()` throws a clear setup error when neither Mongo URI nor key-file configuration is available.
- `MONGODB_URI` takes precedence over `MONGO_URI`.
- Test-mode database selection returns `intheflow_test` rather than the development database name.

## MongoDB settings

The backend expects Mongo connectivity to be available before the API can do real work.

Relevant behavior from the codebase and tests:

- a direct Mongo URI can be configured
- a key-file based configuration path also exists
- test mode uses a dedicated database name
- shutdown closes both the event store and the cached client

This matters for future changes because several routes and integration handlers can tolerate a missing live client in tests, but production startup still requires valid database connectivity.

## Server startup

Entry point: `backend-js/src/index.ts`

Operational behavior:

- loads environment first
- builds event store and Express app
- runs startup seeding
- listens on `127.0.0.1:8000`
- handles `SIGINT` and `SIGTERM`
- exits with code `1` on boot failure

There is no separate process manager in the repository; the app appears intended to be started directly by scripts or desktop tooling.

## Seed and bootstrap behavior

Seed logic lives in `backend-js/src/platform/seed.ts`.

The startup seed flow is phase-based and idempotent. The code defines ordered phases for:

- settings
- tasks
- daily tasks
- views
- project setup
- view/schema synchronization

This is the main place where cold-start data shape is established, so treat it as part of the backend contract rather than a one-off migration.

## Planning sync operations

The planning sync feature is one of the more opinionated workflows in the backend.

### Trigger path

- `POST /api/settings/sync-planning`
- `backend-js/src/settings/syncPlanning/syncService.ts`
- `backend-js/src/planning/*`

### What it does

From the code structure and route usage, the backend:

- reads planning folder/path settings
- parses planning markdown files
- compares hashes to decide whether work is needed
- can be forced with `force=true`
- may create or update tasks based on planning content

### What to watch out for

- planning sync depends on settings state, not only filesystem state
- the feature likely touches both task creation and task updates, so changes can cascade into EAV records and daily-task cleanup
- keep the hash/force semantics stable because they are used to avoid unnecessary churn

## AI operations

The AI subsystem is mounted behind `/api/ai` and pulls context from tasks, projects, planning files, and settings.

Operationally important details:

- responses are appended to an AI log collection
- invalid model JSON is still logged so failures are traceable
- several routes rely on ambient project/task context rather than user-supplied IDs alone

If you change prompt structure or model output parsing, preserve the logging path and error shape so the UI can show meaningful failures.

## Tests and checks

The repository contains targeted backend tests that are especially useful when changing configuration, integration, or synchronization behavior.

### Configuration tests

Confirmed behaviors:

- Mongo URI resolution fallback rules
- test database selection
- explicit setup failure messages when configuration is missing

### Task cleanup tests

The test suite covers the deletion cascade behavior that keeps related data consistent:

- deleting a task removes linked daily tasks
- deleting a task removes it from view execution records
- multiple daily blocks referencing the same task are all removed

These are high-value regression tests if you touch integration logic or parent-child task relationships.

### Project EAV sync tests

The suite also checks that creating a project creates or upserts the matching EAV record with the expected database and record IDs.

### Recommended validation when editing backend code

- run the focused tests for the area you changed
- if you changed projections or command handlers, run integration-related tests as well as unit tests
- if you changed configuration, verify both runtime startup and test-mode behavior

## Useful source references

- `backend-js/src/index.ts`
- `backend-js/src/platform/env.ts`
- `backend-js/src/config/appConfig.ts`
- `backend-js/src/platform/seed.ts`
- `backend-js/src/settings/syncPlanning/syncService.ts`
- `backend-js/src/planning/`
- `backend-js/tests/`
