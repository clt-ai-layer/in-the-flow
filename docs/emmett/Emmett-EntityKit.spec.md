# Entity Kit — Specification (Set A)

> **Status**: Draft — Approved vocabulary (2026-05-25)
> **Scope**: `backend-js` (Emmett 0.42.3 + MongoDB)
> **Package path**: `backend-js/src/es-kit/`
> **Import alias**: `@/es-kit/`
> **Parent**: [_EmmettDocRouter.md](./_EmmettDocRouter.md)
> **Related**: [DDD-Framework-vs-Emmett.md](./DDD-vs-Emmett.md) · [Emmett Adapters — Minimal Path](./Emmett-Adapters.spec.md) (functional deciders + `runCommand`)

---

## 1. What This Is

**Entity Kit** is a small, self-contained class layer on top of Emmett for side projects. It gives DDD-familiar ergonomics (`EntityRoot`, command methods, `Outcome<T>`) **without**:

- depending on `@sp/common-domain`
- reusing legacy DDD type names (`AggregateRoot`, `AggregateId`, `Result`, `CommandPipeline`, …)
- replacing Emmett as the persistence engine

Emmett remains responsible for: `appendToStream`, `CommandHandler`, `mongoDBInlineProjection`, `toStreamName`, inline projections in MongoDB.

Entity Kit is responsible for: domain class shape, identity helpers, outcome-based domain methods, execution glue, read-model projection naming.

---

## 2. Locked Vocabulary — Set A

### 2.1 Core kit types (`src/es-kit/`)

| Entity Kit | Traditional DDD (do **not** use in backend-js) | Emmett primitive (internal wire) |
| ---------- | ---------------------------------------- | -------------------------------- |
| **`EntityRoot`** | `AggregateRoot` | State union + `decide`/`evolve` bridge |
| **`EntityRef`** | `AggregateId` | `toStreamName(streamType, streamId)` |
| **`Outcome<T>`** | `Result<T>` | — (domain only; mapped to throws at executor) |
| **`EntityExecutor`** | `CommandPipeline` | `CommandHandler({ evolve, initialState })` |
| **`EntityReactions`** | `IntegrationPipeline` | explicit post-commit handlers |
| **`XxxReadModel`** | `XxxProjection` (class) | inline projection document type |
| **`projectReadModel(doc, event)`** | projection `When(event)` | `mongoDBInlineProjection({ evolve })` |
| **`defineEntityReadModel(...)`** | projection registration | `mongoDBInlineProjection(...)` wrapper |

### 2.2 Domain verbs (entity / command path)

| Verb | Signature | Meaning |
| ---- | --------- | ------- |
| **`record(event)`** | `protected record(event): Outcome<TEvent>` | Domain decided a fact (traditional DDD `Apply` — **not** persisted until executor appends) |
| **`replay(event)`** | `protected replay(state, event): TState` | Fold one event into entity state (traditional DDD `When` on aggregate) |
| **`Create` / `Update` / `Delete`** | `(command): Outcome<TEvent>` | Command handlers on `EntityRoot` subclass (PascalCase, match traditional DDD methods) |

### 2.3 Read-model verbs (query / projection path)

| Verb | Signature | Meaning |
| ---- | --------- | ------- |
| **`projectReadModel(doc, event)`** | `(doc, event) => doc \| null` | Fold one event into a read-model document; `null` = delete |
| **`initialReadModel()`** | `() => Doc` | Empty read model (traditional DDD projection initial state) |
| **`defineEntityReadModel(config)`** | kit helper | Registers inline projection; maps `projectReadModel` → Emmett `evolve` internally |

**Rule:** Never call projection folding `replay`, `evolve`, or `When` in public Entity Kit API. Domain uses **`replay`**; read models use **`projectReadModel`**.

### 2.4 Emmett bridge (one file per entity — only place for Emmett decider names)

| Bridge | Role |
| ------ | ---- |
| **`XxxDispatch.decide(cmd, state)`** | Maps command → `EntityRoot` method → event(s); throws on `Outcome.fail` |
| **`XxxDispatch.evolve(state, event)`** | Delegates to `EntityRoot.replayState(state, event)` static |
| **`XxxDispatch.initialState()`** | Empty entity state |
| **`xxxEntityHandler`** | `CommandHandler({ evolve: XxxDispatch.evolve, initialState: XxxDispatch.initialState })` |

Do **not** name the bridge `decider.ts` in new modules — use **`XxxDispatch.ts`**.

> **Note:** Today's `*Decider.ts` files export a `decide(command, state)` switch function, but it is **never called** from routes — routes pass individual command functions (e.g. `createTask`, `updateTask`) directly as the `handle` lambda. `XxxDispatch.decide` is therefore a **new** bridge to centralize command dispatch, not a refactor of an existing call path.

### 2.5 Events and commands (type names)

| Pattern | Example |
| ------- | ------- |
| Event type alias | `DailyTaskCreatedEvent = Event<'DailyTaskCreated', {...}>` |
| Event union | `DailyTaskDomainEvent` |
| Command type alias | `CreateDailyTaskCommand = Command<'CreateDailyTask', {...}>` |
| Command union | `DailyTaskCommand` |

**Persisted `event.type` and `command.type` literals are canonical** — never rename without migration.

---

## 3. Forbidden names (clash prevention)

| Forbidden in `backend-js` | Use instead |
| ------------------------- | ----------- |
| `AggregateRoot`, `AggregateId` | `EntityRoot`, `EntityRef` |
| `Result`, `Unit` | `Outcome`, `Outcome<void>` |
| `Apply`, `When` (public API) | `record`, `replay` (entity); `projectReadModel` (read model) |
| `CommandPipeline`, `I*CommandHandler` | `EntityExecutor` |
| `@SerializableType`, `@sp/common-domain` | Zod at HTTP boundary only (optional) |
| `foldReadModel`, `evolve` in domain docs | `projectReadModel`, `replay` |
| `emmettLegacy`, `Aggregate` in folder names | `es-kit`, `Entity` |

---

## 4. Package layout (`src/es-kit/`)

```
src/es-kit/
├── Outcome.ts                 # Outcome<T>, Outcome.ok, Outcome.fail
├── EntityRef.ts               # identity + toStreamName()
├── EntityRoot.ts              # abstract base: replay, record, fromEvents factory
├── EntityExecutor.ts          # run command + afterCommit + Outcome→Emmett error map
├── defineEntityReadModel.ts   # projectReadModel → mongoDBInlineProjection
├── EntityReactions.ts         # optional base types for reaction modules
├── toEmmettError.ts           # Outcome.fail → mapped Emmett error (see §6.6)
└── index.ts
```

---

## 5. Module layout (per entity — e.g. DailyTask)

```
src/DailyTask/
├── Domain/
│   ├── Entities/
│   │   └── DailyTask.ts           # extends EntityRoot; Create/Update/Delete
│   ├── Events/
│   │   └── DailyTaskEvents.ts
│   ├── Commands/
│   │   └── DailyTaskCommands.ts
│   ├── DailyTaskState.ts          # state union (or nested in entity file)
│   ├── DailyTaskDispatch.ts       # Emmett decide/evolve bridge ONLY
│   ├── EntityRef.ts               # re-export or DailyTaskEntityRef helpers
│   └── ValueObjects/
│       └── ...
├── ReadModels/
│   ├── DailyTaskReadModel.ts      # document type + READ_MODEL_NAME constant
│   └── DailyTaskReadModelProjection.ts  # defineEntityReadModel({ projectReadModel })
├── WebApi/
│   └── DailyTaskRouter.ts
├── EntityReactions/
│   └── OnDailyTaskUpdated.ts      # cross-stream; calls EntityExecutor on other roots
└── Seed/
    └── DailyTaskSeed.ts
```

Legacy modules (`task/`, `dailyTask/` lowercase) may migrate opportunistically.

> **Singleton streams:** Settings uses a fixed `SETTINGS_GLOBAL_ID = "global"` (no per-entity UUID). `EntityRef` for singletons: `new EntityRef("settings", "global")` or a static `EntityRef.singleton(streamType)` factory. Settings also has a non-standard state shape (`Record<string, string>` instead of lifecycle union).

---

## 6. API sketches

### 6.1 `Outcome<T>`

```typescript
export type Outcome<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; code?: "not_found" | "illegal" | "validation" };

export const Outcome = {
  ok<T>(value: T): Outcome<T> { return { ok: true, value }; },
  fail<E = string>(error: E, code?: Outcome<never, E>["code"]): Outcome<never, E> {
    return { ok: false, error, code };
  },
};
```

Domain methods return **`Outcome`**. **`EntityExecutor`** and **`XxxDispatch.decide`** map failures to Emmett errors for HTTP middleware.

### 6.2 `EntityRef`

```typescript
export class EntityRef<TStreamType extends string = string> {
  constructor(
    readonly streamType: TStreamType,
    readonly id: string,
    readonly prefix?: string,
  ) {}

  static newId<T extends string>(streamType: T, prefix?: string): EntityRef<T> {
    return new EntityRef(streamType, crypto.randomUUID(), prefix);
  }

  toStreamName(): StreamName<TStreamType> {
    const streamId = this.prefix ? `${this.prefix}_${this.id}` : this.id;
    return toStreamName(this.streamType, streamId);
  }

  static fromStreamName<T extends string>(name: StreamName<T>): EntityRef<T> {
    const { streamType, streamId } = fromStreamName(name);
    const underscore = streamId.indexOf("_");
    if (underscore > 0) {
      return new EntityRef(streamType, streamId.slice(underscore + 1), streamId.slice(0, underscore));
    }
    return new EntityRef(streamType, streamId);
  }
}
```

### 6.3 `EntityRoot`

```typescript
export abstract class EntityRoot<TState, TEvent extends { type: string }> {
  protected constructor(protected readonly state: TState) {}

  getState(): TState { return this.state; }

  static fromState<T extends EntityRoot<unknown, unknown>>(
    this: new (state: S) => T,
    state: S,
  ): T {
    return new this(state);
  }

  /** Override in subclass — fold event into state */
  protected abstract replay(state: TState, event: TEvent): TState;

  /** Helper for subclasses after a recorded event */
  protected record(event: TEvent): Outcome<TEvent> {
    return Outcome.ok(event);
  }
}
```

### 6.4 `EntityExecutor`

```typescript
export type EntityExecutorOptions<
  Store extends EventStore,
  TState,
  TEvent extends Event,
  TCommand extends { type: string },
> = {
  store: Store;
  ref: EntityRef;
  dispatch: {
    decide: (command: TCommand, state: TState) => TEvent | TEvent[];
    evolve: (state: TState, event: TEvent) => TState;
    initialState: () => TState;
  };
  command: TCommand;
  afterCommit?: (ctx: { newState: TState; newEvents: TEvent[]; ref: EntityRef }) => Promise<void>;
};

export async function runEntity<...>(opts: EntityExecutorOptions<...>) {
  const handler = CommandHandler({ evolve: opts.dispatch.evolve, initialState: opts.dispatch.initialState });
  const result = await handler(opts.store, opts.ref.toStreamName(), (state) => {
    const events = opts.dispatch.decide(opts.command, state);
    return events;
  });
  await opts.afterCommit?.({ newState: result.newState, newEvents: result.newEvents, ref: opts.ref });
  return { newState: result.newState, newEvents: result.newEvents };
}
```

Replaces ad-hoc command wiring when using Entity Kit. Shared low-level helper with **`runCommand`** ([minimal path spec](./Emmett-Adapters.spec.md)).

### 6.5 `defineEntityReadModel`

```typescript
export function defineEntityReadModel<Doc extends Document, Evt extends Event>(config: {
  name: string;                    // persisted — e.g. "daily_task"
  schemaVersion: number;
  canHandle: Evt["type"][] | string[];
  initialReadModel: () => Doc;
  projectReadModel: (doc: Doc, event: MongoDBReadEvent<Evt>) => Doc | null;
}) {
  return mongoDBInlineProjection<Doc, Evt>({
    name: config.name,
    schemaVersion: config.schemaVersion,
    canHandle: config.canHandle,
    initialState: config.initialReadModel,
    evolve: config.projectReadModel,   // Emmett wire — not exported as public name
  });
}
```

### 6.6 `toEmmettError` — Outcome → Emmett error mapping

`fastApiErrorMiddleware.ts` does **content-based status code routing** for `IllegalStateError` (message containing `"not found"` → 404, `"invalid"`/`"validation"` → 422, otherwise → 400). To produce correct HTTP status codes, `toEmmettError` must map `Outcome.code` to the **correct Emmett error class** — not always `IllegalStateError`:

```typescript
export function toEmmettError(outcome: Outcome<never>): never {
  switch (outcome.code) {
    case "not_found":
      throw new NotFoundError({ args: { reason: outcome.error } });
    case "validation":
      throw new ValidationError(String(outcome.error));
    case "illegal":
    default:
      throw new IllegalStateError(String(outcome.error));
  }
}
```

| `Outcome.code` | Emmett error class | HTTP status (via middleware) |
| -------------- | ------------------ | --------------------------- |
| `"not_found"` | `NotFoundError` | 404 |
| `"validation"` | `ValidationError` | 400 |
| `"illegal"` (default) | `IllegalStateError` | 400 |

Additional middleware mappings (not from Outcome): `ZodError` → 422, `ConcurrencyError` → 412.

---

## 7. End-to-end example (DailyTask)

```typescript
// DailyTask.ts
export class DailyTask extends EntityRoot<DailyTaskState, DailyTaskDomainEvent> {
  Create(command: CreateDailyTaskCommand): Outcome<DailyTaskCreatedEvent> {
    if (this.state.lifecycle !== "Empty") {
      return Outcome.fail("Daily task already exists.", "illegal");
    }
    // ... validation ...
    return this.record({ type: "DailyTaskCreated", data: { ... } });
  }
}

// DailyTaskDispatch.ts
export const DailyTaskDispatch = {
  initialState: (): DailyTaskState => ({ lifecycle: "Empty" }),
  evolve: (state, event) => DailyTask.fromState(state).replayState(event),
  decide(command, state) {
    const entity = DailyTask.fromState(state);
    const outcome = dispatchCommand(entity, command); // switch on command.type
    if (!outcome.ok) throw toEmmettError(outcome);
    return outcome.value;
  },
};

// DailyTaskReadModelProjection.ts
export const dailyTaskReadModelProjection = defineEntityReadModel({
  name: DAILY_TASK_READ_MODEL_NAME, // "daily_task" — persisted
  schemaVersion: 1,
  canHandle: ["DailyTaskCreated", "DailyTaskUpdated", "DailyTaskDeleted"],
  initialReadModel: () => ({ ... }),
  projectReadModel(doc, event) {
    switch (event.type) {
      case "DailyTaskCreated": return { ... };
      case "DailyTaskDeleted": return null;
      default: return doc;
    }
  },
});
```

---

## 8. Persisted-string rules

Entity Kit MUST NOT alter any persisted string. Complete inventory:

### 8.1 Stream types

| Module | Constant | Value | Collection |
| ------ | -------- | ----- | ---------- |
| `task` | `TASK_STREAM_TYPE` | `"task"` | `emt:task` |
| `dailyTask` | `DAILY_TASK_STREAM_TYPE` | `"dailyTask"` | `emt:dailyTask` |
| `project` | `PROJECT_STREAM_TYPE` | `"project"` | `emt:project` |
| `settings` | `SETTINGS_STREAM_TYPE` | `"settings"` | `emt:settings` |
| `views` | `DATABASE_VIEW_STREAM_TYPE` | `"databaseView"` | `emt:databaseView` |

### 8.2 Event types (11 total)

| Module | Event types |
| ------ | ----------- |
| `task` | `"TaskCreated"`, `"TaskUpdated"`, `"TaskDeleted"` |
| `dailyTask` | `"DailyTaskCreated"`, `"DailyTaskUpdated"`, `"DailyTaskDeleted"` |
| `project` | `"ProjectCreated"` |
| `settings` | `"SettingUpserted"` |
| `views` | `"DatabaseViewCreated"`, `"DatabaseViewConfigUpdated"`, `"DatabaseViewDeleted"` |

> **Note:** `views` uses `DatabaseViewConfigUpdated` (not `DatabaseViewUpdated`).

### 8.3 Projection / read-model names

| Module | Constant (live) | Value |
| ------ | --------------- | ----- |
| `task` | `TASK_LIST_PROJECTION_NAME` | `"task_list"` |
| `dailyTask` | `DAILY_TASK_PROJECTION_NAME` | `"daily_task"` |
| `project` | `PROJECT_LIST_PROJECTION_NAME` | `"project_list"` |
| `settings` | `SETTINGS_PROJECTION_NAME` | `"settings_map"` |
| `views` | `DATABASE_VIEW_LIST_PROJECTION_NAME` | `"database_view_list"` |

Entity Kit introduces `*_READ_MODEL_NAME` as the naming convention for new constants. Existing `*_PROJECTION_NAME` constants are NOT renamed — only the persisted string value matters.

### 8.4 Command types

`"CreateTask"`, `"UpdateTask"`, `"DeleteTask"`, `"CreateDailyTask"`, `"UpdateDailyTask"`, `"DeleteDailyTask"`, `"CreateProject"`, `"UpsertSetting"`, `"CreateDatabaseView"`, `"UpdateDatabaseViewConfig"`, `"DeleteDatabaseView"`.

Renaming TypeScript aliases (`DailyTaskCreatedEvent`) is fine. Renaming string literals requires migration.

---

## 9. Relationship to other specs

| Document | Relationship |
| -------- | ------------ |
| [Emmett-Adapters.spec.md](./Emmett-Adapters.spec.md) | Minimal path: functional deciders + optional `runCommand`. Use for legacy modules **not** adopting Entity Kit. |
| **This spec** | Full path: `EntityRoot` + `Outcome` + `projectReadModel`. |
| [DDD-Framework-vs-Emmett.md](./DDD-vs-Emmett.md) | Concept map; add Entity Kit column when implementing. |

**Do not mix** functional deciders and `EntityRoot` in the same entity module after migration.

**Cross-module migration ordering:** `taskSideEffects.onTaskDeleted` cascade-deletes linked daily tasks via `dailyTaskCommandHandler`. If task migrates to Entity Kit before dailyTask (or vice versa), the side-effect module must call the correct handler for each module's current path. Plan migration order for coupled modules together.

---

## 10. Testing

| Layer | Tool |
| ----- | ---- |
| Entity methods | Unit test `Create`/`Update`/`Delete` returning `Outcome` |
| Dispatch bridge | `DeciderSpecification` on `DailyTaskDispatch.decide`/`evolve` |
| Read model | `MongoDBInlineProjectionSpec` + `projectReadModel` |
| HTTP | `supertest` + existing app; `EntityExecutor` transparent |
| Persisted strings | Snapshot test on `READ_MODEL_NAME`, stream type, event type constants |

---

## 11. Migration phases

1. **Land `es-kit/`** — Outcome, EntityRef, EntityRoot, EntityExecutor, defineEntityReadModel, toEmmettError. Tests only.
2. **Pilot one entity** — DailyTask (or Task): class + Dispatch + ReadModel projection rename.
3. **Opportunistic** — other modules when touched.
4. **Do not migrate** — persisted strings, bulk-sync loops, EAV side effects logic (only wiring via `EntityReactions`).

### 11.1 Migration checklist (per module)

- [ ] Create `XxxDispatch.ts` (new `decide` bridge — today's `decide` is dead code; see §2.4 note)
- [ ] Wrap route handlers with `asyncHandler()` (from `platform/fastApiErrorMiddleware.ts`) if not already
- [ ] Register new projection in `platform/projections.ts` central array
- [ ] Check for cross-module side effects (e.g. `taskSideEffects.onTaskDeleted` cascades to dailyTask)
- [ ] Verify `toEmmettError` maps `Outcome.code` to correct error class (see §6.6)
- [ ] Snapshot-test persisted string constants

---

## 12. Glossary (quick reference)

```
EntityRoot           aggregate base class
EntityRef            stream identity (NOT AggregateId)
Outcome<T>           success/failure (NOT Result<T>)
record(event)        domain records a fact (NOT Apply)
replay(event)        fold into entity state (NOT When)
projectReadModel     fold into read model (NOT projection When)
EntityExecutor       run one command (NOT CommandPipeline)
EntityReactions      cross-stream handlers (NOT IntegrationPipeline)
XxxDispatch          Emmett decide/evolve bridge (only Emmett names here)
defineEntityReadModel  projection registration helper
XxxReadModel         query document type (NOT XxxProjection class)
```

---

**Version**: 1.1 (Set A locked — enriched with live code audit)
**Last updated**: 2026-05-28
