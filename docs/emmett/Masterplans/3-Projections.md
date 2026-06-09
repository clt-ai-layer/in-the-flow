# Emmett Masterplan — Part 3: Projections

> Agent rule mirror: `.cursor/rules/Backend/emmett-masterplan/emmett-masterplan-3-projections.mdc`
> **Adapter**: MongoDB (`@event-driven-io/emmett-mongodb`)
> **Previous**: [2-Commands-and-API.md](./2-Commands-and-API.md) · **Next**: [5-Integration.md](./5-Integration.md)

---

## Template Variables

```typescript
PROJECTIONS = "src/shoppingCart/projections";
STREAM_TYPE = "shopping_cart";
```

---

## SECTION 3: PROJECTIONS & READ MODELS (MongoDB Inline)

The MongoDB adapter stores **inline projections** in the same stream document as events. They update atomically on append — no separate Pongo collection.

### MongoDB vs PostgreSQL (Pongo) — know the difference

| Aspect | MongoDB (these guides) | PostgreSQL (alternative) |
| ------ | ---------------------- | ------------------------ |
| Projection helper | `mongoDBInlineProjection` | `pongoSingleStreamProjection` |
| Storage | Embedded in stream document | Separate Pongo collection |
| Query API | `eventStore.projections.inline.find/findOne` | `pongoClient().db().collection()` |
| Multi-stream analytics | Message bus / separate collection | `pongoMultiStreamProjection` |
| Tests | `MongoDBInlineProjectionSpec` | `PostgreSQLProjectionSpec` |

---

### 3.1 Read Model Type

**File**: `PROJECTIONS/shoppingCartSummary.types.ts`

```typescript
export type ShoppingCartSummary = {
  productItemsCount: number;
  totalAmount: number;
  status: 'Open' | 'Closed';
};
```

**Rules:**
- Plain object type — no `_id` field (MongoDB adds `_metadata` internally)
- Denormalize fields needed for queries
- Match API response shape (strip `_metadata` if exposing externally)

---

### 3.2 Inline Projection

**File**: `PROJECTIONS/shoppingCartSummary.projection.ts`

```typescript
import { mongoDBInlineProjection } from '@event-driven-io/emmett-mongodb';
import type { ShoppingCartSummary } from './shoppingCartSummary.types';
import type { ShoppingCartEvent } from '../domain/events';

export const shoppingCartSummaryProjection = mongoDBInlineProjection<
  ShoppingCartSummary,
  ShoppingCartEvent
>({
  name: 'shopping_cart_summary',
  schemaVersion: 1,
  canHandle: [
    'ProductItemAddedToShoppingCart',
    'ProductItemRemovedFromShoppingCart',
    'ShoppingCartConfirmed',
    'ShoppingCartCancelled',
  ],
  initialState: (): ShoppingCartSummary => ({
    productItemsCount: 0,
    totalAmount: 0,
    status: 'Open',
  }),
  evolve: (document, event): ShoppingCartSummary | null => {
    switch (event.type) {
      case 'ProductItemAddedToShoppingCart': {
        const { quantity, unitPrice } = event.data.productItem;
        return {
          ...document,
          productItemsCount: document.productItemsCount + quantity,
          totalAmount: document.totalAmount + quantity * unitPrice,
        };
      }
      case 'ShoppingCartConfirmed':
        return { ...document, status: 'Closed' };
      case 'ShoppingCartCancelled':
        return null; // delete inline read model
      default:
        return document;
    }
  },
});
```

**Inline projection rules:**
- `name` identifies the projection within the stream document (default: `_default`)
- `canHandle` lists event type strings
- `initialState` avoids null document in `evolve`
- Return `null` to delete the inline read model
- Projection `evolve` is separate from domain `evolve`

---

### 3.3 Register Projections

**File**: `src/app.ts`

```typescript
import { projections } from '@event-driven-io/emmett';
import { getMongoDBEventStore } from '@event-driven-io/emmett-mongodb';
import { shoppingCartSummaryProjection } from './shoppingCart/projections/shoppingCartSummary.projection';

const eventStore = getMongoDBEventStore({
  connectionString: process.env.MONGODB_CONNECTION_STRING!,
  projections: projections.inline([shoppingCartSummaryProjection]),
  // storage: 'COLLECTION_PER_STREAM_TYPE'  // default — emt:shopping_cart
});
```

---

### 3.4 Query Routes

Query via the event store's inline projection API — no separate MongoClient needed for read models:

**File**: `API/shoppingCartApi.ts`

```typescript
import type { MongoDBEventStore } from '@event-driven-io/emmett-mongodb';
import { ok, notFound, on } from '@event-driven-io/emmett-expressjs';
import { getShoppingCartStreamId } from '../domain/streams';

export const shoppingCartApi =
  (eventStore: MongoDBEventStore, /* ... */): WebApiSetup =>
  (router) => {
    router.get(
      '/clients/:clientId/shopping-carts/current/summary',
      on(async (request) => {
        const streamId = getShoppingCartStreamId(request.params.clientId);

        const summary = await eventStore.projections.inline.findOne<ShoppingCartSummary>(
          { streamName: streamId },
          {},
          { projectionName: 'shopping_cart_summary' },
        );

        if (!summary) return notFound({ detail: 'Shopping cart not found' });
        return ok(summary);
      }),
    );

    router.get(
      '/shopping-carts',
      on(async (request) => {
        const minAmount = request.query.minAmount
          ? parseFloat(request.query.minAmount as string)
          : undefined;

        const carts = await eventStore.projections.inline.find<ShoppingCartSummary>(
          { streamType: 'shopping_cart' },
          minAmount ? { totalAmount: { $gte: minAmount } } : {},
          { limit: 50, sort: { totalAmount: -1 } },
        );

        return ok({ carts });
      }),
    );
  };
```

**Query filter options:**

| Method | Filter | Use |
| ------ | ------ | --- |
| `findOne({ streamName })` | Exact stream | Single entity read model |
| `findOne({ streamType, streamId })` | Type + ID parts | Alternative lookup |
| `find({ streamType }, mongoQuery)` | Across all streams of type | List/filter queries |
| `count({ streamType }, mongoQuery)` | Count matching | Pagination totals |

---

### 3.5 Cross-Stream Read Models

MongoDB inline projections are **per-stream**. For client-level analytics (many carts → one summary), use [5-Integration.md](./5-Integration.md):

- `getInMemoryMessageBus().subscribe()` → update a separate MongoDB collection
- Or explicit orchestration in API after command handling

---

### 3.6 Projection Tests (Real MongoDB)

**File**: `PROJECTIONS/shoppingCartSummary.spec.ts`

```typescript
import {
  MongoDBInlineProjectionSpec,
  eventInStream,
  expectInlineReadModel,
} from '@event-driven-io/emmett-mongodb';
import { MongoDBContainer } from '@testcontainers/mongodb';

void describe('ShoppingCartSummary projection', () => {
  let container: StartedMongoDBContainer;
  let given: MongoDBInlineProjectionSpec<ShoppingCartEvent>;
  let streamName: string;

  before(async () => {
    container = await new MongoDBContainer('mongo:7').start();
    given = MongoDBInlineProjectionSpec.for({
      projection: shoppingCartSummaryProjection,
      connectionString: container.getConnectionString(),
    });
  });

  after(async () => {
    await container.stop();
  });

  beforeEach(() => {
    streamName = `shopping_cart:test-${crypto.randomUUID()}`;
  });

  void it('creates summary on first product added', () =>
    given([])
      .when([{
        type: 'ProductItemAddedToShoppingCart',
        data: {
          productItem: { productId: 'shoes', quantity: 2, unitPrice: 50 },
          shoppingCartId: streamName,
          addedAt: new Date(),
        },
      }])
      .then(
        expectInlineReadModel
          .withName('shopping_cart_summary')
          .toHave({ productItemsCount: 2, totalAmount: 100, status: 'Open' }),
      ),
  );

  void it('removes summary on cancel', () =>
    given(
      eventInStream(streamName, {
        type: 'ProductItemAddedToShoppingCart',
        data: { productItem: { productId: 'shoes', quantity: 1, unitPrice: 100 }, shoppingCartId: streamName, addedAt: new Date() },
      }),
    )
      .when([{ type: 'ShoppingCartCancelled', data: { shoppingCartId: streamName, canceledAt: new Date() } }])
      .then(
        expectInlineReadModel.withName('shopping_cart_summary').notToExist(),
      ),
  );
});
```

**Projection test rules:**
- Test against **real MongoDB** (TestContainers)
- Pattern: GIVEN events → WHEN new events → THEN inline read model state
- Use `eventInStream` for seed data

---

## Projections Validation Checklist

- [ ] Read model type defined separately from projection logic
- [ ] Uses `mongoDBInlineProjection` (not Pongo helpers)
- [ ] `canHandle` lists all relevant event types
- [ ] Projection `evolve` is idempotent and side-effect free
- [ ] `initialState` provided
- [ ] `null` return documented where read models are deleted
- [ ] Registered via `getMongoDBEventStore({ projections: projections.inline([...]) })`
- [ ] Queries use `eventStore.projections.inline.find/findOne`
- [ ] Cross-stream analytics use message bus or integration (not inline projection)
- [ ] MongoDB TestContainers tests with `MongoDBInlineProjectionSpec`
