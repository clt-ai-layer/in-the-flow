import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";

// ── Types ───────────────────────────────────────────────────────

/**
 * Result of loading a single stream in a bulk operation.
 *
 * @description Contains the aggregated state (from replaying events)
 * and stream metadata. For streams that don't exist yet (new entities),
 * `exists` is false and `state` is the initial state.
 */
export type BulkStreamResult<TState> = {
  /** Aggregated state after replaying all events. */
  readonly state: TState;
  /** Whether the stream exists in the store. */
  readonly exists: boolean;
  /** Current stream version (0n for non-existent streams). */
  readonly currentStreamVersion: bigint;
};

// ── Bulk loader ─────────────────────────────────────────────────

/**
 * Loads multiple streams from the same collection in a single MongoDB `find()`.
 *
 * @description Replaces N individual `aggregateStream()` / `findOne()` calls
 * with a single `find({ streamName: { $in: [...] } })` query, reducing
 * the number of MongoDB round-trips from N to 1.
 *
 * For each loaded document, events are replayed through the `evolve` function
 * to produce the current aggregate state — exactly matching Emmett's
 * `aggregateStream` behavior (lines 781–793 of emmett-mongodb index.js).
 *
 * Streams that don't exist yet (new entities) are returned with `initialState()`
 * and `exists: false`.
 *
 * **Constraint**: All streams must share the same `streamType` (same collection).
 * This is always true for `IEntityBatchHandler` which operates on a single Entity class.
 *
 * @param store - Emmett event store for `collectionFor()` access.
 * @param streamType - The entity stream type (e.g. `"task"`, `"dailyTask"`).
 * @param streamNames - Full stream names to load (e.g. `["task:id1", "task:id2"]`).
 * @param evolve - Event replay function: `(state, event) => newState`.
 * @param initialState - Factory for the initial/empty state.
 *
 * @returns Map from stream name to aggregated result.
 *
 * @example
 * ```typescript
 * const streams = await bulkLoadStreams(
 *   store, "task",
 *   ["task:abc", "task:def", "task:ghi"],
 *   Task.replayState,
 *   () => Task.initialState,
 * );
 *
 * for (const [streamName, { state, exists }] of streams) {
 *   const entity = Task.fromState(state);
 *   // ... domain logic
 * }
 * ```
 */
export async function bulkLoadStreams<TState>(
  store: MongoDBEventStore,
  streamType: string,
  streamNames: ReadonlyArray<string>,
  evolve: (state: TState, event: any) => TState,
  initialState: () => TState,
): Promise<Map<string, BulkStreamResult<TState>>> {
  const results = new Map<string, BulkStreamResult<TState>>();

  if (streamNames.length === 0) {
    return results;
  }

  // Single stream — just use Emmett's native aggregateStream (no overhead)
  if (streamNames.length === 1) {
    const name = streamNames[0]!;
    const result = await store.aggregateStream(
      name as `${string}:${string}`,
      { evolve, initialState },
    );
    results.set(name, {
      state: result.state as TState,
      exists: result.streamExists,
      currentStreamVersion: result.currentStreamVersion,
    });
    return results;
  }

  // Bulk load — single find() with $in
  const collection = await store.collectionFor(streamType);
  const cursor = (collection as any).find(
    { streamName: { $in: [...streamNames] } },
    { useBigInt64: true },
  );

  const documents: any[] = await cursor.toArray();

  // Build a lookup map from loaded documents
  const docsByName = new Map<string, any>();
  for (const doc of documents) {
    docsByName.set(doc.streamName, doc);
  }

  // Reduce events to state for each requested stream
  for (const name of streamNames) {
    const doc = docsByName.get(name);

    if (!doc) {
      // Stream doesn't exist yet — return initial state
      results.set(name, {
        state: initialState(),
        exists: false,
        currentStreamVersion: 0n,
      });
      continue;
    }

    // Replay events through evolve — matches Emmett's aggregateStream behavior
    const events: any[] = doc.messages ?? [];
    const state = events.reduce(evolve, initialState());
    const streamVersion = (doc.metadata?.streamPosition as bigint) ?? 0n;

    results.set(name, {
      state,
      exists: true,
      currentStreamVersion: streamVersion,
    });
  }

  return results;
}
