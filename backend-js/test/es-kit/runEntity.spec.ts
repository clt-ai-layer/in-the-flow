import { getInMemoryEventStore, ValidationError } from "@event-driven-io/emmett";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntityRef } from "@/es-kit/domain/EntityRef.js";
import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { runEntity } from "@/es-kit/bus/EntityExecutor.js";
import { Outcome } from "@/es-kit/domain/Outcome.js";

type CounterState = { count: number };
type IncrementCounter = { type: "IncrementCounter"; data: { by: number } };
type CounterIncremented = { type: "CounterIncremented"; data: { by: number } };
type CounterEvent = CounterIncremented;

class Counter extends EntityRoot<CounterState, CounterEvent> {
  constructor(state: CounterState) {
    super(state);
  }

  static replayState(state: CounterState, event: CounterEvent): CounterState {
    return Counter.fromState(state).when(state, event);
  }

  protected when(state: CounterState, event: CounterEvent): CounterState {
    switch (event.type) {
      case "CounterIncremented":
        return { count: state.count + event.data.by };
      default:
        return state;
    }
  }

  Increment(command: IncrementCounter): Outcome<void> {
    if (command.data.by <= 0) {
      return Outcome.fail("validation", "Increment must be positive");
    }
    this.apply({ type: "CounterIncremented", data: { by: command.data.by } });
    return Outcome.unit();
  }
}

const dispatch = {
  initialState: { count: 0 } satisfies CounterState,
  evolve: Counter.replayState,
  decide: (state: CounterState, command: IncrementCounter) => {
    const entity = Counter.fromState(state);
    const outcome = entity.Increment(command);
    if (!outcome.ok) {
      return outcome; // Outcome.fail
    }
    return Outcome.ok([...entity.getUncommittedEvents()]);
  },
};

describe("runEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("appends events on Outcome.ok", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId("counter", "counter-1");
    const command: IncrementCounter = { type: "IncrementCounter", data: { by: 2 } };

    const result = await runEntity({
      store,
      ref,
      dispatch,
      command,
    });

    expect(result.newEvents).toEqual([
      { type: "CounterIncremented", data: { by: 2 } },
    ]);
    expect(result.newState).toEqual({ count: 2 });
  });

  it("throws before append on Outcome.fail", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId("counter", "counter-2");
    const invalid: IncrementCounter = { type: "IncrementCounter", data: { by: 0 } };
    const valid: IncrementCounter = { type: "IncrementCounter", data: { by: 3 } };

    await expect(
      runEntity({ store, ref, dispatch, command: invalid }),
    ).rejects.toThrow(ValidationError);

    const retry = await runEntity({ store, ref, dispatch, command: valid });
    expect(retry.newEvents).toHaveLength(1);
    expect(retry.newState).toEqual({ count: 3 });
  });

  it("invokes afterCommit with ref, newState, and newEvents", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId("counter", "counter-3");
    const command: IncrementCounter = { type: "IncrementCounter", data: { by: 1 } };
    const afterCommit = vi.fn();

    await runEntity({
      store,
      ref,
      dispatch,
      command,
      afterCommit,
    });

    expect(afterCommit).toHaveBeenCalledOnce();
    const ctx = afterCommit.mock.calls[0]?.[0];
    expect(ctx?.ref).toBe(ref);
    expect(ctx?.newEvents[0]?.type).toBe("CounterIncremented");
    expect(ctx?.newState).toEqual({ count: 1 });
  });

  it("persists events before propagating afterCommit failure", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId("counter", "counter-4");
    const command: IncrementCounter = { type: "IncrementCounter", data: { by: 2 } };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runEntity({
        store,
        ref,
        dispatch,
        command,
        afterCommit: async () => {
          throw new Error("side effect failed");
        },
      }),
    ).rejects.toThrow("side effect failed");

    expect(consoleError).toHaveBeenCalledWith(
      "afterCommit failed after events persisted",
      expect.objectContaining({
        streamId: ref.toStreamName(),
        eventTypes: ["CounterIncremented"],
      }),
    );

    const retry = await runEntity({
      store,
      ref,
      dispatch,
      command: { type: "IncrementCounter", data: { by: 1 } },
    });

    expect(retry.newEvents[0]?.type).toBe("CounterIncremented");
    expect(retry.newState).toEqual({ count: 3 });
  });
});
