# Emmett Masterplan — Part 2: Commands & API

> Agent rule mirror: `.cursor/rules/Backend/emmett-masterplan/emmett-masterplan-2-commands.mdc`
> **Previous**: [1-Domain.md](./1-Domain.md) · **Next**: [3-Projections.md](./3-Projections.md)

---

## Template Variables

```typescript
AGGREGATE = "ShoppingCart";
API = "src/shoppingCart/api";
DOMAIN = "src/shoppingCart/domain";
```

---

## SECTION 2: COMMAND HANDLING & HTTP API

### 2.1 CommandHandler Setup

One handler per stream type — not per command.

**File**: `DOMAIN/decider.ts` (or `API/handler.ts`)

```typescript
import { CommandHandler } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './decider';

export const handle = CommandHandler({ evolve, initialState });
```

**Usage in routes:**

```typescript
await handle(eventStore, streamId, (state) => decide(command, state));
// Or per-command function:
await handle(eventStore, streamId, (state) => addProductItem(command, state));
```

**Rules:**
- Never call `appendToStream` directly from routes — always use `handle()`
- One `CommandHandler` instance per aggregate/stream type
- Pass explicit `(state) => ...` lambda — keeps Go-to-definition clarity

---

### 2.2 API Module Structure

**File**: `API/shoppingCartApi.ts`

```typescript
import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import { on, NoContent, ok, notFound, Created } from '@event-driven-io/emmett-expressjs';
import type { EventStore } from '@event-driven-io/emmett';
import { CommandHandler } from '@event-driven-io/emmett';
import { decide, evolve, initialState, addProductItem } from '../domain/decider';
import { getShoppingCartStreamId } from '../domain/streams';

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
        const clientId = assertNotEmptyString(request.params.clientId);
        const shoppingCartId = getShoppingCartStreamId(clientId);
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
          metadata: { now: getCurrentTime(), clientId },
        };

        await handle(eventStore, shoppingCartId, (state) =>
          addProductItem(command, state),
        );

        return NoContent();
      }),
    );
  };
```

**API rules:**
- `WebApiSetup = (router) => void` — function returning route registration
- Inject **all** external deps from top: `eventStore`, services, `getCurrentTime`
- HTTP layer: validate + map request → command (don't repeat validation in `decide`)
- Set `metadata.clientId` (or tenant/user IDs) for multi-stream projections
- Use `on()` wrapper for explicit request → response mapping

---

### 2.3 HTTP Response Helpers

| Helper | Status | Use case |
| ------ | ------ | -------- |
| `NoContent()` | 204 | Command succeeded, no body |
| `ok(body)` | 200 | Query response |
| `Created({ createdId, eTag })` | 201 | Stream creation with Location |
| `notFound({ detail })` | 404 | Read model / stream not found |
| Errors | auto | Thrown `IllegalStateError` → 403, etc. |

---

### 2.4 Optimistic Concurrency

For updates where client sends version:

```typescript
import { STREAM_DOES_NOT_EXIST, toWeakETag } from '@event-driven-io/emmett';

const result = await handle(
  eventStore,
  streamId,
  command,
  { expectedStreamVersion: parseETag(request.headers['if-match']) },
);

return Created({ createdId: streamId, eTag: toWeakETag(result.nextExpectedStreamVersion) });
```

| Constant | Meaning |
| -------- | ------- |
| `STREAM_DOES_NOT_EXIST` | Create-new-stream semantics |
| `ConcurrencyError` | Mismatch → HTTP 412 |

---

### 2.5 Application Bootstrap

**File**: `src/app.ts`

```typescript
import { projections } from '@event-driven-io/emmett';
import { getMongoDBEventStore } from '@event-driven-io/emmett-mongodb';
import { getApplication, startAPI } from '@event-driven-io/emmett-expressjs';
import { shoppingCartApi } from './shoppingCart/api/shoppingCartApi';
import { shoppingCartSummaryProjection } from './shoppingCart/projections/shoppingCartSummary.projection';

const eventStore = getMongoDBEventStore({
  connectionString: process.env.MONGODB_CONNECTION_STRING ?? 'mongodb://localhost:27017/mydb',
  projections: projections.inline([shoppingCartSummaryProjection]),
});

const app = getApplication({
  apis: [shoppingCartApi(eventStore, getUnitPrice, () => new Date())],
});

export const server = startAPI(app);
```

Dev/tests: `getInMemoryEventStore()` from `@event-driven-io/emmett`.

---

### 2.6 Multi-Step Orchestration (Process/Saga)

No built-in process handler — orchestrate explicitly:

```typescript
export const checkoutProcess = async (
  eventStore: EventStore,
  command: CheckoutCommand,
) => {
  const cartResult = await handle(eventStore, cartStreamId, confirmCartCommand);

  const orderResult = await handle(eventStore, orderStreamId, createOrderCommand);
  if (orderResult /* failure */) {
    await handle(eventStore, cartStreamId, reopenCartCommand); // compensation
    throw orderResult.error;
  }
};
```

**Rules:**
- Each step uses `handle()` — never bypass event store
- Implement compensation explicitly on failure
- Consider idempotent commands for safe retries

---

### 2.7 API Integration Tests

**File**: `API/shoppingCart.api.spec.ts`

```typescript
import { getInMemoryEventStore } from '@event-driven-io/emmett';
import {
  ApiSpecification,
  getApplication,
  existingStream,
  expectNewEvents,
  expectResponse,
  expectError,
} from '@event-driven-io/emmett-expressjs';

const unitPrice = 100;
const now = new Date();

const given = ApiSpecification.for<ShoppingCartEvent>(
  () => getInMemoryEventStore(),
  (eventStore) =>
    getApplication({
      apis: [shoppingCartApi(eventStore, () => Promise.resolve(unitPrice), () => now)],
    }),
);

void describe('ShoppingCart API', () => {
  void it('adds product to empty cart', () =>
    given()
      .when((req) =>
        req.post(`/clients/${clientId}/shopping-carts/current/product-items`).send({ productId, quantity: 1 }),
      )
      .then([
        expectNewEvents(shoppingCartId, [{
          type: 'ProductItemAddedToShoppingCart',
          data: { shoppingCartId, productItem: { productId, quantity: 1, unitPrice }, addedAt: now },
        }]),
      ]),
  );

  void it('returns 403 when cart closed', () =>
    given(existingStream(shoppingCartId, [/* closed events */]))
      .when((req) => req.post(/* add product */))
      .then(expectError(403, { detail: 'Shopping Cart already closed' })),
  );
});
```

**Test helpers:**

| Helper | Purpose |
| ------ | ------- |
| `existingStream(id, events)` | Pre-populate stream before test |
| `expectNewEvents(streamId, events)` | Assert appended events |
| `expectResponse(status, opts?)` | Assert HTTP response |
| `expectError(status, problemDetails)` | Assert Problem Details body |

---

## Commands & API Validation Checklist

- [ ] `CommandHandler` created once per stream type
- [ ] Routes use `on()` wrapper
- [ ] All external deps injected at API factory top level
- [ ] Request validation in HTTP layer; business rules in `decide`
- [ ] `metadata.now` and correlation IDs set on commands
- [ ] Stream ID from helper — not inline strings
- [ ] No direct `appendToStream` in routes
- [ ] `ApiSpecification` tests for critical flows
- [ ] Error scenarios tested with `expectError`
- [ ] `getCurrentTime` injectable for deterministic tests
