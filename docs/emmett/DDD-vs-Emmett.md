# Traditional DDD Framework vs Emmett

> **Purpose**: Help developers map familiar DDD patterns to Emmett for side projects
> **Emmett reference**: [Getting Started](./Getting-Started.md)

## Philosophy

| Aspect | Traditional DDD Framework | Emmett |
| ------ | ------------------------- | ------ |
| Style | Class-based aggregates, TypeDI, middleware pipeline | Functional Deciders, composition, thin adapters |
| Validation | `Result<T>` — never throw in domain | Throw in `decide()`; Problem Details at HTTP boundary |
| Serialization | Zod + `@SerializableType` registry | Plain TypeScript types + `Event`/`Command` helpers |
| DI | TypeDI containers per API | Constructor injection / top-level function params |
| Event store | MongoDB (KurrentDB option) | MongoDB (default), PostgreSQL, EventStoreDB, SQLite, in-memory |
| Read models | MongoDB projections + Framework UI | MongoDB inline projections + query routes |
| Testing | Jest + builders + DI integration tests | Vitest + DeciderSpecification + ApiSpecification |

Both are Event Sourcing + CQRS. The **business rules live in the same place conceptually** — between command and event — but the packaging differs.

---

## Concept Mapping

### Domain Layer

| Traditional DDD | Emmett | Notes |
| --------------- | ------ | ----- |
| `AggregateRoot` class | `decide` + `evolve` + `initialState` | No base class; state is a typed record/union |
| `When(event)` | `evolve(state, event)` | Pure state fold |
| `Apply(event)` | Return event from `decide()` | Handler appends |
| `EnsureEventValidState` | Guards at start of `decide()` handlers | Throws `IllegalStateError` |
| `EnsureAggregateValidState` | Guards after state transition in `decide()` | Or validate in `evolve` for rebuild safety |
| `Result<Unit>` return | Throw or return `[]` for idempotent no-op | No Result type in Emmett core |
| Value Object classes | Plain types / branded types | Optional Zod at HTTP boundary only |
| `@SerializableType` events | `Event<'EventName', Payload>` union | String literal discriminant |
| `DomainEventMetadata` | Event `metadata` bag | Set by infrastructure / HTTP layer |
| `AggregateId` + prefix | `toStreamName(streamType, streamId)` → `shopping_cart:id` |
| `GetTags()` | Command/event `metadata` | Used for uniqueness and projection correlation |

### Application Layer

| Traditional DDD | Emmett | Notes |
| --------------- | ------ | ----- |
| Command classes (`ICommand`) | Command union types | No Serialize() needed |
| `ICreateCommandHandler` / `IUpdateCommandHandler` (8 variants) | Single `CommandHandler` + route-specific `(state) => decide(...)` | One handler per stream type |
| `BuildAggregateId` | Stream ID from route params / command data | Explicit helper function |
| `CommandPipeline.Execute()` | `handle(eventStore, streamId, deciderFn)` | No middleware stack |
| `CommandHandlerProperties` | Route registration via `on()` | No registry |
| Process handlers (`ICommandProcessHandler`) | Multiple `handle()` calls or saga module | Manual orchestration |
| Uniqueness constraint handlers | Check in `decide()` or pre-query read model | No built-in tag uniqueness |
| Command template generators | OpenAPI / manual forms | No Framework UI |

### Projections

| Traditional DDD | Emmett | Notes |
| --------------- | ------ | ----- |
| `XXXProjection` class | Read model type + `evolve` function | Plain object/document |
| `ISingleAggregateProjectionHandler` | `mongoDBInlineProjection` | Read model stored in stream document |
| `ICrossAggregateProjectionHandler` | Message bus reactor or integration handler | MongoDB adapter has no multi-stream inline helper |
| `ProjectionResult.Applied/NotApplied` | Return updated doc or `null` (delete) | |
| `ProjectionRunner` async workers | `projections.inline()` only (MongoDB) | Inline = atomic with append |
| MongoDB projection store | Same MongoDB — inline in stream doc or separate collection via bus | Familiar storage pattern |

### Integration

| Traditional DDD | Emmett | Notes |
| --------------- | ------ | ----- |
| `IntegrationPipeline` + `PublicEvent` | Event subscription / `$all` / HTTP callbacks | No built-in cross-service bus |
| `ISingleEventIntegrationHandler` | Subscriber function → `handle()` on target stream | |
| `CommandPipeline.Execute()` in handler | `handle(eventStore, streamId, ...)` | Same pattern, different API |
| `EventIntegrationContainer` DI | App bootstrap registration | Functional registration |

### HTTP / Web API

| Traditional DDD | Emmett | Notes |
| --------------- | ------ | ----- |
| Express controllers + TypeDI routers | `WebApiSetup` function + `on()` wrapper | Dependencies injected at top |
| Custom error middleware | RFC 9457 Problem Details built-in | |
| JWT auth middleware | Bring your own middleware | Emmett doesn't prescribe auth |
| ETag / concurrency | Built into `emmett-expressjs` | Maps to `expectedStreamVersion` |

### Testing

| Traditional DDD | Emmett | Notes |
| --------------- | ------ | ----- |
| Domain unit tests (Jest) | `DeciderSpecification` (Vitest) | Given events / When command / Then events |
| DI integration tests | `ApiSpecification` (in-memory) | Given streams / When HTTP / Then events |
| Full DI + MongoDB | `ApiE2ESpecification` + TestContainers | Real MongoDB via `@testcontainers/mongodb` |
| Test builders | `existingStream`, `eventsInStream` helpers | |

---

## Side-by-Side: Create Flow

### Traditional DDD Framework

```
HTTP POST → Controller → CommandPipeline
  → Load aggregate (MongoDB events)
  → CreateXXXCommandHandler.Initialize()
  → aggregate.Create() → Apply(XXXCreatedEvent)
  → Save events + run projections async
  → Return 200 + aggregate ID
```

### Emmett

```
HTTP POST → on() handler
  → Map request → Command object
  → handle(eventStore, streamId, state => decide(cmd, state))
    → aggregateStream (read + evolve)
    → decide → events
    → appendToStream (+ inline projections)
  → Return 204 NoContent
```

---

## What You Leave Behind (and That's OK for Side Projects)

When using Emmett instead of the traditional DDD framework, you intentionally skip:

- `@SerializableType` arity rules and Zod `.transform()` registry
- TypeDI container registration per bounded context
- Framework command templates and visualization
- Command middleware pipeline (logging, auth, metrics hooks)
- `Result<T>` propagation chains
- Cross-API Integration Pipeline infrastructure
- Snapshot workers and projection workers (unless you add them)

---

## What You Keep (Mental Model)

- Events as source of truth
- Commands as intentions, events as facts
- Optimistic concurrency on stream version
- Projections for query performance
- Given/When/Then testing style
- Bounded context module boundaries
- Explicit dependency injection for testability

---

## Migration Path: DDD Spec → Emmett Side Project

1. **Extract the ubiquitous language** — aggregate name, events, commands, invariants (same as Phase 2 of agg-masterplan)
2. **Replace classes with types** — state union, event union, command union
3. **Port `When()` → `evolve()`** — pure, no validation
4. **Port domain methods → `decide()` handlers** — `Result.Fail` → `throw new IllegalStateError`
5. **Replace handler classes → routes + `CommandHandler`**
6. **Replace projection classes → `mongoDBInlineProjection` definitions**
7. **Replace integration handlers → subscription modules calling `handle()`**

See [Masterplans/README.md](./Masterplans/README.md) for step-by-step templates.
