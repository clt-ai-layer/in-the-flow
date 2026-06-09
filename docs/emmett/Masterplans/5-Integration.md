# Emmett Masterplan — Part 5: Integration

> Agent rule mirror: `.cursor/rules/Backend/emmett-masterplan/emmett-masterplan-5-integration.mdc`
> **Previous**: [3-Projections.md](./3-Projections.md)

---

## Template Variables

```typescript
MODULE = "src/orderManagement";
INTEGRATION = "src/orderManagement/integration";
DOMAIN = "src/orderManagement/domain";
```

---

## SECTION 5: INTEGRATION & CROSS-MODULE REACTIONS

Integration handlers react to **events from other streams or modules** and trigger local commands. In Emmett there is no built-in Integration Pipeline — you compose subscriptions explicitly.

**Traditional DDD equivalent**: `ISingleEventIntegrationHandler` + `IntegrationPipeline` → Emmett subscription + `handle()`

---

### 5.1 Folder Structure

Integration lives at **module level**, not inside domain:

```
src/orderManagement/
├── domain/
├── api/
├── projections/
└── integration/
    ├── onShoppingCartConfirmed.ts
    └── onPaymentReceived.ts
```

**Naming convention**: `on{SourceEventName}.ts` or `{Source}{Reaction}.ts`
- Examples: `onShoppingCartConfirmed.ts`, `inventoryReserveOnOrderCreated.ts`

---

### 5.2 Single Event Reaction

React to one event type → execute one local command.

**File**: `INTEGRATION/onShoppingCartConfirmed.ts`

```typescript
import type { EventStore } from '@event-driven-io/emmett';
import type { ShoppingCartConfirmed } from '../../shoppingCart/domain/events';
import { handle as handleOrder } from '../domain/decider';
import { getOrderStreamId } from '../domain/streams';
import type { CreateOrderFromCart } from '../domain/commands';

export type OnShoppingCartConfirmedDeps = {
  eventStore: EventStore;
  getCurrentTime: () => Date;
};

export const onShoppingCartConfirmed = (deps: OnShoppingCartConfirmedDeps) =>
  async (event: ShoppingCartConfirmed & { metadata?: Record<string, unknown> }) => {
    const { shoppingCartId } = event.data;
    const clientId = event.metadata?.clientId as string | undefined;

    if (!clientId) {
      console.warn('onShoppingCartConfirmed: missing clientId in metadata');
      return;
    }

    const command: CreateOrderFromCart = {
      type: 'CreateOrderFromCart',
      data: { orderId: getOrderStreamId(shoppingCartId), shoppingCartId, clientId },
      metadata: { now: deps.getCurrentTime(), causationId: event.metadata?.eventId },
    };

    await handleOrder(deps.eventStore, command.data.orderId, (state) =>
      createOrderFromCart(command, state),
    );
  };
```

**Single reaction rules:**
- Extract IDs from `event.data` and `event.metadata`
- Guard missing metadata — log and return (swallow) or throw based on severity
- Always use `handle()` — never append directly
- Propagate `causationId` / `correlationId` in command metadata for tracing

---

### 5.3 Subscription Registration

Wire reactions at application bootstrap.

**File**: `src/subscriptions.ts`

```typescript
import type { EventStore } from '@event-driven-io/emmett';
import { onShoppingCartConfirmed } from './orderManagement/integration/onShoppingCartConfirmed';

export const registerSubscriptions = (
  eventStore: EventStore,
  deps: { getCurrentTime: () => Date },
) => {
  // Pattern depends on event store adapter — examples:

  // Option A: Inline projection-style handler on specific streams (app-level polling/subscribe)
  // Option B: External message bus consumer calling reaction functions
  // Option C: HTTP webhook receiver mapping payload → reaction function

  const reaction = onShoppingCartConfirmed({ eventStore, getCurrentTime: deps.getCurrentTime });

  // Register with your chosen mechanism — document the pattern for your project
  return { onShoppingCartConfirmed: reaction };
};
```

> Emmett's subscription mechanisms vary by adapter. For MongoDB side projects, common patterns are:
> - **Same monolith**: `getInMemoryMessageBus().subscribe()` (see sample app)
> - **Explicit orchestration**: call reaction function after upstream `handle()`
> - **EventStoreDB**: persistent subscription via `@event-driven-io/emmett-esdb` (if switching adapter)
> - **Separate MongoDB collection**: bus subscriber updates analytics collection

---

### 5.4 Idempotent Reactions

Events may be delivered more than once. Design commands to be safe on retry:

```typescript
export const createOrderFromCart = (
  command: CreateOrderFromCart,
  state: Order,
): OrderCreated | [] => {
  if (state.status !== 'NonExistent') {
    return []; // already created — idempotent no-op
  }
  return { type: 'OrderCreated', data: { /* ... */ } };
};
```

**Idempotency strategies:**

| Strategy | When |
| -------- | ---- |
| Return `[]` from `decide` if already applied | Same event redelivered |
| Store processed event IDs in read model | External bus with at-least-once delivery |
| Natural key in stream ID | One order per cart stream |

---

### 5.5 Error Handling Patterns

| Pattern | Behavior | Use when |
| ------- | -------- | -------- |
| Fail-fast | Throw / reject subscription | Critical consistency required |
| Swallow expected | Log + return | Target already in terminal state |
| Retry + DLQ | Exponential backoff → dead letter | External bus integration |

```typescript
export const onShoppingCartConfirmed = (deps: Deps) => async (event: ShoppingCartConfirmed) => {
  try {
    await handleOrder(/* ... */);
  } catch (error) {
    if (error instanceof IllegalStateError && error.message.includes('already exists')) {
      console.info('Order already exists for cart — skipping');
      return; // swallow expected
    }
    throw error; // fail-fast for unexpected
  }
};
```

---

### 5.6 Multi-Event / Batch Reactions

For high-volume events, buffer and batch:

```typescript
export type BatchReaction<TEvent> = {
  canHandle: string[];
  handleBatch: (events: TEvent[]) => Promise<void>;
  flushIntervalMs?: number;
};

export const productViewBatchReaction: BatchReaction<ProductViewed> = {
  canHandle: ['ProductViewed'],
  flushIntervalMs: 5000,
  handleBatch: async (events) => {
    const counts = aggregateViewCounts(events);
    await updateAnalyticsReadModel(counts);
  },
};
```

---

### 5.7 Message Bus Reactions (MongoDB side projects)

The official MongoDB sample uses the in-memory message bus for cross-stream reactions:

```typescript
import { getInMemoryMessageBus } from '@event-driven-io/emmett';
import type { ShoppingCartConfirmed } from '../shoppingCart/domain/events';

const bus = getInMemoryMessageBus();

bus.subscribe(async (event: ShoppingCartConfirmed) => {
  await updateClientAnalyticsCollection(event.metadata?.clientId, event.data);
}, 'ShoppingCartConfirmed');
```

Inject the bus into your API factory. Publish events after successful command handling, or subscribe at app bootstrap.

---

### 5.8 Cross-Module in Same Process (Explicit Orchestration)

When shopping cart and order modules live in one app, call downstream `handle()` from upstream route or projection:

```typescript
// In shoppingCartApi — after confirm succeeds:
await handleCart(eventStore, cartId, (state) => confirm(command, state));

// Trigger order creation inline (or via inline projection side-effect — prefer explicit call)
await onShoppingCartConfirmed({ eventStore, getCurrentTime })({
  type: 'ShoppingCartConfirmed',
  data: { shoppingCartId: cartId, confirmedAt: getCurrentTime() },
  metadata: { clientId },
});
```

> Prefer **explicit orchestration** in side projects over hidden projection side-effects — easier to test and debug.

---

### 5.9 Logging Conventions

```typescript
console.info('[onShoppingCartConfirmed] Creating order', { shoppingCartId, clientId });
console.warn('[onShoppingCartConfirmed] Missing clientId — skipping', { eventId });
console.error('[onShoppingCartConfirmed] Unexpected failure', { error, shoppingCartId });
```

Use structured log objects. Prefix with handler name.

---

## Integration Validation Checklist

- [ ] Integration handlers in `integration/` at module root — not in domain
- [ ] Named `on{Event}` or `{Source}{Reaction}` convention
- [ ] Reactions use `handle()` — never direct append
- [ ] Missing metadata guarded with log + early return
- [ ] Idempotent `decide` for redelivered events
- [ ] Error strategy documented (fail-fast vs swallow vs retry)
- [ ] Causation/correlation metadata propagated
- [ ] Subscriptions registered at app bootstrap
- [ ] Same-process orchestration preferred for simple side projects
- [ ] Reactions covered by ApiSpecification or dedicated integration tests
