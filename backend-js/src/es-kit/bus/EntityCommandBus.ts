import {
  CommandHandler,
  type Event,
  type EventStore,
} from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { MongoClient } from "mongodb";
import { executeCommandHandlerCore } from "@/platform/emmett/executeCommandHandlerCore.js";
import type { EntityRoot } from "../domain/EntityRoot.js";
import type {
  IEntityCommandHandler,
} from "../handlers/IEntityCommandHandler.js";
import type {
  IEntityBatchHandler,
} from "../handlers/IEntityBatchHandler.js";
import type {
  IEntityUpsertHandler,
  IEntityUpsertBatchHandler,
} from "../handlers/IEntityUpsertHandler.js";
import type {
  IEntityCreateIfNotFoundHandler,
  IEntityCreateIfNotFoundBatchHandler,
} from "../handlers/IEntityCreateIfNotFoundHandler.js";
import type {
  IEntityProcessHandler,
} from "../handlers/IEntityProcessHandler.js";
import type { EntityClass } from "../handlers/types.js";
import { toEmmettError } from "../domain/toEmmettError.js";
import { EntityRef } from "../domain/EntityRef.js";
import {
  appendToStreamsTransactionally,
  type StreamWriteOperation,
} from "../persistence/TransactionalAppender.js";
import { bulkLoadStreams, type BulkStreamResult } from "../persistence/BulkStreamLoader.js";

// ── Result types ────────────────────────────────────────────────

/**
 * Untyped command result returned by the bus.
 *
 * @description Erases entity-specific state/event types since the bus
 * handles any registered command. Consumers that need typed access
 * should use the handler directly instead.
 */
export type CommandResult = {
  newState: unknown;
  newEvents: ReadonlyArray<Event>;
};

/**
 * Result of a batch command — one entry per entity in the batch.
 */
export type BatchCommandResult = {
  /** Per-entity results, keyed by entity ID. */
  results: Map<string, CommandResult>;
  /** All new events from all entities, flattened. */
  allNewEvents: ReadonlyArray<Event>;
};

// ── Pipeline behavior ───────────────────────────────────────────

/**
 * Context passed to each {@link BusBehavior} in the pipeline.
 */
export type BusBehaviorContext = {
  /** The `command.type` string, e.g. `"CreateDailyTask"`. */
  readonly commandType: string;
  /** The resolved entity/stream ID. */
  readonly entityId: string;
  /** The entity stream type, e.g. `"dailyTask"`. */
  readonly entityType: string;
  /** The full command envelope. */
  readonly command: unknown;
};

/**
 * Middleware that wraps command execution in the pipeline.
 *
 * @description Called in registration order. Each behavior **must** invoke
 * `next()` to continue the chain (or short-circuit by throwing / returning early).
 */
export interface BusBehavior {
  handle(
    context: BusBehaviorContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult>;
}

// ── Transactional batch config ──────────────────────────────────

/**
 * Configuration for transactional batch operations.
 *
 * @description Provided at bus construction time. When set, batch handlers
 * will write all events atomically via a MongoDB transaction.
 */
export type TransactionalConfig = {
  /** The MongoDB client for session creation. */
  readonly client: MongoClient;
  /** Inline projection definitions (from Emmett's mongoDBInlineProjection). */
  readonly inlineProjections?: ReadonlyArray<{
    name: string;
    canHandle: string[];
    handle: Function;
  }>;
};

// ── Type guards ─────────────────────────────────────────────────

/** @internal */
type AnyHandler =
  | IEntityCommandHandler<any, any>
  | IEntityBatchHandler<any, any, any>
  | IEntityUpsertHandler<any, any>
  | IEntityCreateIfNotFoundHandler<any, any>
  | IEntityUpsertBatchHandler<any, any, any>
  | IEntityCreateIfNotFoundBatchHandler<any, any, any>
  | IEntityProcessHandler<any>;

const enum HandlerKind {
  Single = "single",
  Batch = "batch",
  Upsert = "upsert",
  CreateIfNotFound = "createIfNotFound",
  UpsertBatch = "upsertBatch",
  CreateIfNotFoundBatch = "createIfNotFoundBatch",
  Process = "process",
}

function classifyHandler(handler: AnyHandler): HandlerKind {
  // Process handler — has run() but no Entity
  if ("run" in handler && typeof (handler as any).run === "function" && !("Entity" in handler)) {
    return HandlerKind.Process;
  }
  // Upsert batch — has buildSingleCommands + initialize + update
  if ("buildSingleCommands" in handler && "initialize" in handler && "update" in handler) {
    return HandlerKind.UpsertBatch;
  }
  // CreateIfNotFound batch — has buildSingleCommands + initialize (no update)
  if ("buildSingleCommands" in handler && "initialize" in handler && !("update" in handler)) {
    return HandlerKind.CreateIfNotFoundBatch;
  }
  // Standard batch — has buildSingleCommands + route
  if ("buildSingleCommands" in handler && "route" in handler) {
    return HandlerKind.Batch;
  }
  // Upsert single — has initialize + update + getEntityId
  if ("initialize" in handler && "update" in handler && "getEntityId" in handler) {
    return HandlerKind.Upsert;
  }
  // CreateIfNotFound single — has initialize + getEntityId (no update)
  if ("initialize" in handler && "getEntityId" in handler && !("update" in handler)) {
    return HandlerKind.CreateIfNotFound;
  }
  // Default: single handler (has route + getEntityId)
  return HandlerKind.Single;
}

/** @internal Check if event store is a MongoDB event store (has collectionFor). */
function isMongoStore(store: EventStore): store is MongoDBEventStore {
  return typeof (store as any).collectionFor === "function";
}

// ── Command bus ─────────────────────────────────────────────────

/**
 * Command bus / pipeline for entity commands.
 *
 * @description Routes commands to registered handlers by `command.type`.
 * Owns the full execution flow: load state → create entity → route → persist.
 * Supports middleware behaviors (logging, timing, integration) that wrap execution.
 *
 * Supports 7 handler types:
 * - **Single**: `IEntityCommandHandler` (create/update/delete)
 * - **Batch**: `IEntityBatchHandler` (create/update multiple)
 * - **Upsert**: `IEntityUpsertHandler` (create if not found, update if found)
 * - **CreateIfNotFound**: `IEntityCreateIfNotFoundHandler` (idempotent create)
 * - **UpsertBatch**: `IEntityUpsertBatchHandler` (batch upsert)
 * - **CreateIfNotFoundBatch**: `IEntityCreateIfNotFoundBatchHandler` (batch idempotent create)
 * - **Process**: `IEntityProcessHandler` (cross-aggregate orchestration)
 *
 * @example
 * ```typescript
 * const bus = new EntityCommandBus(store, {
 *   client: mongoClient,
 *   inlineProjections: projectionDefs,
 * });
 *
 * bus.register(new CreateDailyTaskHandler());
 * bus.register(new UpsertTaskHandler());
 * bus.register(new BulkSyncTasksHandler());
 * bus.register(new ArchiveProjectCascadeHandler());
 *
 * bus.use(new EntityLoggingMiddleware());
 *
 * await bus.send({ type: "UpsertTask", data: { id: "abc", ... } });
 * ```
 */
export class EntityCommandBus {
  /** All handlers keyed by commandType, regardless of kind. */
  private readonly handlers = new Map<string, { kind: HandlerKind; handler: AnyHandler }>();
  private readonly behaviors: BusBehavior[] = [];

  constructor(
    private readonly store: EventStore,
    private readonly transactional?: TransactionalConfig,
  ) {}

  /**
   * Registers a handler. Command type is read from `handler.commandType`.
   *
   * @throws If a handler is already registered for the given command type.
   */
  register(handler: AnyHandler): this {
    const commandType = handler.commandType;
    if (this.handlers.has(commandType)) {
      throw new Error(
        `EntityCommandBus: handler already registered for '${commandType}'`,
      );
    }

    const kind = classifyHandler(handler);
    this.handlers.set(commandType, { kind, handler });
    return this;
  }

  /**
   * Adds a pipeline behavior (middleware).
   *
   * @description Behaviors execute in registration order, wrapping the handler.
   * Each behavior receives a `next()` function to continue the chain.
   */
  use(behavior: BusBehavior): this {
    this.behaviors.push(behavior);
    return this;
  }

  /**
   * Sends a command through the pipeline.
   *
   * @description Automatically detects the handler kind and routes accordingly.
   * @throws If no handler is registered for the command type.
   */
  async send(
    command: { type: string; [key: string]: unknown },
  ): Promise<CommandResult | BatchCommandResult> {
    const entry = this.handlers.get(command.type);
    if (!entry) {
      throw new Error(
        `EntityCommandBus: no handler registered for command type '${command.type}'`,
      );
    }

    switch (entry.kind) {
      case HandlerKind.Single:
        return this.dispatchSingle(entry.handler as IEntityCommandHandler<any, any>, command);
      case HandlerKind.Upsert:
        return this.dispatchUpsert(entry.handler as IEntityUpsertHandler<any, any>, command);
      case HandlerKind.CreateIfNotFound:
        return this.dispatchCreateIfNotFound(entry.handler as IEntityCreateIfNotFoundHandler<any, any>, command);
      case HandlerKind.Batch:
        return this.dispatchBatch(entry.handler as IEntityBatchHandler<any, any, any>, command);
      case HandlerKind.UpsertBatch:
        return this.dispatchUpsertBatch(entry.handler as IEntityUpsertBatchHandler<any, any, any>, command);
      case HandlerKind.CreateIfNotFoundBatch:
        return this.dispatchCreateIfNotFoundBatch(entry.handler as IEntityCreateIfNotFoundBatchHandler<any, any, any>, command);
      case HandlerKind.Process:
        return this.dispatchProcess(entry.handler as IEntityProcessHandler<any>, command);
    }
  }

  /** Returns true if a handler is registered for the given command type. */
  has(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  /** Returns all registered command type strings. */
  get commandTypes(): ReadonlyArray<string> {
    return [...this.handlers.keys()];
  }

  // ── Single-entity dispatch ────────────────────────────────────

  private async dispatchSingle(
    handler: IEntityCommandHandler<EntityRoot<any, any>, any>,
    command: { type: string; [key: string]: unknown },
  ): Promise<CommandResult> {
    const entityId = handler.getEntityId(command);
    const Entity = handler.Entity as EntityClass<EntityRoot<any, any>>;
    const streamId = EntityRef.newId(Entity.streamType, entityId).toStreamName();

    const context: BusBehaviorContext = {
      commandType: command.type,
      entityId,
      entityType: Entity.streamType,
      command,
    };

    let index = 0;
    const next = async (): Promise<CommandResult> => {
      if (index < this.behaviors.length) {
        const behavior = this.behaviors[index++]!;
        return behavior.handle(context, next);
      }
      return this.executeHandler(handler, Entity, streamId, command);
    };

    return next();
  }

  // ── Upsert dispatch ───────────────────────────────────────────

  /**
   * Dispatches an upsert command: load → check existence → initialize or update → persist.
   */
  private async dispatchUpsert(
    handler: IEntityUpsertHandler<EntityRoot<any, any>, any>,
    command: { type: string; [key: string]: unknown },
  ): Promise<CommandResult> {
    const entityId = handler.getEntityId(command);
    const Entity = handler.Entity as EntityClass<EntityRoot<any, any>>;
    const streamId = EntityRef.newId(Entity.streamType, entityId).toStreamName();

    const context: BusBehaviorContext = {
      commandType: command.type,
      entityId,
      entityType: Entity.streamType,
      command,
    };

    let index = 0;
    const next = async (): Promise<CommandResult> => {
      if (index < this.behaviors.length) {
        const behavior = this.behaviors[index++]!;
        return behavior.handle(context, next);
      }

      const emmettHandler = CommandHandler({
        evolve: Entity.replayState,
        initialState: () => Entity.initialState,
      });

      return executeCommandHandlerCore({
        store: this.store,
        streamId,
        handler: emmettHandler,
        handle: (state) => {
          const entity = Entity.fromState(state);
          // Check if entity has been initialized (has events)
          const streamExists = state !== Entity.initialState &&
            JSON.stringify(state) !== JSON.stringify(Entity.initialState);

          const outcome = streamExists
            ? handler.update(entity, command)
            : handler.initialize(entity, command);
          if (!outcome.ok) {
            toEmmettError(outcome);
          }
          return [...entity.getUncommittedEvents()];
        },
      });
    };

    return next();
  }

  // ── CreateIfNotFound dispatch ─────────────────────────────────

  /**
   * Dispatches a create-if-not-found command: load → if exists: no-op, else: initialize → persist.
   */
  private async dispatchCreateIfNotFound(
    handler: IEntityCreateIfNotFoundHandler<EntityRoot<any, any>, any>,
    command: { type: string; [key: string]: unknown },
  ): Promise<CommandResult> {
    const entityId = handler.getEntityId(command);
    const Entity = handler.Entity as EntityClass<EntityRoot<any, any>>;
    const streamId = EntityRef.newId(Entity.streamType, entityId).toStreamName();

    const context: BusBehaviorContext = {
      commandType: command.type,
      entityId,
      entityType: Entity.streamType,
      command,
    };

    let index = 0;
    const next = async (): Promise<CommandResult> => {
      if (index < this.behaviors.length) {
        const behavior = this.behaviors[index++]!;
        return behavior.handle(context, next);
      }

      const emmettHandler = CommandHandler({
        evolve: Entity.replayState,
        initialState: () => Entity.initialState,
      });

      return executeCommandHandlerCore({
        store: this.store,
        streamId,
        handler: emmettHandler,
        handle: (state) => {
          const streamExists = state !== Entity.initialState &&
            JSON.stringify(state) !== JSON.stringify(Entity.initialState);

          if (streamExists) {
            // Already exists — no-op, return no events
            return [];
          }

          const entity = Entity.fromState(state);
          const outcome = handler.initialize(entity, command);
          if (!outcome.ok) {
            toEmmettError(outcome);
          }
          return [...entity.getUncommittedEvents()];
        },
      });
    };

    return next();
  }

  // ── Batch dispatch (transactional) ────────────────────────────

  /**
   * Dispatches a batch command: fan out → bulk load → route all → atomic persist.
   *
   * @description
   * 1. `buildSingleCommands()` → `Map<entityId, singleParams>`
   * 2. Bulk load all entities in a single `find({ $in })` query
   * 3. Run domain logic on each entity (`handler.route()`)
   * 4. Collect uncommitted events from all entities
   * 5. Write ALL events atomically via MongoDB transaction ({@link appendToStreamsTransactionally})
   *
   * **Efficient reads**: N entities loaded in 1 MongoDB query via {@link bulkLoadStreams}.
   * **Fail-fast**: domain logic failures throw before any persistence.
   * **Atomic**: if transaction config is set, all streams are written in one
   * MongoDB transaction — either all succeed or all roll back.
   */
  private async dispatchBatch(
    handler: IEntityBatchHandler<EntityRoot<any, any>, any, any>,
    command: { type: string; [key: string]: unknown },
  ): Promise<BatchCommandResult> {
    const Entity = handler.Entity as EntityClass<EntityRoot<any, any>>;
    const singleCommands = handler.buildSingleCommands(command);

    // Build stream names for all entities in the batch
    const entityEntries = [...singleCommands.entries()].map(([entityId, params]) => ({
      entityId,
      params,
      streamName: EntityRef.newId(Entity.streamType, entityId).toStreamName(),
    }));

    // Phase 1: Load all streams
    const streamNames = entityEntries.map((e) => e.streamName);
    const loadedStreams = await this.loadStreams(Entity, streamNames);

    // Phase 2: Run domain logic on each entity (fail-fast)
    const entityResults: Array<{
      entityId: string;
      streamName: string;
      entity: EntityRoot<any, any>;
    }> = [];

    for (const { entityId, params, streamName } of entityEntries) {
      const loaded = loadedStreams.get(streamName);
      const state = loaded?.state ?? Entity.initialState;

      const entity = Entity.fromState(state);
      const outcome = handler.route(entity, params);
      if (!outcome.ok) {
        toEmmettError(outcome);
      }

      entityResults.push({ entityId, streamName, entity });
    }

    return this.persistBatchResults(Entity, entityResults);
  }

  // ── Upsert batch dispatch ─────────────────────────────────────

  /**
   * Dispatches a batch upsert: bulk load → initialize or update per entity → atomic persist.
   */
  private async dispatchUpsertBatch(
    handler: IEntityUpsertBatchHandler<EntityRoot<any, any>, any, any>,
    command: { type: string; [key: string]: unknown },
  ): Promise<BatchCommandResult> {
    const Entity = handler.Entity as EntityClass<EntityRoot<any, any>>;
    const singleCommands = handler.buildSingleCommands(command);

    const entityEntries = [...singleCommands.entries()].map(([entityId, params]) => ({
      entityId,
      params,
      streamName: EntityRef.newId(Entity.streamType, entityId).toStreamName(),
    }));

    const streamNames = entityEntries.map((e) => e.streamName);
    const loadedStreams = await this.loadStreams(Entity, streamNames);

    const entityResults: Array<{
      entityId: string;
      streamName: string;
      entity: EntityRoot<any, any>;
    }> = [];

    for (const { entityId, params, streamName } of entityEntries) {
      const loaded = loadedStreams.get(streamName);
      const state = loaded?.state ?? Entity.initialState;
      const exists = loaded?.exists ?? false;

      const entity = Entity.fromState(state);
      const outcome = exists
        ? handler.update(entity, params)
        : handler.initialize(entity, params);
      if (!outcome.ok) {
        toEmmettError(outcome);
      }

      entityResults.push({ entityId, streamName, entity });
    }

    return this.persistBatchResults(Entity, entityResults);
  }

  // ── CreateIfNotFound batch dispatch ───────────────────────────

  /**
   * Dispatches a batch create-if-not-found: bulk load → skip existing → initialize new → atomic persist.
   */
  private async dispatchCreateIfNotFoundBatch(
    handler: IEntityCreateIfNotFoundBatchHandler<EntityRoot<any, any>, any, any>,
    command: { type: string; [key: string]: unknown },
  ): Promise<BatchCommandResult> {
    const Entity = handler.Entity as EntityClass<EntityRoot<any, any>>;
    const singleCommands = handler.buildSingleCommands(command);

    const entityEntries = [...singleCommands.entries()].map(([entityId, params]) => ({
      entityId,
      params,
      streamName: EntityRef.newId(Entity.streamType, entityId).toStreamName(),
    }));

    const streamNames = entityEntries.map((e) => e.streamName);
    const loadedStreams = await this.loadStreams(Entity, streamNames);

    const entityResults: Array<{
      entityId: string;
      streamName: string;
      entity: EntityRoot<any, any>;
    }> = [];

    for (const { entityId, params, streamName } of entityEntries) {
      const loaded = loadedStreams.get(streamName);
      const exists = loaded?.exists ?? false;

      if (exists) {
        // Already exists — no-op. Still include in results with empty events.
        const entity = Entity.fromState(loaded!.state);
        entityResults.push({ entityId, streamName, entity });
        continue;
      }

      const entity = Entity.fromState(Entity.initialState);
      const outcome = handler.initialize(entity, params);
      if (!outcome.ok) {
        toEmmettError(outcome);
      }

      entityResults.push({ entityId, streamName, entity });
    }

    return this.persistBatchResults(Entity, entityResults);
  }

  // ── Process dispatch ──────────────────────────────────────────

  /**
   * Dispatches a process command: handler orchestrates everything.
   */
  private async dispatchProcess(
    handler: IEntityProcessHandler<any>,
    command: { type: string; [key: string]: unknown },
  ): Promise<CommandResult> {
    const outcome = await handler.run(command, this);
    if (!outcome.ok) {
      toEmmettError(outcome);
    }
    return { newState: undefined, newEvents: [] };
  }

  // ── Shared batch persistence ──────────────────────────────────

  /**
   * Collects uncommitted events from all entities and persists them.
   * Used by all batch dispatch methods.
   */
  private async persistBatchResults(
    _Entity: EntityClass<EntityRoot<any, any>>,
    entityResults: Array<{
      entityId: string;
      streamName: string;
      entity: EntityRoot<any, any>;
    }>,
  ): Promise<BatchCommandResult> {
    const writes: StreamWriteOperation[] = [];
    const results = new Map<string, CommandResult>();
    const allNewEvents: Event[] = [];

    for (const { entityId, streamName, entity } of entityResults) {
      const uncommitted = [...entity.getUncommittedEvents()];
      if (uncommitted.length > 0) {
        writes.push({ streamName, events: uncommitted as Event[] });
      }
      results.set(entityId, { newState: entity.getState(), newEvents: uncommitted as Event[] });
      allNewEvents.push(...(uncommitted as Event[]));
    }

    if (writes.length > 0) {
      if (this.transactional && isMongoStore(this.store)) {
        await appendToStreamsTransactionally(
          this.transactional.client,
          this.store,
          writes,
          this.transactional.inlineProjections,
        );
      } else {
        // Parallel non-transactional appends (works with any EventStore)
        await Promise.all(
          writes.map((w) =>
            this.store.appendToStream(w.streamName, [...w.events]),
          ),
        );
      }
    }

    return { results, allNewEvents };
  }

  // ── Stream loading ──────────────────────────────────────────────

  /**
   * Loads multiple streams, using bulk load for MongoDB or individual reads as fallback.
   */
  private async loadStreams(
    Entity: EntityClass<EntityRoot<any, any>>,
    streamNames: string[],
  ): Promise<Map<string, BulkStreamResult<unknown>>> {
    if (isMongoStore(this.store)) {
      // MongoDB: single find({ $in }) query
      return bulkLoadStreams(
        this.store,
        Entity.streamType,
        streamNames,
        Entity.replayState,
        () => Entity.initialState,
      );
    }

    // Fallback: individual readStream() calls in parallel
    const results = new Map<string, BulkStreamResult<unknown>>();
    await Promise.all(
      streamNames.map(async (streamName) => {
        try {
          const stream = await this.store.readStream(streamName);
          if (stream.events.length > 0) {
            let state: unknown = Entity.initialState;
            for (const event of stream.events) {
              state = Entity.replayState(state as any, event as any);
            }
            results.set(streamName, {
              state,
              exists: true,
              currentStreamVersion: BigInt(stream.events.length),
            });
          } else {
            results.set(streamName, {
              state: Entity.initialState,
              exists: false,
              currentStreamVersion: 0n,
            });
          }
        } catch {
          // Stream doesn't exist
          results.set(streamName, {
            state: Entity.initialState,
            exists: false,
            currentStreamVersion: 0n,
          });
        }
      }),
    );
    return results;
  }

  // ── Internal execution ──────────────────────────────────────────

  private async executeHandler(
    handler: IEntityCommandHandler<EntityRoot<any, any>, any>,
    Entity: EntityClass<EntityRoot<any, any>>,
    streamId: string,
    command: unknown,
  ): Promise<CommandResult> {
    const emmettHandler = CommandHandler({
      evolve: Entity.replayState,
      initialState: () => Entity.initialState,
    });

    return executeCommandHandlerCore({
      store: this.store,
      streamId,
      handler: emmettHandler,
      handle: (state) => {
        const entity = Entity.fromState(state);
        const outcome = handler.route(entity, command);
        if (!outcome.ok) {
          toEmmettError(outcome);
        }
        return [...entity.getUncommittedEvents()];
      },
    });
  }
}
