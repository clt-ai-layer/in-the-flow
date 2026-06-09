# Emmett Adapters — Specification (Minimal / Functional Path)

> **Status**: Draft — Review (2026-05-25)
> **Scope**: `backend-js` (Emmett 0.42.3 + MongoDB COLLECTION_PER_STREAM_TYPE)
> **Audience**: Backend engineers on Emmett side projects who keep **functional deciders** (current `*Decider.ts` style)
> **Parent**: [_EmmettDocRouter.md](./_EmmettDocRouter.md)
> **Related**: [DDD-Framework-vs-Emmett.md](./DDD-vs-Emmett.md) · **[Entity Kit (Set A)](./Emmett-EntityKit.spec.md)** — class layer (`EntityRoot`, `Outcome`, `projectReadModel`)

---

## 1. Status

| Item | Value |
| ---- | ----- |
| Spec version | 0.2 (Draft) |
| Wrapper code implemented | **No** — spec only |
| Last reviewed | 2026-05-25 |
| This spec covers | **Minimal functional path** — one helper (`runCommand`) + existing Emmett primitives |
| Full DDD-shaped path | **[Entity Kit spec](./Emmett-EntityKit.spec.md)** — `EntityRoot`, `EntityRef`, `Outcome`, `runEntity`, `defineEntityReadModel` |
| Target path (this spec) | `backend-js/src/platform/emmett/runCommand.ts` |
| Target path (Entity Kit) | `backend-js/src/es-kit/` |
| Legacy consumers | `task/`, `dailyTask/`, `project/`, `settings/`, `views/` (functional deciders today) |

### 1.1 Which path to choose

| Choose **this spec** (functional + `runCommand`) | Choose **[Entity Kit](./Emmett-EntityKit.spec.md)** |
| ------------------------------------------------ | --------------------------------------------------- |
| Module already uses `*Decider.ts` and you want smallest diff | New entity or full module rewrite |
| Domain throws `IllegalStateError` directly (idiomatic Emmett) | Domain returns **`Outcome<T>`** on `EntityRoot` methods |
| Projections use `mongoDBInlineProjection` directly | Projections use **`defineEntityReadModel` + `projectReadModel`** |
| Identity via `getXxxStreamId()` helpers | Identity via **`EntityRef`** |
| Side effects via `integration/*SideEffects.ts` | Side effects via **`EntityReactions/`** |

**Rule:** Do **not** mix both paths in the same entity module after migration. Pick one per bounded-context module.

**Default for greenfield InTheFlow work:** Entity Kit (Set A), unless the slice is a one-line fix in an existing functional module.

---

## 2. Purpose

Define the **minimal adapter** for `backend-js` when staying on functional Emmett deciders:

1. Reduce HTTP route boilerplate (`CommandHandler` → re-query → side effects).
2. Keep Emmett 0.42.3 as the engine — no shadow framework.
3. Stay compatible with persisted strings (event types, projection names, stream types).
4. Avoid `@sp/common-domain` and legacy DDD type names.

This spec **does not** define the class layer. For `EntityRoot`, `Outcome`, `EntityRef`, `projectReadModel`, and `runEntity`, see **[Emmett-EntityKit.spec.md](./Emmett-EntityKit.spec.md)**.

This document also records what was **rejected from the original “full adapter” proposal** in *this* minimal layer — and points superseded items to Entity Kit where appropriate.

---

## 3. Non-Goals (this spec only)

- **Class-based domain** — use [Entity Kit](./Emmett-EntityKit.spec.md) instead of expanding this spec.
- **`Outcome<T>` / `EntityRoot`** — Entity Kit; not `runCommand`.
- Replace `mongoDBInlineProjection`, `CommandHandler`, or `toStreamName`.
- Middleware chain (`Pipeline.Use(...)`), TypeDI, `@SerializableType`.
- Change persisted stream types, event types, or projection names.

Entity Kit has its own non-goals (no `@sp/common-domain`, no legacy name clashes) in its spec §3.

---

## 4. Problem Statement

Today every route handler in `backend-js` repeats:

```typescript
const command: CreateTask = { type: "CreateTask", data: {...}, metadata: { now } };
const streamId = getTaskStreamId(taskId);
await taskCommandHandler(eventStore, streamId, (state) => createTask(command, state));

const created = await findTaskById(eventStore, taskId);
if (created) {
  await taskSideEffects.onTaskCreated({ type: "TaskCreated", data: created });
}
res.status(201).json(created);
```

References: `task/api/routes.ts`, `dailyTask/api/routes.ts`, `project/api/routes.ts`.

> **Note:** Each `*Decider.ts` exports a `decide(command, state)` switch, but routes **never call `decide` directly** — they pass individual command functions (e.g. `createTask`, `updateTask`) as the `handle` lambda. The exported `decide` is effectively dead code today. `runCommand` does not change this: `handle` continues to accept per-command functions.

Friction:

1. Re-query projection when `CommandHandler` already returns `newState` / `newEvents`.
2. Manual side-effect dispatch after every command.
3. Repeated command + handler wiring.

**Minimal fix:** `runCommand` — one function, same semantics as today.

**Full fix (separate spec):** Entity Kit — structure + naming aligned with DDD ergonomics without `common-domain`.

---

## 5. Design Principles (functional path)

1. **Emmett stays the engine.** Bypass `runCommand` anytime; call `CommandHandler` directly.
2. **No persisted-string rewriting.** (Shared with Entity Kit — see §9.)
3. **Throw in domain** — `IllegalStateError` / `NotFoundError` / `ValidationError`; HTTP via `fastApiErrorMiddleware.ts`. For **`Outcome`**, use Entity Kit.
4. **Function-first** in this spec — `createTask`, `evolve`, `decide`. Class-first is Entity Kit.
5. **One justified helper** — `runCommand` only; no rename wrappers.
6. **Synchronous side effects** — `afterCommit` awaited before HTTP response (same as today).

---

## 6. Wrapper Inventory

Legend: **KEEP** = this spec · **ENTITY KIT** = moved to [Entity Kit spec](./Emmett-EntityKit.spec.md) · **REJECT** = neither layer · **DEFER** = future

### 6.1 Identity wrapper — ENTITY KIT (`EntityRef`)

Original proposal: `StreamAggregateId` / legacy `AggregateId` wrapper.

| Layer | Decision |
| ----- | -------- |
| Minimal (this spec) | Keep `get<X>StreamId(id)` per module (3 lines) |
| Entity Kit | **`EntityRef`** + `toStreamName()` |

Optional generic factory (either path, rarely needed):

```typescript
export const makeStreamHelpers = <T extends string>(streamType: T) => ({
  streamType,
  streamIdOf: (id: string): StreamName<T> => toStreamName(streamType, id),
  parse: (name: StreamName<T>) => fromStreamName(name),
});
```

---

### 6.2 Domain Result wrapper — ENTITY KIT (`Outcome`)

Original proposal: `defineDecider` wrapping `Result<T>` from `@sp/common-domain`.

| Layer | Decision |
| ----- | -------- |
| Minimal (this spec) | Deciders throw — idiomatic Emmett; no adapter |
| Entity Kit | **`Outcome<T>`** on `EntityRoot` methods; **`toEmmettError`** at `XxxDispatch.decide` |

Functional mapping for docs: Traditional DDD `Result.Fail` ≈ `throw new IllegalStateError(...)` in this path.

---

### 6.3 `runCommand` — KEEP (this spec only)

Single entry for functional routes. Entity Kit equivalent: **`runEntity`** ([Entity Kit §6.4](./Emmett-EntityKit.spec.md)).

| Proposal claim | Reality |
| -------------- | ------- |
| Returns `Result<CommandResult<Aggregate>>` | Emmett `CommandHandler` returns `{ newState, newEvents, ...appendMetadata }` |
| Middleware stack | Rejected in both paths |
| `afterSuccess` with read model doc | Prefer **`newEvents`** in `afterCommit`; re-query optional |

**Signature:**

```typescript
import type { Event, EventStore } from "@event-driven-io/emmett";
import { CommandHandler, type CommandHandlerOptions } from "@event-driven-io/emmett";

export type RunCommandOptions<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
> = {
  store: Store;
  streamId: string;
  decider: CommandHandlerOptions<State, StreamEvent>;
  /** Typically a per-command function, e.g. `(state) => createTask(command, state)` — NOT the aggregate `decide` switch. */
  handle: (state: State) => StreamEvent | StreamEvent[] | Promise<StreamEvent | StreamEvent[]>;
  afterCommit?: (ctx: {
    newState: State;
    newEvents: StreamEvent[];
    streamId: string;
  }) => Promise<void> | void;
};

export async function runCommand<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
>(
  opts: RunCommandOptions<Store, State, StreamEvent>,
): Promise<{ newState: State; newEvents: StreamEvent[] }> {
  const handler = CommandHandler(opts.decider);
  const result = await handler(opts.store, opts.streamId, opts.handle);
  if (opts.afterCommit) {
    await opts.afterCommit({
      newState: result.newState,
      newEvents: result.newEvents,
      streamId: opts.streamId,
    });
  }
  return { newState: result.newState, newEvents: result.newEvents };
}
```

**Implementation note:** Entity Kit's `runEntity` may delegate to the same internal helper to avoid duplication once both land.

**What `runCommand` is NOT:** pipeline, registry, aggregate loader, logging/auth layer.

---

### 6.4 Projection wrapper — ENTITY KIT (`defineEntityReadModel`)

Original proposal: `defineProjection` with DDD naming.

| Layer | Decision |
| ----- | -------- |
| Minimal (this spec) | `mongoDBInlineProjection` directly; local type aliases OK |
| Entity Kit | **`defineEntityReadModel`** + **`projectReadModel(doc, event)`** + **`XxxReadModel`** type |

Persisted `name` (e.g. `"task_list"`, `"daily_task"`) unchanged in both paths.

---

### 6.5 `IntegrationRegistry` — DEFER (both paths)

Keep explicit `taskSideEffects.onTaskCreated(...)` or Entity Kit **`EntityReactions/`** files. Registry only if ≥2 unrelated consumers per event type.

Wire via `afterCommit` / `runEntity.afterCommit`:

```typescript
await runCommand({
  store: eventStore,
  streamId,
  decider: { evolve, initialState },
  handle: (state) => createTask(command, state),
  afterCommit: async ({ newEvents }) => {
    for (const event of newEvents) {
      if (event.type === "TaskCreated") {
        await taskSideEffects.onTaskCreated(event);
      }
    }
  },
});
```

> **Side-effect initialization:** `taskSideEffects` requires boot-time init via `initTaskSideEffects({ eventStore })` (called in `platform/app.ts`). When migrating to `afterCommit`, the side-effect module still needs `eventStore` for cascade operations (e.g. `onTaskDeleted` calls `dailyTaskCommandHandler` to cascade-delete linked daily tasks).

---

### 6.6 `defineModule` — REJECT (both paths)

Keep `register<X>Routes(app, eventStore)` + central `projections.inline([...])` in `platform/projections.ts`.

All inline projections must be added to the central `inlineProjections` array in `platform/projections.ts`. This applies to both paths — neither `runCommand` nor Entity Kit's `defineEntityReadModel` auto-registers projections.

---

### 6.7–6.9 Optional helpers

| Wrapper | Minimal path | Entity Kit |
| ------- | ------------ | ---------- |
| `defineCommand` (Zod) | DEFER — HTTP boundary only | Same |
| `LightweightPipeline` | DEFER — Express middleware | Same |
| `mapEmmettErrorToHttp` | REJECT — exists in `fastApiErrorMiddleware.ts` | **`toEmmettError`** for `Outcome` only |

---

## 7. Summary Table

| Wrapper | Minimal (this spec) | Entity Kit |
| ------- | ------------------- | ---------- |
| Identity | `getXxxStreamId()` | **`EntityRef`** |
| Domain errors | throw in decider | **`Outcome`** + `toEmmettError` |
| Command entry | **`runCommand`** | **`runEntity`** |
| Domain shape | `*Decider.ts` functions | **`EntityRoot`** + `XxxDispatch.ts` |
| Projections | `mongoDBInlineProjection` | **`defineEntityReadModel` + `projectReadModel`** |
| Integration | `*SideEffects.ts` | **`EntityReactions/`** |
| `IntegrationRegistry` | DEFER | DEFER |
| `defineModule` | REJECT | REJECT |

**Net surface — minimal path:** **`runCommand`** only (+ existing Emmett helpers).

**Net surface — Entity Kit:** full **`es-kit/`** package ([glossary](./Emmett-EntityKit.spec.md#12-glossary-quick-reference)).

---

## 8. What NOT to Build (minimal path)

1. No `Outcome` / `EntityRoot` here — Entity Kit.
2. No `@sp/common-domain` / legacy `Result`, `AggregateRoot`, `AggregateId`.
3. No `@SerializableType` registry.
4. No `CommandPipeline` middleware.
5. No replacement for Emmett primitives.
6. No persisted-string registry that centralizes renamable literals.
7. No module auto-discovery.

Entity Kit adds: no legacy name reuse; no mixing functional + class in one module.

---

## 9. Persisted-String Compatibility Rules

Shared by **both paths**. Entity Kit MUST NOT rename these either.

### 9.1 Stream types

| Module | Constant | Value | Collection |
| ------ | -------- | ----- | ---------- |
| `task` | `TASK_STREAM_TYPE` | `"task"` | `emt:task` |
| `dailyTask` | `DAILY_TASK_STREAM_TYPE` | `"dailyTask"` | `emt:dailyTask` |
| `project` | `PROJECT_STREAM_TYPE` | `"project"` | `emt:project` |
| `settings` | `SETTINGS_STREAM_TYPE` | `"settings"` | `emt:settings` |
| `views` | `DATABASE_VIEW_STREAM_TYPE` | `"databaseView"` | `emt:databaseView` |

### 9.2 Event types

Complete list of persisted event type literals (11 total):

| Module | Event types |
| ------ | ----------- |
| `task` | `"TaskCreated"`, `"TaskUpdated"`, `"TaskDeleted"` |
| `dailyTask` | `"DailyTaskCreated"`, `"DailyTaskUpdated"`, `"DailyTaskDeleted"` |
| `project` | `"ProjectCreated"` |
| `settings` | `"SettingUpserted"` |
| `views` | `"DatabaseViewCreated"`, `"DatabaseViewConfigUpdated"`, `"DatabaseViewDeleted"` |

> **Note:** `views` uses `DatabaseViewConfigUpdated` (not `DatabaseViewUpdated`) — be aware of the naming inconsistency.

### 9.3 Projection / read-model names (persisted)

| Module | Constant | Name |
| ------ | -------- | ---- |
| `task` | `TASK_LIST_PROJECTION_NAME` | `"task_list"` |
| `dailyTask` | `DAILY_TASK_PROJECTION_NAME` | `"daily_task"` |
| `project` | `PROJECT_LIST_PROJECTION_NAME` | `"project_list"` |
| `settings` | `SETTINGS_PROJECTION_NAME` | `"settings_map"` |
| `views` | `DATABASE_VIEW_LIST_PROJECTION_NAME` | `"database_view_list"` |

Entity Kit may introduce **`XxxReadModel`** TypeScript types and rename constants to `*_READ_MODEL_NAME`; persisted **`name`** string stays as today until a DB migration. Existing constants use `*_PROJECTION_NAME`.

### 9.4 Schema version

Projection modules must set `schemaVersion` explicitly; helpers must not default-mask bumps.

### 9.5 Route plumbing requirements

All route handlers must be wrapped with **`asyncHandler()`** (from `platform/fastApiErrorMiddleware.ts`) so that thrown Emmett errors reach the error middleware:

```typescript
router.post("/", asyncHandler(async (req, res) => {
  // ... throws propagate to fastApiErrorMiddleware
}));
```

This applies whether using `runCommand`, `runEntity`, or direct `CommandHandler` calls. Without `asyncHandler`, thrown `IllegalStateError` / `NotFoundError` become unhandled promise rejections.

### 9.6 Central projection registration

All inline projections are registered in **`platform/projections.ts`**:

```typescript
export const inlineProjections = projections.inline([
  taskListProjection,
  projectListProjection,
  dailyTaskProjection,
  settingsProjection,
  databaseViewListProjection,
]);
```

New projections (from either path) must be added to this array. Neither spec proposes auto-discovery.

---

## 10. Migration Strategy

### 10.1 Path A — Minimal (this spec)

1. Land `src/platform/emmett/runCommand.ts` + unit tests. No route changes.
2. Opportunistically migrate functional routes when touched.
3. Leave `*Decider.ts` and projection files unchanged.

### 10.2 Path B — Entity Kit

Follow [Entity Kit §11](./Emmett-EntityKit.spec.md#11-migration-phases): land `es-kit/`, pilot one entity (e.g. DailyTask), opportunistic rest.

### 10.3 Shared rules

- **Never migrate** bulk-sync multi-command loops to `runCommand`/`runEntity` without a dedicated design.
- **Never mix** functional decider + `EntityRoot` in one module.
- Side-effect modules keep their behavior; only **wiring** moves to `afterCommit`.
- **Cross-module cascade awareness:** `taskSideEffects.onTaskDeleted` cascade-deletes linked daily tasks via `dailyTaskCommandHandler`. If migrating task or dailyTask to Entity Kit, consider migration order — see [Entity Kit §11](./Emmett-EntityKit.spec.md#11-migration-phases).
- **Singleton streams:** Settings uses a fixed `"global"` stream ID (no per-entity UUID). `EntityRef` and `runCommand` must handle this pattern.

### 10.4 Rollback

- Minimal: delete `runCommand.ts`, expand routes mechanically.
- Entity Kit: revert module to functional decider + direct `CommandHandler`.

---

## 11. Testing Strategy

| Concern | Minimal path | Entity Kit |
| ------- | ------------ | ---------- |
| Command helper | Unit-test `runCommand` | Unit-test `runEntity` + `Outcome` |
| Domain | `DeciderSpecification` on `decide`/`evolve` | + unit tests on `EntityRoot` methods |
| Read models | `MongoDBInlineProjectionSpec` | + tests on `projectReadModel` |
| HTTP | `supertest` — behavior unchanged | Same |
| Persisted strings | Snapshot constants per module | Same |

---

## 12. Open Questions

1. **`runCommand` vs shared core with `runEntity`** — implement once in `platform/emmett/` and re-export from `es-kit`? **Recommendation:** yes, when Entity Kit lands.
2. Pre-built `CommandHandler` vs `{ evolve, initialState }` — support both via overload.
3. **`afterCommit` payload** — narrow `{ newState, newEvents }` unless append metadata needed.
4. **`runCommands` (plural)** — defer; bulk-sync stays explicit.
5. **Document `afterCommit` failure after persist** — yes, in JSDoc on both helpers.
6. **QueryEngine / EAV** — out of scope for both specs.

---

## 13. Comparison: Traditional DDD → Minimal → Entity Kit → Emmett

| Traditional DDD | Minimal (this spec) | Entity Kit (Set A) | Emmett |
| --------- | ------------------- | ------------------ | ------ |
| `AggregateRoot` | — | **`EntityRoot`** | state + `evolve` |
| `AggregateId` | `getXxxStreamId()` | **`EntityRef`** | `toStreamName` |
| `Result<T>` | throw in decider | **`Outcome<T>`** | — |
| `Apply` / `When` | return event / `evolve()` | **`record` / `replay`** | decider / evolve |
| `CommandPipeline.Execute` | **`runCommand`** | **`runEntity`** | `CommandHandler` |
| Projection `When` | `evolve` in inline projection | **`projectReadModel`** | `mongoDBInlineProjection` |
| `IntegrationPipeline` | `*SideEffects` + `afterCommit` | **`EntityReactions`** | manual `handle()` |
| `@SerializableType` | — | Zod at HTTP (optional) | `Event`/`Command` types |
| TypeDI | `register*Routes` | same | — |

---

## 14. References

- **Specs:** [Entity Kit (Set A)](./Emmett-EntityKit.spec.md) · [DDD-Framework-vs-Emmett.md](./DDD-vs-Emmett.md)
- **Live code:** `backend-js/src/{task,dailyTask,project,settings,views,integration,platform}/`
- **Emmett types:** `@event-driven-io/emmett@0.42.3`, `@event-driven-io/emmett-mongodb@0.42.3`
- **DDD baseline:** `packages/backend/src/DDD/` (reference only — do not import)

---

## 15. Decision Log

| Date | Decision | Rationale |
| ---- | -------- | --------- |
| 2026-05-25 | Minimal path: keep **`runCommand` only** | Original full adapter layer over-scoped. |
| 2026-05-25 | Class layer → **[Entity Kit spec](./Emmett-EntityKit.spec.md)** | `EntityRoot`, `Outcome`, `EntityRef`, `projectReadModel` — no `common-domain`. |
| 2026-05-25 | Reject `defineDecider` in minimal path | Throws are idiomatic; `Outcome` lives in Entity Kit. |
| 2026-05-25 | Reject `StreamAggregateId` in minimal path | Use `EntityRef` in Entity Kit or per-module helpers here. |
| 2026-05-25 | Reject `defineProjection` in minimal path | Use `defineEntityReadModel` in Entity Kit. |
| 2026-05-25 | Default greenfield → **Entity Kit** | Team chose Set A vocabulary; minimal path for legacy/touched functional modules only. |
| 2026-05-25 | Shared folder **`src/platform/emmett/`** for `runCommand` | Neutral naming. Entity Kit in **`src/es-kit/`**. |
| 2026-05-25 | No mixing paths per entity module | Avoid dual `decide` + `EntityRoot` maintenance. |

---

**Version**: 0.3  
**Last updated**: 2026-05-28
