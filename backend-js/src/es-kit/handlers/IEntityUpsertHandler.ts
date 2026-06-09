import type { EntityRoot } from "../domain/EntityRoot.js";
import type { Outcome } from "../domain/Outcome.js";
import type { EntityClass } from "./types.js";

// ── Upsert handler interface ────────────────────────────────────

/**
 * Upsert (create-or-update) handler for a single entity.
 *
 * @description Equivalent to a DDD `ICreateIfNotFoundAndUpdateCommandHandler`.
 * The bus checks whether the stream exists:
 * - **Not found** → calls {@link initialize}
 * - **Found** → calls {@link update}
 *
 * This moves the create-or-update branching from the route layer into the
 * domain handler where it belongs.
 *
 * @example
 * ```typescript
 * class UpsertTaskHandler
 *   implements IEntityUpsertHandler<Task, UpsertTaskCommand>
 * {
 *   readonly commandType = "UpsertTask";
 *   readonly Entity = Task;
 *
 *   getEntityId(command: UpsertTaskCommand): string {
 *     return command.data.id;
 *   }
 *
 *   initialize(entity: Task, command: UpsertTaskCommand): Outcome<void> {
 *     return entity.create(command.data);
 *   }
 *
 *   update(entity: Task, command: UpsertTaskCommand): Outcome<void> {
 *     return entity.update(command.data);
 *   }
 * }
 * ```
 */
export interface IEntityUpsertHandler<
  TEntity extends EntityRoot<any, any>,
  TCommand,
> {
  /** The command type string, e.g. `"UpsertTask"`. */
  readonly commandType: string;
  /** The entity class used to create instances and resolve stream type. */
  readonly Entity: EntityClass<TEntity>;
  /** Extracts the entity/stream ID from the command envelope. */
  getEntityId(command: TCommand): string;
  /** Called when the stream does NOT exist (new entity). */
  initialize(entity: TEntity, command: TCommand): Outcome<void>;
  /** Called when the stream already exists. */
  update(entity: TEntity, command: TCommand): Outcome<void>;
}

// ── Upsert batch handler interface ──────────────────────────────

/**
 * Batch upsert (create-or-update) handler for multiple entities.
 *
 * @description Equivalent to a DDD
 * `ICreateIfNotFoundAndUpdateMultipleCommandHandler`. Combines batch
 * fan-out with per-entity create-or-update semantics.
 *
 * The bus bulk-loads all streams in one query, then for each entity:
 * - **Not found** → calls {@link initialize}
 * - **Found** → calls {@link update}
 *
 * Persistence is atomic via MongoDB transaction (when {@link TransactionalConfig}
 * is set on the bus).
 *
 * @businessScenario Bulk sync endpoints where each item may be new or existing.
 *
 * @example
 * ```typescript
 * class BulkSyncTasksHandler
 *   implements IEntityUpsertBatchHandler<Task, BulkSyncTasks, SyncTaskParams>
 * {
 *   readonly commandType = "BulkSyncTasks";
 *   readonly Entity = Task;
 *
 *   buildSingleCommands(command: BulkSyncTasks): Map<string, SyncTaskParams> {
 *     const map = new Map<string, SyncTaskParams>();
 *     for (const item of command.data.tasks) {
 *       map.set(item.id, item);
 *     }
 *     return map;
 *   }
 *
 *   initialize(entity: Task, params: SyncTaskParams): Outcome<void> {
 *     return entity.create(params);
 *   }
 *
 *   update(entity: Task, params: SyncTaskParams): Outcome<void> {
 *     return entity.update(params);
 *   }
 * }
 * ```
 */
export interface IEntityUpsertBatchHandler<
  TEntity extends EntityRoot<any, any>,
  TBatchCommand,
  TSingleParams = unknown,
> {
  /** The batch command type string. */
  readonly commandType: string;
  /** The entity class used to create instances and resolve stream type. */
  readonly Entity: EntityClass<TEntity>;
  /** Fans out a batch command into per-entity parameters. */
  buildSingleCommands(command: TBatchCommand): Map<string, TSingleParams>;
  /** Called when the stream does NOT exist (new entity). */
  initialize(entity: TEntity, params: TSingleParams): Outcome<void>;
  /** Called when the stream already exists. */
  update(entity: TEntity, params: TSingleParams): Outcome<void>;
}
