# Backend: Event Sourcing and Emmett Patterns

## What this layer does

The active backend is `backend-js/`, which assembles an Express API around an Emmett event-sourced command bus and MongoDB-backed inline projections. The core runtime path is:

1. `backend-js/src/index.ts` loads environment variables, opens the event store, builds the Express app, seeds data, and starts the HTTP server.
2. `backend-js/src/platform/app.ts` registers domain routers and shared middleware.
3. `backend-js/src/platform/entityHandlers.ts` wires the command bus, integration middleware, and domain handlers.
4. Each aggregate (`Task`, `DailyTask`, `Project`, `Settings`, `DatabaseView`) translates commands into events and projections.

This section explains the patterns that make that work and the decisions that keep the system predictable.

## Startup path

### `backend-js/src/index.ts`

```ts
async function main(): Promise<void>
```

The bootstrap flow is intentionally small:

- `loadAppEnv()` loads runtime configuration.
- `getEventStore()` creates the Emmett MongoDB event store.
- `createApp(eventStore)` builds the HTTP app.
- `runSeed(eventStore)` applies idempotent startup seed phases.
- `app.listen(8000, "127.0.0.1")` starts the API.
- `SIGINT` and `SIGTERM` close the server and Mongo resources.

The server logs a simple health message and exits with code 1 on startup failure.

### `backend-js/src/platform/app.ts`

```ts
export function createApp(eventStore: EventStore): Express
```

Important implementation details:

- CORS is permissive (`origin: *`, `methods: *`, `allowedHeaders: *`), which matches the desktop/local runtime rather than a public multi-tenant deployment.
- `express.json()` and `express.urlencoded({ extended: true })` are enabled globally.
- `GET /` returns `HEALTH_RESPONSE` with `status`, `app`, and `version`.
- Routers are registered once, in a fixed order.
- `fastApiErrorMiddleware` is the final middleware so route errors are normalized into the `{ detail }` shape expected by the frontend and tests.

## Emmett command bus design

### `backend-js/src/platform/entityHandlers.ts`

```ts
export function createCommandBus(
  store: MongoDBEventStore,
  client?: MongoClient,
): EntityCommandBus
```

The bus is wired from three layers:

- **Command handlers** translate a command into a call on a domain entity.
- **Integration middleware** runs after the primary event append and handles cross-aggregate side effects.
- **Pipeline middleware** provides logging, timing, and context wrapping.

Registered handlers:

- `CreateDailyTaskHandler`, `UpdateDailyTaskHandler`, `DeleteDailyTaskHandler`
- `CreateTaskHandler`, `UpdateTaskHandler`, `DeleteTaskHandler`
- `CreateProjectHandler`
- `UpsertSettingHandler`
- `CreateDatabaseViewHandler`, `UpdateDatabaseViewConfigHandler`, `DeleteDatabaseViewHandler`

Registered integration handlers:

- `TaskIntegrationHandler`
- `ProjectIntegrationHandler`

Middleware order matters:

1. `EntityContextMiddleware`
2. `EntityLoggingMiddleware`
3. `EntityTimingMiddleware`
4. `EntityIntegrationMiddleware`

The command bus comments note that transactional batch support is enabled when a live `MongoClient` is available; otherwise tests and in-memory setups fall back to non-transactional operation.

## Aggregate pattern

Each aggregate follows the same high-level shape:

- `static streamType` identifies the stream family.
- `static initialState` provides the empty state.
- `static replayState(state, event)` folds one event into state.
- `create/update/delete` methods validate state transitions and emit events through `Outcome`.

This is a functional Emmett style, but wrapped in classes for readability and shared helpers.

### Task aggregate

File: `backend-js/src/task/domain/Task.ts`

Key types:

```ts
type EmptyTask = { lifecycle: "Empty" };
type ActiveTask = { lifecycle: "Active"; ... };
type DeletedTask = { lifecycle: "Deleted"; id: string };
type TaskState = EmptyTask | ActiveTask | DeletedTask;
```

Lifecycle invariant:

- Empty → Active on `TaskCreated`
- Active → Deleted on `TaskDeleted`
- `TaskUpdated` only changes Active state
- Deleted tasks are not resurrected

Domain methods:

```ts
create(data: Partial<TaskFields> & { name: string; id?: string }, now?: Date): Outcome<void>
update(data: { id: string; patch: Partial<TaskFields> }, now?: Date): Outcome<void>
delete(data: { id: string }, now?: Date): Outcome<void>
```

Validation decisions:

- `status` is normalized via `validateTaskStatus()`.
- Missing `status` defaults to `backlog`.
- Missing `source` defaults to `user_created`.
- Missing `owner` defaults to `Alice`.
- Missing `task_grouping` defaults to `General`.
- `estimated_duration` is nullable, while `current_duration` defaults to `0`.

Event shapes:

- `TaskCreated` stores the full task snapshot plus `created_at` and `updated_at`.
- `TaskUpdated` stores a partial `patch` and a new `updated_at` timestamp.
- `TaskDeleted` stores `deleted_at`.

### DailyTask aggregate

File: `backend-js/src/dailyTask/domain/DailyTask.ts`

Key rules are stronger than the task aggregate because the UI depends on calendar integrity:

- schedule must be valid
- schedule must be 15-minute aligned
- `end_time` must be after `start_time`
- owner must be one of the allowed values validated by `normalizeOwner()`

Domain methods:

```ts
create(data: Partial<DailyTaskFields> & { id?: string; date: string; start_time: string; end_time: string }, now?: Date): Outcome<void>
update(data: { id: string; patch: Partial<DailyTaskFields> }, now?: Date): Outcome<void>
delete(data: { id: string }, now?: Date): Outcome<void>
```

Daily tasks carry denormalized parent task fields:

- `parent_task_name`
- `parent_task_grouping`
- `parent_project_id`
- `parent_status`
- `parent_archived`

That denormalization is a deliberate tradeoff so the calendar can render without joining across aggregates.

### Project aggregate

File: `backend-js/src/project/domain/Project.ts`

Project is simpler:

- Empty → Active on `ProjectCreated`
- no update/delete commands are implemented in the current code path
- default color is `#3B82F6`

### Settings and DatabaseView aggregates

- `Settings` stores a global key/value map.
- `DatabaseView` stores saved configuration for custom workspace views.

These aggregates are intentionally small and mostly act as command validation + event emission layers.

## Command handlers

Handlers are thin and mostly map command metadata to aggregate methods.

Examples:

- `CreateTaskHandler.getEntityId()` returns `command.data.id` or a new UUID.
- `UpdateTaskHandler.route()` calls `entity.update(command.data, command.metadata?.now)`.
- `DeleteDailyTaskHandler.route()` calls `entity.delete(command.data, command.metadata?.now)`.
- `CreateDatabaseViewHandler.route()` delegates to `entity.create(command.data)`.

This pattern keeps all business rules in the aggregate classes instead of spreading them across HTTP handlers.

## Why this architecture exists

The codebase is optimized for a desktop workspace that needs:

- strict workflow validation
- predictable replayable state changes
- fast read models for UI rendering
- coordinated side effects, such as EAV records and daily-task cascades

Using Emmett keeps the event-sourcing ceremony small while still preserving aggregate boundaries and a deterministic state fold.

## Watch-outs for future changes

- Do not rename `streamType` values without migration work; they are persisted stream families.
- Keep command handlers thin; domain rules belong in aggregates.
- If you add new event types, update both the aggregate `when()` method and its inline projection.
- If you add side effects that cross aggregates, wire them through integration middleware rather than calling the database directly from route handlers.
- Preserve the `fastApiErrorMiddleware` response shape because the frontend `api.js` client expects `error.detail`.

## Source references

- `backend-js/src/index.ts`
- `backend-js/src/platform/app.ts`
- `backend-js/src/platform/entityHandlers.ts`
- `backend-js/src/task/domain/Task.ts`
- `backend-js/src/dailyTask/domain/DailyTask.ts`
- `backend-js/src/project/domain/Project.ts`
- `backend-js/src/settings/domain/Settings.ts`
- `backend-js/src/views/domain/DatabaseView.ts`
- `docs/emmett/Getting-Started.md`
