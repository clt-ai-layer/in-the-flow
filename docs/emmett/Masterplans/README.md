# Emmett Masterplans

> Step-by-step guides for implementing a full vertical slice in Emmett.
> **Default adapter**: MongoDB (`@event-driven-io/emmett-mongodb`)
> **Structural template**: DDD [agg-masterplan](../../../../.cursor/rules/Backend/agg-masterplan/) series
> **Agent rules**: `.cursor/rules/Backend/emmett-masterplan/`

## Series Overview

Implement aggregates in this order:

| Step | Guide | Layer |
| ---- | ----- | ----- |
| 1 | [1-Domain.md](./1-Domain.md) | State, events, commands, Decider |
| 2 | [2-Commands-and-API.md](./2-Commands-and-API.md) | CommandHandler, HTTP routes, API tests |
| 3 | [3-Projections.md](./3-Projections.md) | MongoDB inline projections, query routes |
| 5 | [5-Integration.md](./5-Integration.md) | Cross-module reactions via message bus |

> Part 4 (Visualization) from the DDD masterplan is omitted — Emmett side projects use query APIs or a separate frontend, not Framework UI.

## Template Variables

Use these placeholders consistently across all parts:

```typescript
AGGREGATE = "ShoppingCart";
STREAM_TYPE = "shopping_cart";           // MongoDB stream type → collection emt:shopping_cart
MODULE = "src/shoppingCart";
DOMAIN = "src/shoppingCart/domain";
API = "src/shoppingCart/api";
PROJECTIONS = "src/shoppingCart/projections";
INTEGRATION = "src/shoppingCart/integration";
EVENT_STORE = "mongodb";                 // mongodb | postgresql | esdb | memory
HTTP_ADAPTER = "express";                // express (emmett-expressjs)
```

## Pre-Execution (Before Any Implementation)

Same gates as the DDD agg-masterplan:

1. **Confirm scope** — side project module name, aggregate purpose, stream naming
2. **Present Requirement Understanding Verification** — aggregate summary, operations, rules, relationships
3. **Wait for user confirmation** before generating code

## End-to-End File Generation Order

1. `domain/state.ts` — state discriminated union
2. `domain/events.ts` — event union
3. `domain/commands.ts` — command union
4. `domain/streams.ts` — `toStreamName` helper
5. `domain/decider.ts` — `decide`, `evolve`, `initialState`
6. `domain/decider.spec.ts` — DeciderSpecification tests
7. `projections/*.projection.ts` — `mongoDBInlineProjection` definitions
8. `api/{aggregate}Api.ts` — routes + CommandHandler
9. `api/{aggregate}.api.spec.ts` — ApiSpecification tests
10. `projections/*.spec.ts` — MongoDBInlineProjectionSpec tests
11. `integration/{reaction}.ts` — optional message bus / cross-stream handlers
12. `app.ts` — wire MongoDB event store, inline projections, APIs

## Quick Links

- [Getting Started](../Getting-Started.md)
- [DDD Framework vs Emmett](../DDD-vs-Emmett.md)
- [MongoDB sample app](https://github.com/event-driven-io/emmett/tree/main/samples/webApi/expressjs-with-mongodb)
- [Official Emmett docs](https://event-driven-io.github.io/emmett/getting-started.html)
