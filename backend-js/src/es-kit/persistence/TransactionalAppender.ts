import { randomUUID } from "node:crypto";
import type { ClientSession, MongoClient } from "mongodb";
import type { Event } from "@event-driven-io/emmett";
import {
  fromStreamName,
  handleInlineProjections,
  MongoDBEventStoreDefaultStreamVersion,
  type MongoDBEventStore,
} from "@event-driven-io/emmett-mongodb";

// ── Types ───────────────────────────────────────────────────────

/**
 * Describes a single stream write operation within a transactional batch.
 *
 * @description Produced by the bus after entity domain logic runs.
 * The appender uses this to build the MongoDB updateOne operations.
 */
export type StreamWriteOperation = {
  /** Full stream name, e.g. `"task:abc-123"`. */
  readonly streamName: string;
  /** Events to append to this stream. */
  readonly events: ReadonlyArray<Event>;
};

/**
 * Result of a single stream write within the transaction.
 */
export type StreamWriteResult = {
  readonly streamName: string;
  readonly eventsAppended: number;
  readonly createdNewStream: boolean;
};

/**
 * Result of the full transactional batch.
 */
export type TransactionalAppendResult = {
  readonly streams: ReadonlyArray<StreamWriteResult>;
  readonly totalEventsAppended: number;
};

// ── Internal helpers ────────────────────────────────────────────

/**
 * Reads current stream version and projections from MongoDB.
 *
 * @description Lightweight projection-only read — mirrors Emmett's
 * `appendToStream` pre-read (line 798–806 of emmett-mongodb index.js).
 */
async function readStreamMeta(
  collection: any,
  streamName: string,
  session: ClientSession,
) {
  const doc = await collection.findOne(
    { streamName: { $eq: streamName } },
    {
      useBigInt64: true,
      projection: {
        "metadata.streamPosition": 1,
        projections: 1,
      },
      session,
    },
  );
  return {
    currentVersion: (doc?.metadata?.streamPosition as bigint) ?? MongoDBEventStoreDefaultStreamVersion,
    existingProjections: doc?.projections ?? {},
  };
}

/**
 * Builds the recorded event messages with metadata, mirroring Emmett's
 * internal format (lines 815–832 of emmett-mongodb index.js).
 */
function buildRecordedEvents(
  events: ReadonlyArray<Event>,
  streamName: string,
  currentVersion: bigint,
) {
  let offset = currentVersion;
  return events.map((event) => ({
    type: event.type,
    data: event.data,
    metadata: {
      messageId: randomUUID(),
      streamName,
      streamPosition: ++offset,
      ...("metadata" in event ? (event.metadata ?? {}) : {}),
    },
  }));
}

/**
 * Builds the MongoDB `updateOne` arguments for one stream,
 * replicating Emmett's `appendToStream` logic (lines 834–865).
 */
function buildUpdateArgs(
  streamName: string,
  streamId: string,
  streamType: string,
  recordedEvents: Array<{ type: string; data: unknown; metadata: Record<string, unknown> }>,
  currentVersion: bigint,
  eventCount: number,
) {
  const now = new Date();
  const filter = {
    streamName: { $eq: streamName },
    "metadata.streamPosition": currentVersion,
  };
  const update = {
    $push: { messages: { $each: recordedEvents } },
    $set: {
      "metadata.updatedAt": now,
      "metadata.streamPosition": currentVersion + BigInt(eventCount),
    } as Record<string, unknown>,
    $setOnInsert: {
      streamName,
      "metadata.streamId": streamId,
      "metadata.streamType": streamType,
      "metadata.createdAt": now,
    },
  };
  return { filter, update };
}

// ── Transactional Appender ──────────────────────────────────────

/**
 * Appends events to multiple streams within a single MongoDB transaction.
 *
 * @description Replicates Emmett's `appendToStream` logic but wraps all writes
 * in a `session.withTransaction()` call. This guarantees atomicity across streams:
 * either ALL streams receive their events, or NONE do.
 *
 * **How it works:**
 * 1. Start a MongoDB session + transaction
 * 2. For each stream: read current version + projections (within transaction)
 * 3. Build recorded events with stream positions and message IDs
 * 4. Compute inline projection updates using Emmett's `handleInlineProjections`
 * 5. Execute all `updateOne` calls with the session (OCC guard on `metadata.streamPosition`)
 * 6. Commit or rollback the transaction
 *
 * **Optimistic concurrency**: Each stream's `updateOne` includes a filter on
 * `metadata.streamPosition === currentVersion`. If another writer bumped the
 * version between read and write, the `updateOne` matches 0 documents and
 * the transaction fails.
 *
 * **Inline projections**: Uses Emmett's exported `handleInlineProjections`
 * function to compute projection updates within the same write.
 *
 * @param client - MongoDB client for session creation.
 * @param store - Emmett event store for `collectionFor()` access.
 * @param writes - Array of stream write operations to execute atomically.
 * @param inlineProjectionDefs - Optional projection definitions for inline projection updates.
 *
 * @throws If any stream's OCC check fails (version conflict), the entire
 * transaction is rolled back.
 *
 * @example
 * ```typescript
 * const result = await appendToStreamsTransactionally(
 *   mongoClient,
 *   eventStore,
 *   [
 *     { streamName: "task:id1", events: [taskCreatedEvent] },
 *     { streamName: "task:id2", events: [taskUpdatedEvent] },
 *     { streamName: "dailyTask:id3", events: [dailyTaskCreatedEvent] },
 *   ],
 *   projectionDefinitions,
 * );
 * // All 3 streams are written atomically
 * ```
 */
export async function appendToStreamsTransactionally(
  client: MongoClient,
  store: MongoDBEventStore,
  writes: ReadonlyArray<StreamWriteOperation>,
  inlineProjectionDefs?: ReadonlyArray<{ name: string; canHandle: string[]; handle: Function }>,
): Promise<TransactionalAppendResult> {
  if (writes.length === 0) {
    return { streams: [], totalEventsAppended: 0 };
  }

  // Single stream — delegate to Emmett's native appendToStream (no transaction needed)
  if (writes.length === 1) {
    const write = writes[0]!;
    const result = await store.appendToStream(
      write.streamName as `${string}:${string}`,
      [...write.events],
    );
    return {
      streams: [{
        streamName: write.streamName,
        eventsAppended: write.events.length,
        createdNewStream: result.createdNewStream,
      }],
      totalEventsAppended: write.events.length,
    };
  }

  // Multiple streams — use MongoDB transaction
  const session = client.startSession();
  try {
    const results: StreamWriteResult[] = [];

    await session.withTransaction(async () => {
      results.length = 0; // Clear on retry

      for (const write of writes) {
        if (write.events.length === 0) continue;

        const { streamId, streamType } = fromStreamName(
          write.streamName as `${string}:${string}`,
        );
        const collection = await store.collectionFor(streamType);

        // Read current version + projections (within transaction)
        const { currentVersion, existingProjections } = await readStreamMeta(
          collection,
          write.streamName,
          session,
        );

        // Build recorded events
        const recordedEvents = buildRecordedEvents(
          write.events,
          write.streamName,
          currentVersion,
        );

        // Build MongoDB update
        const { filter, update } = buildUpdateArgs(
          write.streamName,
          streamId,
          streamType,
          recordedEvents,
          currentVersion,
          write.events.length,
        );

        // Handle inline projections — mutates update.$set
        if (inlineProjectionDefs && inlineProjectionDefs.length > 0) {
          await handleInlineProjections({
            readModels: existingProjections,
            streamId,
            events: recordedEvents as any,
            projections: inlineProjectionDefs as any,
            collection: collection as any,
            updates: update as any,
            client: {},
          } as any);
        }

        // Execute with session (OCC guard on metadata.streamPosition)
        await (collection as any).updateOne(filter, update, {
          useBigInt64: true,
          upsert: true,
          session,
        });

        results.push({
          streamName: write.streamName,
          eventsAppended: write.events.length,
          createdNewStream: currentVersion === MongoDBEventStoreDefaultStreamVersion,
        });
      }
    });

    return {
      streams: results,
      totalEventsAppended: results.reduce((sum, r) => sum + r.eventsAppended, 0),
    };
  } finally {
    await session.endSession();
  }
}
