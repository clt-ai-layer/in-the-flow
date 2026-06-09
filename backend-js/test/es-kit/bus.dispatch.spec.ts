/**
 * Unit tests for EntityCommandBus dispatch paths.
 *
 * @description Tests all 7 handler dispatch kinds using in-memory event store.
 * No MongoDB needed — fast and stable.
 *
 * Covers:
 * - Single handler (create/update/delete)
 * - Upsert handler (initialize + update paths)
 * - CreateIfNotFound handler (create + no-op paths)
 * - Batch handler
 * - Upsert batch handler (mixed creates/updates)
 * - CreateIfNotFound batch handler (skips existing)
 * - Process handler
 * - Error cases (unregistered command, duplicate registration)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getInMemoryEventStore, type EventStore } from "@event-driven-io/emmett";
import {
  EntityCommandBus,
  type CommandResult,
  type BatchCommandResult,
} from "@/es-kit/index.js";
import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { Outcome } from "@/es-kit/domain/Outcome.js";
import { EntityRef } from "@/es-kit/domain/EntityRef.js";
import type {
  IEntityCreateHandler,
  IEntityUpdateHandler,
  IEntityUpsertHandler,
  IEntityCreateIfNotFoundHandler,
  IEntityBatchHandler,
  IEntityUpsertBatchHandler,
  IEntityCreateIfNotFoundBatchHandler,
  IEntityProcessHandler,
} from "@/es-kit/index.js";

// ── Test entity ─────────────────────────────────────────────────

type WidgetState = { name: string; count: number };
type WidgetCreated = { type: "WidgetCreated"; data: { name: string } };
type WidgetUpdated = { type: "WidgetUpdated"; data: { name: string } };
type WidgetEvent = WidgetCreated | WidgetUpdated;

class Widget extends EntityRoot<WidgetState, WidgetEvent> {
  static readonly streamType = "test_widget";
  static readonly initialState: WidgetState = { name: "", count: 0 };

  constructor(state: WidgetState) {
    super(state);
  }

  static replayState(state: WidgetState, event: WidgetEvent): WidgetState {
    switch (event.type) {
      case "WidgetCreated":
        return { name: event.data.name, count: 1 };
      case "WidgetUpdated":
        return { ...state, name: event.data.name, count: state.count + 1 };
      default:
        return state;
    }
  }

  protected when(state: WidgetState, event: WidgetEvent): WidgetState {
    return Widget.replayState(state, event);
  }

  create(name: string): Outcome<void> {
    this.apply({ type: "WidgetCreated", data: { name } });
    return Outcome.unit();
  }

  rename(name: string): Outcome<void> {
    this.apply({ type: "WidgetUpdated", data: { name } });
    return Outcome.unit();
  }
}

// ── Command type alias ──────────────────────────────────────────

type WidgetCommand = { type: string; data: { id: string; name: string } };

// ── Test handlers ───────────────────────────────────────────────

class CreateWidgetHandler implements IEntityCreateHandler<Widget, WidgetCommand> {
  readonly commandType = "CreateWidget";
  readonly Entity = Widget;

  getEntityId(command: WidgetCommand): string {
    return command.data.id;
  }

  route(entity: Widget, command: WidgetCommand): Outcome<void> {
    return entity.create(command.data.name);
  }
}

class UpdateWidgetHandler implements IEntityUpdateHandler<Widget, WidgetCommand> {
  readonly commandType = "UpdateWidget";
  readonly Entity = Widget;

  getEntityId(command: WidgetCommand): string {
    return command.data.id;
  }

  route(entity: Widget, command: WidgetCommand): Outcome<void> {
    return entity.rename(command.data.name);
  }
}

class UpsertWidgetHandler implements IEntityUpsertHandler<Widget, WidgetCommand> {
  readonly commandType = "UpsertWidget";
  readonly Entity = Widget;

  getEntityId(command: WidgetCommand): string {
    return command.data.id;
  }

  initialize(entity: Widget, command: WidgetCommand): Outcome<void> {
    return entity.create(command.data.name);
  }

  update(entity: Widget, command: WidgetCommand): Outcome<void> {
    return entity.rename(command.data.name);
  }
}

class CreateIfNotFoundWidgetHandler implements IEntityCreateIfNotFoundHandler<Widget, WidgetCommand> {
  readonly commandType = "CreateIfNotFoundWidget";
  readonly Entity = Widget;

  getEntityId(command: WidgetCommand): string {
    return command.data.id;
  }

  initialize(entity: Widget, command: WidgetCommand): Outcome<void> {
    return entity.create(command.data.name);
  }
}

type BatchCreateCommand = {
  type: string;
  data: { widgets: Array<{ id: string; name: string }> };
};

class BatchCreateWidgetHandler implements IEntityBatchHandler<Widget, BatchCreateCommand, { id: string; name: string }> {
  readonly commandType = "BatchCreateWidgets";
  readonly Entity = Widget;

  buildSingleCommands(command: BatchCreateCommand): Map<string, { id: string; name: string }> {
    const map = new Map<string, { id: string; name: string }>();
    for (const w of command.data.widgets) {
      map.set(w.id, w);
    }
    return map;
  }

  route(entity: Widget, params: { id: string; name: string }): Outcome<void> {
    return entity.create(params.name);
  }
}

class UpsertBatchWidgetHandler implements IEntityUpsertBatchHandler<Widget, BatchCreateCommand, { id: string; name: string }> {
  readonly commandType = "UpsertBatchWidgets";
  readonly Entity = Widget;

  buildSingleCommands(command: BatchCreateCommand): Map<string, { id: string; name: string }> {
    const map = new Map<string, { id: string; name: string }>();
    for (const w of command.data.widgets) {
      map.set(w.id, w);
    }
    return map;
  }

  initialize(entity: Widget, params: { id: string; name: string }): Outcome<void> {
    return entity.create(params.name);
  }

  update(entity: Widget, params: { id: string; name: string }): Outcome<void> {
    return entity.rename(params.name);
  }
}

class CreateIfNotFoundBatchWidgetHandler implements IEntityCreateIfNotFoundBatchHandler<Widget, BatchCreateCommand, { id: string; name: string }> {
  readonly commandType = "CreateIfNotFoundBatchWidgets";
  readonly Entity = Widget;

  buildSingleCommands(command: BatchCreateCommand): Map<string, { id: string; name: string }> {
    const map = new Map<string, { id: string; name: string }>();
    for (const w of command.data.widgets) {
      map.set(w.id, w);
    }
    return map;
  }

  initialize(entity: Widget, params: { id: string; name: string }): Outcome<void> {
    return entity.create(params.name);
  }
}

class ProcessWidgetHandler implements IEntityProcessHandler<{ type: string; data: { targetId: string; name: string } }> {
  readonly commandType = "ProcessWidget";

  async run(
    command: { type: string; data: { targetId: string; name: string } },
    bus: any,
  ): Promise<Outcome<void>> {
    // Process handler delegates to the bus for sub-commands
    await bus.send({
      type: "CreateWidget",
      data: { id: command.data.targetId, name: command.data.name },
    });
    return Outcome.unit();
  }
}

// ── Helper ──────────────────────────────────────────────────────

/** Seeds a widget into the event store by appending a WidgetCreated event directly. */
async function seedWidget(store: EventStore, id: string, name: string): Promise<void> {
  const streamName = EntityRef.newId(Widget.streamType, id).toStreamName();
  await store.appendToStream(streamName, [
    { type: "WidgetCreated", data: { name } },
  ]);
}

/** Type-safe cast for single command results. */
function asSingle(result: CommandResult | BatchCommandResult): CommandResult {
  return result as CommandResult;
}

/** Type-safe cast for batch command results. */
function asBatch(result: CommandResult | BatchCommandResult): BatchCommandResult {
  return result as BatchCommandResult;
}

// ── Tests ───────────────────────────────────────────────────────

describe("EntityCommandBus dispatch", () => {
  let store: EventStore;
  let bus: EntityCommandBus;

  beforeEach(() => {
    store = getInMemoryEventStore();
    bus = new EntityCommandBus(store);
    bus.register(new CreateWidgetHandler());
    bus.register(new UpdateWidgetHandler());
    bus.register(new UpsertWidgetHandler());
    bus.register(new CreateIfNotFoundWidgetHandler());
    bus.register(new BatchCreateWidgetHandler());
    bus.register(new UpsertBatchWidgetHandler());
    bus.register(new CreateIfNotFoundBatchWidgetHandler());
    bus.register(new ProcessWidgetHandler());
  });

  // ── Single handlers ─────────────────────────────────────────

  describe("single handler dispatch", () => {
    it("dispatches a create command and persists events", async () => {
      const result = asSingle(await bus.send({
        type: "CreateWidget",
        data: { id: "w1", name: "Alpha" },
      }));

      expect(result.newEvents).toHaveLength(1);
      expect(result.newEvents[0]).toMatchObject({
        type: "WidgetCreated",
        data: { name: "Alpha" },
      });
    });

    it("dispatches an update command to an existing entity", async () => {
      await bus.send({ type: "CreateWidget", data: { id: "w2", name: "Before" } });
      const result = asSingle(await bus.send({ type: "UpdateWidget", data: { id: "w2", name: "After" } }));

      expect(result.newEvents).toHaveLength(1);
      expect(result.newEvents[0]).toMatchObject({
        type: "WidgetUpdated",
        data: { name: "After" },
      });
    });
  });

  // ── Upsert handler ──────────────────────────────────────────

  describe("upsert handler dispatch", () => {
    it("calls initialize() for a new entity", async () => {
      const result = asSingle(await bus.send({
        type: "UpsertWidget",
        data: { id: "u1", name: "New" },
      }));

      expect(result.newEvents).toHaveLength(1);
      expect(result.newEvents[0]).toMatchObject({
        type: "WidgetCreated",
        data: { name: "New" },
      });
    });

    it("calls update() for an existing entity", async () => {
      // Seed an existing widget
      await bus.send({ type: "CreateWidget", data: { id: "u2", name: "Original" } });

      // Upsert should update, not create
      const result = asSingle(await bus.send({
        type: "UpsertWidget",
        data: { id: "u2", name: "Updated" },
      }));

      expect(result.newEvents).toHaveLength(1);
      expect(result.newEvents[0]).toMatchObject({
        type: "WidgetUpdated",
        data: { name: "Updated" },
      });
    });
  });

  // ── CreateIfNotFound handler ──────────────────────────────────

  describe("createIfNotFound handler dispatch", () => {
    it("calls initialize() for a new entity", async () => {
      const result = asSingle(await bus.send({
        type: "CreateIfNotFoundWidget",
        data: { id: "c1", name: "New" },
      }));

      expect(result.newEvents).toHaveLength(1);
      expect(result.newEvents[0]).toMatchObject({
        type: "WidgetCreated",
        data: { name: "New" },
      });
    });

    it("returns no-op for an existing entity", async () => {
      // Seed an existing widget
      await bus.send({ type: "CreateWidget", data: { id: "c2", name: "Existing" } });

      // CreateIfNotFound should be a no-op
      const result = asSingle(await bus.send({
        type: "CreateIfNotFoundWidget",
        data: { id: "c2", name: "Ignored" },
      }));

      expect(result.newEvents).toHaveLength(0);
    });
  });

  // ── Batch handler ─────────────────────────────────────────────

  describe("batch handler dispatch", () => {
    it("creates multiple entities in a batch", async () => {
      const result = asBatch(await bus.send({
        type: "BatchCreateWidgets",
        data: {
          widgets: [
            { id: "b1", name: "One" },
            { id: "b2", name: "Two" },
            { id: "b3", name: "Three" },
          ],
        },
      }));

      expect(result.allNewEvents).toHaveLength(3);
      expect(result.results.size).toBe(3);
    });
  });

  // ── Upsert batch handler ──────────────────────────────────────

  describe("upsert batch handler dispatch", () => {
    it("initializes new and updates existing entities", async () => {
      // Seed one entity
      await seedWidget(store, "ub1", "Existing");

      const result = asBatch(await bus.send({
        type: "UpsertBatchWidgets",
        data: {
          widgets: [
            { id: "ub1", name: "Updated" },   // existing → update
            { id: "ub2", name: "New" },        // new → initialize
          ],
        },
      }));

      expect(result.allNewEvents).toHaveLength(2);

      // Verify the existing entity got WidgetUpdated, new got WidgetCreated
      const events = result.allNewEvents as any[];
      const createdEvents = events.filter((e: any) => e.type === "WidgetCreated");
      const updatedEvents = events.filter((e: any) => e.type === "WidgetUpdated");

      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0].data.name).toBe("New");
      expect(updatedEvents).toHaveLength(1);
      expect(updatedEvents[0].data.name).toBe("Updated");
    });

    it("initializes all when none exist", async () => {
      const result = asBatch(await bus.send({
        type: "UpsertBatchWidgets",
        data: {
          widgets: [
            { id: "ubn1", name: "Alpha" },
            { id: "ubn2", name: "Beta" },
          ],
        },
      }));

      expect(result.allNewEvents).toHaveLength(2);
      expect(result.allNewEvents.every((e: any) => e.type === "WidgetCreated")).toBe(true);
    });
  });

  // ── CreateIfNotFound batch handler ────────────────────────────

  describe("createIfNotFound batch handler dispatch", () => {
    it("creates new entities and skips existing ones", async () => {
      // Seed one entity
      await seedWidget(store, "cb1", "Existing");

      const result = asBatch(await bus.send({
        type: "CreateIfNotFoundBatchWidgets",
        data: {
          widgets: [
            { id: "cb1", name: "Ignored" },   // existing → skip
            { id: "cb2", name: "New" },        // new → initialize
          ],
        },
      }));

      // Only 1 event — the existing one was skipped
      expect(result.allNewEvents).toHaveLength(1);
      expect(result.allNewEvents[0]).toMatchObject({
        type: "WidgetCreated",
        data: { name: "New" },
      });
    });

    it("produces zero events when all already exist", async () => {
      await seedWidget(store, "cba1", "A");
      await seedWidget(store, "cba2", "B");

      const result = asBatch(await bus.send({
        type: "CreateIfNotFoundBatchWidgets",
        data: {
          widgets: [
            { id: "cba1", name: "Ignored" },
            { id: "cba2", name: "Ignored" },
          ],
        },
      }));

      expect(result.allNewEvents).toHaveLength(0);
    });
  });

  // ── Process handler ───────────────────────────────────────────

  describe("process handler dispatch", () => {
    it("runs process handler with bus reference", async () => {
      const result = await bus.send({
        type: "ProcessWidget",
        data: { targetId: "p1", name: "Processed" },
      });

      // The process handler delegates to CreateWidget internally
      // The process handler itself returns empty events (bus returns them from the sub-command)
      expect(result).toBeDefined();
    });

    it("sub-commands issued by process handler are persisted", async () => {
      await bus.send({
        type: "ProcessWidget",
        data: { targetId: "p2", name: "FromProcess" },
      });

      // Verify the sub-command was executed by reading the stream
      const stream = await store.readStream(
        EntityRef.newId(Widget.streamType, "p2").toStreamName(),
      );
      expect(stream.events).toHaveLength(1);
      expect(stream.events[0]).toMatchObject({
        type: "WidgetCreated",
        data: { name: "FromProcess" },
      });
    });
  });

  // ── Error cases ───────────────────────────────────────────────

  describe("error cases", () => {
    it("throws for unregistered command type", async () => {
      await expect(
        bus.send({ type: "NonExistentCommand", data: {} }),
      ).rejects.toThrow("no handler registered for command type 'NonExistentCommand'");
    });

    it("throws for duplicate handler registration", () => {
      expect(() => bus.register(new CreateWidgetHandler())).toThrow(
        "handler already registered for 'CreateWidget'",
      );
    });

    it("reports has() correctly", () => {
      expect(bus.has("CreateWidget")).toBe(true);
      expect(bus.has("NonExistent")).toBe(false);
    });

    it("reports all commandTypes", () => {
      expect(bus.commandTypes).toContain("CreateWidget");
      expect(bus.commandTypes).toContain("UpsertWidget");
      expect(bus.commandTypes).toContain("BatchCreateWidgets");
      expect(bus.commandTypes).toContain("ProcessWidget");
    });
  });
});
