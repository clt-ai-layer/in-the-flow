import { describe, expect, it } from "vitest";
import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { Outcome } from "@/es-kit/domain/Outcome.js";

type WidgetState = { count: number };
type WidgetCreated = { type: "WidgetCreated"; data: { count: number } };
type WidgetEvent = WidgetCreated;

class Widget extends EntityRoot<WidgetState, WidgetEvent> {
  constructor(state: WidgetState) {
    super(state);
  }

  static replayState(state: WidgetState, event: WidgetEvent): WidgetState {
    return Widget.fromState(state).when(state, event);
  }

  protected when(state: WidgetState, event: WidgetEvent): WidgetState {
    switch (event.type) {
      case "WidgetCreated":
        return { count: event.data.count };
      default:
        return state;
    }
  }

  Create(count: number): Outcome<void> {
    if (this.state.count !== 0) {
      return Outcome.fail("illegal", "Widget already exists");
    }
    this.apply({ type: "WidgetCreated", data: { count } });
    return Outcome.unit();
  }
}

describe("EntityRoot", () => {
  it("replayState folds events via subclass when()", () => {
    const state = Widget.replayState({ count: 0 }, {
      type: "WidgetCreated",
      data: { count: 5 },
    });
    expect(state).toEqual({ count: 5 });
  });

  it("apply mutates state and collects uncommitted events", () => {
    const widget = Widget.fromState({ count: 0 });
    const outcome = widget.Create(3);
    expect(outcome.ok).toBe(true);

    // State mutated immediately
    expect(widget.getState()).toEqual({ count: 3 });

    // Event collected
    const events = widget.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "WidgetCreated", data: { count: 3 } });
  });

  it("command methods can return Outcome.fail without applying", () => {
    const widget = Widget.fromState({ count: 1 });
    const outcome = widget.Create(2);
    expect(outcome).toEqual({
      ok: false,
      code: "illegal",
      message: "Widget already exists",
    });

    // No events collected on failure
    expect(widget.getUncommittedEvents()).toHaveLength(0);
  });

  it("clearUncommittedEvents resets the event list", () => {
    const widget = Widget.fromState({ count: 0 });
    widget.Create(3);
    expect(widget.getUncommittedEvents()).toHaveLength(1);

    widget.clearUncommittedEvents();
    expect(widget.getUncommittedEvents()).toHaveLength(0);
  });
});
