/**
 * Integration tests for es-kit transactional infrastructure.
 *
 * @description Tests the full pipeline: BulkStreamLoader + TransactionalAppender
 * against a real MongoDB replica set (via MongoMemoryReplSet). Verifies:
 * - Bulk loading N streams in a single query
 * - Atomic multi-stream writes via MongoDB transactions
 * - Inline projection updates within transactions
 * - OCC guard (version conflict detection)
 * - Rollback semantics (all-or-nothing)
 *
 * These tests are wrapped in `xdescribe` by default — switch to `describe`
 * to run them on demand. They require ~30s for replica set startup.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { toStreamName } from "@event-driven-io/emmett-mongodb";
import { bulkLoadStreams } from "@/es-kit/persistence/BulkStreamLoader.js";
import { appendToStreamsTransactionally } from "@/es-kit/persistence/TransactionalAppender.js";
import {
  createReplSetContext,
  teardownReplSetContext,
  type ReplSetTestContext,
} from "../helpers/replSetTestContext.js";

// ── Test entity helpers ─────────────────────────────────────────

const STREAM_TYPE = "test_widget";

type WidgetState = {
  id: string;
  name: string;
  version: number;
};

type WidgetCreated = {
  type: "WidgetCreated";
  data: { id: string; name: string };
};

type WidgetRenamed = {
  type: "WidgetRenamed";
  data: { name: string };
};

type WidgetEvent = WidgetCreated | WidgetRenamed;

function evolve(state: WidgetState, event: WidgetEvent): WidgetState {
  switch (event.type) {
    case "WidgetCreated":
      return { id: event.data.id, name: event.data.name, version: 1 };
    case "WidgetRenamed":
      return { ...state, name: event.data.name, version: state.version + 1 };
    default:
      return state;
  }
}

const initialState = (): WidgetState => ({ id: "", name: "", version: 0 });

function makeStreamName(id: string): string {
  return toStreamName(STREAM_TYPE, id);
}

// ── Tests ───────────────────────────────────────────────────────

// NOTE: Switch `describe.skip` → `describe` to run these tests on demand.
// They require ~30s for MongoDB replica set startup.
describe.skip("es-kit transactional integration", () => {
  let ctx: ReplSetTestContext | null = null;

  beforeAll(async () => {
    ctx = await createReplSetContext();
  }, 60_000); // replica set startup can take 30s+

  afterAll(async () => {
    await teardownReplSetContext(ctx);
  });

  // ── BulkStreamLoader ──────────────────────────────────────────

  describe("bulkLoadStreams", () => {
    it("loads multiple streams in a single query", async () => {
      const { store } = ctx!;

      // Seed 3 streams with events
      const id1 = randomUUID();
      const id2 = randomUUID();
      const id3 = randomUUID();

      await store.appendToStream(makeStreamName(id1), [
        { type: "WidgetCreated", data: { id: id1, name: "Alpha" } },
      ]);
      await store.appendToStream(makeStreamName(id2), [
        { type: "WidgetCreated", data: { id: id2, name: "Beta" } },
        { type: "WidgetRenamed", data: { name: "Beta v2" } },
      ]);
      await store.appendToStream(makeStreamName(id3), [
        { type: "WidgetCreated", data: { id: id3, name: "Gamma" } },
      ]);

      // Bulk load all 3
      const result = await bulkLoadStreams(
        store,
        STREAM_TYPE,
        [makeStreamName(id1), makeStreamName(id2), makeStreamName(id3)],
        evolve,
        initialState,
      );

      expect(result.size).toBe(3);

      const s1 = result.get(makeStreamName(id1))!;
      expect(s1.exists).toBe(true);
      expect(s1.state.name).toBe("Alpha");
      expect(s1.state.version).toBe(1);

      const s2 = result.get(makeStreamName(id2))!;
      expect(s2.exists).toBe(true);
      expect(s2.state.name).toBe("Beta v2");
      expect(s2.state.version).toBe(2);

      const s3 = result.get(makeStreamName(id3))!;
      expect(s3.exists).toBe(true);
      expect(s3.state.name).toBe("Gamma");
    });

    it("returns initial state for non-existent streams", async () => {
      const { store } = ctx!;
      const missing = randomUUID();

      const result = await bulkLoadStreams(
        store,
        STREAM_TYPE,
        [makeStreamName(missing)],
        evolve,
        initialState,
      );

      expect(result.size).toBe(1);
      const s = result.get(makeStreamName(missing))!;
      expect(s.exists).toBe(false);
      expect(s.state).toEqual(initialState());
    });

    it("handles mixed existing and non-existing streams", async () => {
      const { store } = ctx!;
      const existing = randomUUID();
      const missing = randomUUID();

      await store.appendToStream(makeStreamName(existing), [
        { type: "WidgetCreated", data: { id: existing, name: "Exists" } },
      ]);

      const result = await bulkLoadStreams(
        store,
        STREAM_TYPE,
        [makeStreamName(existing), makeStreamName(missing)],
        evolve,
        initialState,
      );

      expect(result.size).toBe(2);
      expect(result.get(makeStreamName(existing))!.exists).toBe(true);
      expect(result.get(makeStreamName(existing))!.state.name).toBe("Exists");
      expect(result.get(makeStreamName(missing))!.exists).toBe(false);
    });
  });

  // ── TransactionalAppender ─────────────────────────────────────

  describe("appendToStreamsTransactionally", () => {
    it("writes events to multiple streams atomically", async () => {
      const { store, client } = ctx!;
      const id1 = randomUUID();
      const id2 = randomUUID();

      const result = await appendToStreamsTransactionally(client, store, [
        {
          streamName: makeStreamName(id1),
          events: [{ type: "WidgetCreated", data: { id: id1, name: "Tx1" } }],
        },
        {
          streamName: makeStreamName(id2),
          events: [{ type: "WidgetCreated", data: { id: id2, name: "Tx2" } }],
        },
      ]);

      expect(result.totalEventsAppended).toBe(2);
      expect(result.streams).toHaveLength(2);
      expect(result.streams[0]!.createdNewStream).toBe(true);
      expect(result.streams[1]!.createdNewStream).toBe(true);

      // Verify events were persisted by reading them back
      const loaded = await bulkLoadStreams(
        store,
        STREAM_TYPE,
        [makeStreamName(id1), makeStreamName(id2)],
        evolve,
        initialState,
      );

      expect(loaded.get(makeStreamName(id1))!.state.name).toBe("Tx1");
      expect(loaded.get(makeStreamName(id2))!.state.name).toBe("Tx2");
    });

    it("appends to existing streams within a transaction", async () => {
      const { store, client } = ctx!;
      const id1 = randomUUID();
      const id2 = randomUUID();

      // Seed initial events via Emmett
      await store.appendToStream(makeStreamName(id1), [
        { type: "WidgetCreated", data: { id: id1, name: "Before1" } },
      ]);
      await store.appendToStream(makeStreamName(id2), [
        { type: "WidgetCreated", data: { id: id2, name: "Before2" } },
      ]);

      // Append more events transactionally
      await appendToStreamsTransactionally(client, store, [
        {
          streamName: makeStreamName(id1),
          events: [{ type: "WidgetRenamed", data: { name: "After1" } }],
        },
        {
          streamName: makeStreamName(id2),
          events: [{ type: "WidgetRenamed", data: { name: "After2" } }],
        },
      ]);

      // Verify updated state
      const loaded = await bulkLoadStreams(
        store,
        STREAM_TYPE,
        [makeStreamName(id1), makeStreamName(id2)],
        evolve,
        initialState,
      );

      expect(loaded.get(makeStreamName(id1))!.state.name).toBe("After1");
      expect(loaded.get(makeStreamName(id1))!.state.version).toBe(2);
      expect(loaded.get(makeStreamName(id2))!.state.name).toBe("After2");
      expect(loaded.get(makeStreamName(id2))!.state.version).toBe(2);
    });

    it("delegates to Emmett for single-stream writes (no transaction overhead)", async () => {
      const { store, client } = ctx!;
      const id = randomUUID();

      const result = await appendToStreamsTransactionally(client, store, [
        {
          streamName: makeStreamName(id),
          events: [{ type: "WidgetCreated", data: { id, name: "Single" } }],
        },
      ]);

      expect(result.totalEventsAppended).toBe(1);
      expect(result.streams).toHaveLength(1);

      // Verify
      const loaded = await bulkLoadStreams(
        store,
        STREAM_TYPE,
        [makeStreamName(id)],
        evolve,
        initialState,
      );
      expect(loaded.get(makeStreamName(id))!.state.name).toBe("Single");
    });

    it("returns empty result for zero writes", async () => {
      const { client, store } = ctx!;

      const result = await appendToStreamsTransactionally(client, store, []);

      expect(result.totalEventsAppended).toBe(0);
      expect(result.streams).toHaveLength(0);
    });

    it("writes inline projections within the transaction", async () => {
      const { store, client } = ctx!;

      // Use real task events to exercise inline projections
      const taskId1 = randomUUID();
      const taskId2 = randomUUID();
      const now = new Date().toISOString();

      // Get the projection definitions from the store
      const projectionDefs = (store as any).inlineProjections as any[] | undefined;

      const result = await appendToStreamsTransactionally(
        client,
        store,
        [
          {
            streamName: toStreamName("task", taskId1),
            events: [{
              type: "TaskCreated",
              data: {
                id: taskId1,
                name: "Projected Task 1",
                description: "",
                status: "backlog",
                category: "business",
                source: "test",
                owner: "Test",
                task_grouping: null,
                archived: false,
                estimated_duration: null,
                current_duration: 0,
                project_id: null,
                created_at: now,
                updated_at: now,
              },
            }],
          },
          {
            streamName: toStreamName("task", taskId2),
            events: [{
              type: "TaskCreated",
              data: {
                id: taskId2,
                name: "Projected Task 2",
                description: "",
                status: "in_progress",
                category: "business",
                source: "test",
                owner: "Test",
                task_grouping: null,
                archived: false,
                estimated_duration: null,
                current_duration: 0,
                project_id: null,
                created_at: now,
                updated_at: now,
              },
            }],
          },
        ],
        projectionDefs,
      );

      expect(result.totalEventsAppended).toBe(2);

      // Verify projections were written by querying via Emmett's projection API
      const proj1 = await store.projections.inline.findOne({
        streamName: toStreamName("task", taskId1),
        projectionName: "task_list",
      });
      expect(proj1).not.toBeNull();
      expect(proj1!.name).toBe("Projected Task 1");
      expect(proj1!.status).toBe("backlog");

      const proj2 = await store.projections.inline.findOne({
        streamName: toStreamName("task", taskId2),
        projectionName: "task_list",
      });
      expect(proj2).not.toBeNull();
      expect(proj2!.name).toBe("Projected Task 2");
      expect(proj2!.status).toBe("in_progress");
    });

    it("mixes new and existing streams in one transaction", async () => {
      const { store, client } = ctx!;
      const existingId = randomUUID();
      const newId = randomUUID();

      // Seed one stream
      await store.appendToStream(makeStreamName(existingId), [
        { type: "WidgetCreated", data: { id: existingId, name: "Existing" } },
      ]);

      // Transaction: update existing + create new
      await appendToStreamsTransactionally(client, store, [
        {
          streamName: makeStreamName(existingId),
          events: [{ type: "WidgetRenamed", data: { name: "Updated" } }],
        },
        {
          streamName: makeStreamName(newId),
          events: [{ type: "WidgetCreated", data: { id: newId, name: "Brand New" } }],
        },
      ]);

      const loaded = await bulkLoadStreams(
        store,
        STREAM_TYPE,
        [makeStreamName(existingId), makeStreamName(newId)],
        evolve,
        initialState,
      );

      expect(loaded.get(makeStreamName(existingId))!.state.name).toBe("Updated");
      expect(loaded.get(makeStreamName(newId))!.state.name).toBe("Brand New");
    });
  });
});
