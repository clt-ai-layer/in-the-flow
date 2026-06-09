# Emmett Masterplan — Part 1: Domain

> Agent rule mirror: `.cursor/rules/Backend/emmett-masterplan/emmett-masterplan-1-domain.mdc`
> **Next**: [2-Commands-and-API.md](./2-Commands-and-API.md)

---

## Template Variables

```typescript
AGGREGATE = "ShoppingCart";
STREAM_PREFIX = "shopping_cart";
DOMAIN = "src/shoppingCart/domain";
```

---

## SECTION 1: DOMAIN COMPONENT

### 1.1 Shared Types

Plain TypeScript types — no classes, no decorators.

**File**: `DOMAIN/shared.ts`

```typescript
export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & { unitPrice: number };

export type ProductItems = Map<string, number>;
```

**Rules:**
- Prefer plain interfaces/types over classes
- Use `Map` or `Record` for collections when mutation in `evolve` is convenient
- Optional: Zod schemas at HTTP boundary only (not in domain)

---

### 1.2 State Type

Discriminated union representing decision-making state.

**File**: `DOMAIN/state.ts`

```typescript
import type { ProductItems } from './shared';

export type EmptyShoppingCart = { status: 'Empty' };
export type OpenedShoppingCart = { status: 'Opened'; productItems: ProductItems };
export type ClosedShoppingCart = { status: 'Closed' };

export type ShoppingCart =
  | EmptyShoppingCart
  | OpenedShoppingCart
  | ClosedShoppingCart;
```

**Rules:**
- Use `status` discriminant for exhaustive switching
- Keep state **minimal** — only fields used in `decide()`
- No methods on state — functions operate on plain data

---

### 1.3 Events

**File**: `DOMAIN/events.ts`

```typescript
import type { Event } from '@event-driven-io/emmett';
import type { PricedProductItem } from './shared';

export type ProductItemAddedToShoppingCart = Event<
  'ProductItemAddedToShoppingCart',
  { shoppingCartId: string; productItem: PricedProductItem; addedAt: Date }
>;

export type ShoppingCartConfirmed = Event<
  'ShoppingCartConfirmed',
  { shoppingCartId: string; confirmedAt: Date }
>;

export type ShoppingCartEvent =
  | ProductItemAddedToShoppingCart
  | ShoppingCartConfirmed;
  // | ... all events
```

**Rules:**
- Event names: **past tense** facts
- All events for one stream type in a single union: `ShoppingCartEvent`
- Include entity ID in payload (`shoppingCartId`) for clarity in logs/projections
- Dates as `Date` in types; serialize at storage boundary

---

### 1.4 Commands

**File**: `DOMAIN/commands.ts`

```typescript
import type { Command } from '@event-driven-io/emmett';
import type { PricedProductItem } from './shared';

export type AddProductItemToShoppingCart = Command<
  'AddProductItemToShoppingCart',
  { shoppingCartId: string; productItem: PricedProductItem }
>;

export type ConfirmShoppingCart = Command<
  'ConfirmShoppingCart',
  { shoppingCartId: string }
>;

export type ShoppingCartCommand =
  | AddProductItemToShoppingCart
  | ConfirmShoppingCart;
```

**Rules:**
- Command names: **imperative** verbs
- Union type covers all commands for this Decider
- HTTP layer adds `metadata: { now, userId, clientId }` — not in command `data`

---

### 1.5 Stream Identity

**File**: `DOMAIN/streams.ts`

```typescript
import { toStreamName } from '@event-driven-io/emmett-mongodb';

export const SHOPPING_CART_STREAM_TYPE = 'shopping_cart';

export const getShoppingCartStreamId = (clientId: string): string =>
  toStreamName(SHOPPING_CART_STREAM_TYPE, `${clientId}:current`);
// → "shopping_cart:abc-123:current"  stored in collection emt:shopping_cart
```

**Rules:**
- Use `toStreamName(streamType, streamId)` from `@event-driven-io/emmett-mongodb`
- Stream format: `streamType:streamId` (e.g. `shopping_cart:client-1:current`)
- MongoDB collection: `emt:{streamType}` (default `COLLECTION_PER_STREAM_TYPE` storage)
- Reference this helper in API routes and tests — never inline stream strings

---

### 1.6 Decider — `decide`, `evolve`, `initialState`

**File**: `DOMAIN/decider.ts`

```typescript
import { EmmettError, IllegalStateError, sum } from '@event-driven-io/emmett';
import type { ShoppingCart } from './state';
import type { ShoppingCartCommand } from './commands';
import type { ShoppingCartEvent } from './events';

export const initialState = (): ShoppingCart => ({ status: 'Empty' });

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

export const decide = (
  command: ShoppingCartCommand,
  state: ShoppingCart,
): ShoppingCartEvent | ShoppingCartEvent[] => {
  switch (command.type) {
    case 'AddProductItemToShoppingCart':
      return addProductItem(command, state);
    case 'ConfirmShoppingCart':
      return confirm(command, state);
    default: {
      const _exhaustive: never = command.type;
      throw new EmmettError('Unknown command type');
    }
  }
};

export const evolve = (
  state: ShoppingCart,
  event: ShoppingCartEvent,
): ShoppingCart => {
  switch (event.type) {
    case 'ProductItemAddedToShoppingCart': {
      if (state.status === 'Closed') return state;
      const productItems =
        state.status === 'Opened' ? state.productItems : new Map<string, number>();
      // ... update quantities
      return { status: 'Opened', productItems };
    }
    case 'ShoppingCartConfirmed':
      return { status: 'Closed' };
    default:
      return state;
  }
};

// Optional: export as Decider record
export const shoppingCartDecider = { decide, evolve, initialState };
```

**Critical: `decide` vs `evolve`**

| | `decide(command, state)` | `evolve(state, event)` |
| --- | --- | --- |
| Purpose | Business rules + validation | State reconstruction |
| May throw | Yes | **No** |
| May IO | **No** | **No** |
| Returns | Event(s) | New state |
| Called by | CommandHandler | aggregateStream, tests |

**Decider rules:**
- Decompose into per-command functions for readability
- Use `never` exhaustiveness check in `decide` switch
- `evolve` must handle out-of-order rebuild gracefully (return state unchanged if event doesn't apply)
- Idempotent no-op: return `[]` from `decide` when appropriate (alternative to throw)
- Use `metadata?.now` for timestamps — inject via command metadata, not `new Date()` in tests

---

### 1.7 Domain Unit Tests

**File**: `DOMAIN/decider.spec.ts`

```typescript
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from './decider';

const given = DeciderSpecification.for({ decide, evolve, initialState });

void describe('ShoppingCart decider', () => {
  void describe('When empty', () => {
    void it('adds product item', () => {
      given([])
        .when({ type: 'AddProductItemToShoppingCart', data: { /* ... */ }, metadata: { now } })
        .then([{ type: 'ProductItemAddedToShoppingCart', data: { /* ... */ } }]);
    });
  });

  void describe('When closed', () => {
    void it('rejects add', () => {
      given([/* closed events */])
        .when({ type: 'AddProductItemToShoppingCart', /* ... */ })
        .thenThrows((e: Error) => e.message === 'Shopping Cart already closed');
    });
  });
});
```

---

## Domain File Generation Order

1. `shared.ts` — shared value types
2. `state.ts` — state union
3. `events.ts` — event union
4. `commands.ts` — command union
5. `streams.ts` — stream ID helper
6. `decider.ts` — decide, evolve, initialState
7. `decider.spec.ts` — DeciderSpecification tests

---

## Domain Validation Checklist

- [ ] State is a discriminated union with `status` field
- [ ] All events in one union type per stream/aggregate
- [ ] All commands in one union type
- [ ] Event names past tense; command names imperative
- [ ] Stream ID helper documented and used consistently
- [ ] `decide` throws for business rule violations (not `evolve`)
- [ ] `evolve` is pure — no throw, no IO
- [ ] `initialState()` returns valid empty state
- [ ] Exhaustive `never` check in `decide` default branch
- [ ] DeciderSpecification tests cover happy path + key rejections
- [ ] Timestamps use `metadata.now`, not hardcoded `new Date()` in tests
