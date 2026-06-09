# Emmett — Getting Started Guide

> **Audience**: Developers building side projects with Emmett
> **Official source**: [Emmett Getting Started](https://event-driven-io.github.io/emmett/getting-started.html)
> **Last Updated**: 2026-05-25

## Overview

Emmett is a TypeScript Event Sourcing framework that keeps the ceremony low. Instead of class hierarchies and middleware pipelines, you compose **pure functions**:

- **`decide(command, state)`** — validate and emit events
- **`evolve(state, event)`** — fold events into state
- **`CommandHandler({ evolve, initialState })`** — read → decide → append

If you know a traditional DDD framework, think of Emmett as the same CQRS/ES ideas with a **functional Decider** instead of `AggregateRoot` + `@SerializableType`.

---

## Prerequisites

- Node.js 20+ (LTS recommended)
- pnpm (recommended — use it for side projects too)
- For production: MongoDB 6+ (default adapter in these guides)

---

## Quick Start — New Side Project

```powershell
mkdir my-emmett-app
cd my-emmett-app
pnpm init
pnpm add @event-driven-io/emmett
pnpm add -D typescript vitest @types/node
```

For a full web app with MongoDB:

```powershell
pnpm add @event-driven-io/emmett @event-driven-io/emmett-mongodb @event-driven-io/emmett-expressjs express mongodb
pnpm add -D typescript vitest @types/express @types/node @testcontainers/mongodb
```

---

## Recommended Project Structure

```
src/
├── shoppingCart/
│   ├── domain/
│   │   ├── events.ts          # Event union types
│   │   ├── commands.ts        # Command union types
│   │   ├── state.ts           # State discriminated union
│   │   └── decider.ts         # decide, evolve, initialState
│   ├── api/
│   │   └── shoppingCartApi.ts # Express routes + dependency injection
│   ├── projections/
│   │   ├── shoppingCartSummary.ts
│   │   └── clientSummary.ts
│   ├── integration/           # Cross-module reactions (optional)
│   │   └── onOrderConfirmed.ts
│   └── __tests__/
│       ├── decider.spec.ts
│       ├── api.spec.ts
│       └── projections.spec.ts
├── app.ts                     # getApplication + startAPI
└── index.ts
```

**Stream naming convention** — use Emmett's `toStreamName` helper:

```typescript
import { toStreamName } from '@event-driven-io/emmett-mongodb';

export const getShoppingCartStreamId = (clientId: string) =>
  toStreamName('shopping_cart', `${clientId}:current`);
// → "shopping_cart:abc-123:current"
```

MongoDB stores streams in collections prefixed `emt:` (e.g. `emt:shopping_cart`).

---

## Core Concepts

### 1. Events

Events are immutable facts. Use Emmett's `Event` helper for type safety:

```typescript
import type { Event } from '@event-driven-io/emmett';

export type ProductItemAddedToShoppingCart = Event<
  'ProductItemAddedToShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
    addedAt: Date;
  }
>;

export type ShoppingCartEvent =
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed
  | ShoppingCartCancelled;
```

**Conventions:**
- Event type strings are **past tense** facts
- Group all events in a union type per aggregate/stream type
- Payload fields are read-only in the type definition

### 2. Commands

Commands express business intent (imperative names):

```typescript
import type { Command } from '@event-driven-io/emmett';

export type AddProductItemToShoppingCart = Command<
  'AddProductItemToShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
  }
>;

export type ShoppingCartCommand =
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | ConfirmShoppingCart
  | CancelShoppingCart;
```

**Conventions:**
- Command type strings are **imperative** (`Add…`, `Confirm…`, `Cancel…`)
- HTTP layer validates input; domain `decide()` trusts command shape
- Pass `metadata: { now, userId, clientId }` for audit and projection correlation

### 3. State

Keep state **minimal** — only what `decide()` needs:

```typescript
export type EmptyShoppingCart = { status: 'Empty' };
export type OpenedShoppingCart = { status: 'Opened'; productItems: ProductItems };
export type ClosedShoppingCart = { status: 'Closed' };

export type ShoppingCart =
  | EmptyShoppingCart
  | OpenedShoppingCart
  | ClosedShoppingCart;
```

Use discriminated unions (`status` field) instead of class hierarchies.

### 4. Decider — `decide` and `evolve`

```typescript
import { EmmettError, IllegalStateError } from '@event-driven-io/emmett';

// Per-command handlers (optional decomposition)
export const addProductItem = (
  command: AddProductItemToShoppingCart,
  state: ShoppingCart,
): ProductItemAddedToShoppingCart => {
  if (state.status === 'Closed')
    throw new IllegalStateError('Shopping Cart already closed');

  const { data: { shoppingCartId, productItem }, metadata } = command;

  return {
    type: 'ProductItemAddedToShoppingCart',
    data: { shoppingCartId, productItem, addedAt: metadata?.now ?? new Date() },
  };
};

// Router
export const decide = (command: ShoppingCartCommand, state: ShoppingCart) => {
  switch (command.type) {
    case 'AddProductItemToShoppingCart': return addProductItem(command, state);
    // ...
    default: {
      const _exhaustive: never = command.type;
      throw new EmmettError('Unknown command type');
    }
  }
};

// State fold — pure, no throws, no IO
export const evolve = (state: ShoppingCart, event: ShoppingCartEvent): ShoppingCart => {
  switch (event.type) {
    case 'ProductItemAddedToShoppingCart':
      // mutate state based on event
      return { status: 'Opened', productItems: /* ... */ };
    case 'ShoppingCartConfirmed':
    case 'ShoppingCartCancelled':
      return { status: 'Closed' };
    default:
      return state;
  }
};

export const initialState = (): ShoppingCart => ({ status: 'Empty' });
```

**Critical rules:**

| Function | May throw? | May IO? | Returns |
| -------- | ---------- | ------- | ------- |
| `decide` | Yes (`IllegalStateError`, `ValidationError`) | No | Event or Event[] |
| `evolve` | No | No | New state |
| `initialState` | No | No | Empty state |

### 5. Command Handling

```typescript
import { CommandHandler } from '@event-driven-io/emmett';

export const handle = CommandHandler({ evolve, initialState });

// Usage
await handle(eventStore, streamId, (state) => addProductItem(command, state));
```

Internally: `aggregateStream` → `decide` → `appendToStream` with optimistic concurrency.

### 6. Event Store

Three core methods:

| Method | Purpose |
| ------ | ------- |
| `readStream(streamId, options?)` | Read events (optional version range) |
| `appendToStream(streamId, events, { expectedStreamVersion })` | Atomic append with concurrency check |
| `aggregateStream(streamId, { evolve, initialState })` | Rebuild current state + version |

**Implementations:**

| Package | Store |
| ------- | ----- |
| `@event-driven-io/emmett` | In-memory (dev/tests) |
| `@event-driven-io/emmett-mongodb` | **MongoDB (default in these guides)** |
| `@event-driven-io/emmett-postgresql` | PostgreSQL + Pongo |
| `@event-driven-io/emmett-esdb` | EventStoreDB |
| `@event-driven-io/emmett-sqlite` | SQLite |

```typescript
// Development
import { getInMemoryEventStore } from '@event-driven-io/emmett';
const eventStore = getInMemoryEventStore();

// Production (MongoDB)
import { getMongoDBEventStore } from '@event-driven-io/emmett-mongodb';

const eventStore = getMongoDBEventStore({
  connectionString:
    process.env.MONGODB_CONNECTION_STRING ?? 'mongodb://localhost:27017/mydb',
});
```

> Use **one event store instance per application**. Call `eventStore.close()` on shutdown when using `connectionString` (not when passing an external `MongoClient`).

---

## HTTP API with Express

```powershell
pnpm add @event-driven-io/emmett-expressjs express
```

### Application bootstrap

```typescript
import { getInMemoryEventStore } from '@event-driven-io/emmett';
import { getApplication, startAPI } from '@event-driven-io/emmett-expressjs';
import { shoppingCartApi } from './shoppingCart/api/shoppingCartApi';

const eventStore = getInMemoryEventStore();

const application = getApplication({
  apis: [shoppingCartApi(eventStore, getUnitPrice, () => new Date())],
});

const server = startAPI(application); // default port 3000
```

`getApplication` provides:
- JSON / URL encoding middleware
- RFC 9457 Problem Details error mapping
- ETag support for optimistic concurrency

### Error → HTTP status mapping (built-in)

| Emmett Error | HTTP Status |
| ------------ | ----------- |
| `ValidationError` | 400 |
| `IllegalStateError` | 403 |
| `NotFoundError` | 404 |
| `ConcurrencyError` | 412 |

### Route pattern with `on()`

```typescript
import { on, NoContent } from '@event-driven-io/emmett-expressjs';
import { CommandHandler } from '@event-driven-io/emmett';

export const shoppingCartApi =
  (
    eventStore: EventStore,
    getUnitPrice: (productId: string) => Promise<number>,
    getCurrentTime: () => Date,
  ): WebApiSetup =>
  (router) => {
    const handle = CommandHandler({ evolve, initialState });

    router.post(
      '/clients/:clientId/shopping-carts/current/product-items',
      on(async (request) => {
        const shoppingCartId = getShoppingCartStreamId(
          assertNotEmptyString(request.params.clientId),
        );
        const productId = assertNotEmptyString(request.body.productId);

        const command: AddProductItemToShoppingCart = {
          type: 'AddProductItemToShoppingCart',
          data: {
            shoppingCartId,
            productItem: {
              productId,
              quantity: assertPositiveNumber(request.body.quantity),
              unitPrice: await getUnitPrice(productId),
            },
          },
          metadata: { now: getCurrentTime() },
        };

        await handle(eventStore, shoppingCartId, (state) =>
          addProductItem(command, state),
        );

        return NoContent();
      }),
    );
  };
```

**Design principle:** inject all external dependencies from the top (`eventStore`, `getUnitPrice`, `getCurrentTime`) — makes testing trivial.

---

## Testing

Emmett supports three testing levels. For side projects, favor **Decider unit tests** + **ApiSpecification integration tests**.

### Level 1 — Decider unit tests (`DeciderSpecification`)

```typescript
import { DeciderSpecification } from '@event-driven-io/emmett';

const given = DeciderSpecification.for({ decide, evolve, initialState });

void describe('ShoppingCart', () => {
  void it('should add product item to empty cart', () => {
    given([])
      .when({
        type: 'AddProductItemToShoppingCart',
        data: { shoppingCartId, productItem },
        metadata: { now },
      })
      .then([{
        type: 'ProductItemAddedToShoppingCart',
        data: { shoppingCartId, productItem, addedAt: now },
      }]);
  });

  void it('should reject add when closed', () => {
    given([/* existing events */])
      .when({ type: 'AddProductItemToShoppingCart', /* ... */ })
      .thenThrows((e: Error) => e.message === 'Shopping Cart already closed');
  });
});
```

Pattern: **GIVEN** events → **WHEN** command → **THEN** new events or thrown error.

### Level 2 — API integration tests (`ApiSpecification`)

In-memory event store + SuperTest — verifies HTTP mapping and middleware:

```typescript
import { ApiSpecification, getApplication, existingStream, expectNewEvents, expectError } from '@event-driven-io/emmett-expressjs';

const given = ApiSpecification.for<ShoppingCartEvent>(
  () => getInMemoryEventStore(),
  (eventStore) => getApplication({ apis: [shoppingCartApi(eventStore, /* stubs */)] }),
);

void it('should confirm opened cart', () =>
  given(existingStream(shoppingCartId, [/* events */]))
    .when((req) => req.post(`/clients/${clientId}/shopping-carts/current/confirm`))
    .then([
      expectResponse(204),
      expectNewEvents(shoppingCartId, [{ type: 'ShoppingCartConfirmed', /* ... */ }]),
    ]),
);
```

### Level 3 — E2E with real MongoDB (`ApiE2ESpecification` + TestContainers)

```typescript
import { MongoDBContainer } from '@testcontainers/mongodb';
import { getMongoDBEventStore } from '@event-driven-io/emmett-mongodb';
import { ApiE2ESpecification } from '@event-driven-io/emmett-expressjs';

beforeAll(async () => {
  const container = await new MongoDBContainer('mongo:7').start();
  eventStore = getMongoDBEventStore({ connectionString: container.getConnectionString() });
});

afterAll(async () => {
  await eventStore.close();
  await container.stop();
});
```

---

## Read Models & Projections

Rebuilding state from all streams on every query does not scale. **Inline projections** materialize read models atomically when events are appended — stored in the same MongoDB stream document as the events.

### Inline projection (MongoDB)

One stream → one inline read model embedded in the stream document.

```typescript
import { projections } from '@event-driven-io/emmett';
import { mongoDBInlineProjection, getMongoDBEventStore } from '@event-driven-io/emmett-mongodb';

type ShoppingCartSummary = {
  productItemsCount: number;
  totalAmount: number;
};

const shoppingCartSummaryProjection = mongoDBInlineProjection<
  ShoppingCartSummary,
  ShoppingCartEvent
>({
  name: 'shopping_cart_summary',
  canHandle: ['ProductItemAddedToShoppingCart', 'ProductItemRemovedFromShoppingCart'],
  initialState: () => ({ productItemsCount: 0, totalAmount: 0 }),
  evolve: (document, event) => {
    switch (event.type) {
      case 'ProductItemAddedToShoppingCart': {
        const { quantity, unitPrice } = event.data.productItem;
        return {
          productItemsCount: document.productItemsCount + quantity,
          totalAmount: document.totalAmount + quantity * unitPrice,
        };
      }
      default:
        return document;
    }
  },
});

const eventStore = getMongoDBEventStore({
  connectionString: process.env.MONGODB_CONNECTION_STRING!,
  projections: projections.inline([shoppingCartSummaryProjection]),
});
```

### Cross-stream / analytics read models

The MongoDB adapter stores **inline projections per stream**. For client-level analytics spanning many carts, use one of:

1. **Message bus reactor** — subscribe to events, update a separate MongoDB collection
2. **Integration handler** — react in `integration/` and call `handle()` on a summary stream
3. **MongoDB aggregation** — query across `emt:shopping_cart` collection at read time (small datasets)

See [Masterplans/5-Integration.md](./Masterplans/5-Integration.md) for the message bus pattern.

### Query inline projections from API

```typescript
import type { MongoDBEventStore } from '@event-driven-io/emmett-mongodb';

router.get('/clients/:clientId/shopping-carts/:id/summary', on(async (request) => {
  const streamId = getShoppingCartStreamId(request.params.clientId);

  const summary = await eventStore.projections.inline.findOne<ShoppingCartSummary>(
    { streamName: streamId },
    {},
    { projectionName: 'shopping_cart_summary' },
  );

  if (!summary) return notFound({ detail: 'Shopping cart not found' });
  return ok(summary);
}));

// List carts with filter across stream type
router.get('/clients/:clientId/shopping-carts', on(async () => {
  const carts = await eventStore.projections.inline.find<ShoppingCartSummary>(
    { streamType: 'shopping_cart' },
    { totalAmount: { $gte: 100 } },
    { limit: 20, sort: { totalAmount: -1 } },
  );
  return ok({ carts });
}));
```

### Projection testing

Use real MongoDB via TestContainers + `MongoDBInlineProjectionSpec`:

```typescript
import {
  MongoDBInlineProjectionSpec,
  eventInStream,
  expectInlineReadModel,
} from '@event-driven-io/emmett-mongodb';
import { MongoDBContainer } from '@testcontainers/mongodb';

const given = MongoDBInlineProjectionSpec.for({
  projection: shoppingCartSummaryProjection,
  connectionString: container.getConnectionString(),
});

await given([])
  .when([{
    type: 'ProductItemAddedToShoppingCart',
    data: { productItem: { productId: 'shoes', quantity: 2, unitPrice: 50 }, shoppingCartId: cartId, addedAt: now },
  }])
  .then(
    expectInlineReadModel
      .withName('shopping_cart_summary')
      .toHave({ productItemsCount: 2, totalAmount: 100 }),
  );
```

**Delete read models:** return `null` from projection `evolve` — MongoDB removes the inline projection atomically.

---

## Production Checklist

- [ ] Switch from `getInMemoryEventStore()` to `getMongoDBEventStore()`
- [ ] Set `MONGODB_CONNECTION_STRING` via environment variable
- [ ] Register inline projections with `projections.inline([...])`
- [ ] Use `toStreamName(streamType, streamId)` for all stream IDs
- [ ] Inject `getCurrentTime` for deterministic tests
- [ ] Document stream type + ID conventions per aggregate
- [ ] Add `DeciderSpecification` tests for all business rules
- [ ] Add `ApiSpecification` tests for critical HTTP flows
- [ ] Call `eventStore.close()` on graceful shutdown
- [ ] Pass correlation metadata (`clientId`, `userId`) on commands for cross-stream reactions

---

## Next Steps

| Topic | Guide |
| ----- | ----- |
| Step-by-step aggregate implementation | [Masterplans/README.md](./Masterplans/README.md) |
| DDD concept mapping | [DDD-Framework-vs-Emmett.md](./DDD-vs-Emmett.md) |
| Agent-driven implementation | `.cursor/rules/Backend/emmett-masterplan/` |

## External Links

- [Official Getting Started](https://event-driven-io.github.io/emmett/getting-started.html)
- [Emmett GitHub](https://github.com/event-driven-io/emmett)
- [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Martin Thwaites — Building Operable Software with TDD](https://www.youtube.com/watch?v=Jhg9eDBF500) (recommended by Emmett docs)
