import type { EntityRoot } from "../domain/EntityRoot.js";
import type { Outcome } from "../domain/Outcome.js";
import type { EntityClass } from "./types.js";

// ── Batch handler interface ─────────────────────────────────────

/**
 * Batch command handler for Entity Kit — operates on multiple entities in parallel.
 *
 * @description Equivalent to the DDD `IMultipleCommandHandler`.
 * Takes a batch command, fans it out into `Map<entityId, TSingleParams>`,
 * then the bus loads all entities, routes each one, and persists events
 * via parallel `appendToStream` calls.
 *
 * **Not atomic** — each stream append is independent. If one fails, others
 * may already be committed. This is by design since Emmett treats each
 * stream as a transactional boundary.
 *
 * @example
 * ```typescript
 * class CreateMultipleTasksHandler
 *   implements IEntityCreateBatchHandler<Task, CreateMultipleTasks, CreateTaskParams>
 * {
 *   readonly commandType = "CreateMultipleTasks";
 *   readonly Entity = Task;
 *
 *   buildSingleCommands(command: CreateMultipleTasks): Map<string, CreateTaskParams> {
 *     const map = new Map<string, CreateTaskParams>();
 *     for (const item of command.data.tasks) {
 *       map.set(item.id ?? randomUUID(), item);
 *     }
 *     return map;
 *   }
 *
 *   route(entity: Task, params: CreateTaskParams): Outcome<void> {
 *     return entity.create(params);
 *   }
 * }
 * ```
 */
export interface IEntityBatchHandler<
  TEntity extends EntityRoot<any, any>,
  TBatchCommand,
  TSingleParams = unknown,
> {
  /** The batch command type string, e.g. `"CreateMultipleTasks"`. */
  readonly commandType: string;
  /** The entity class used to create instances and resolve stream type. */
  readonly Entity: EntityClass<TEntity>;
  /**
   * Fans out a batch command into per-entity parameters.
   *
   * @returns Map of entity ID → single command params. Each entry
   * will be routed to a separate entity instance.
   */
  buildSingleCommands(command: TBatchCommand): Map<string, TSingleParams>;
  /**
   * Routes a single entity + params to its domain method.
   *
   * @description Called once per entity in the batch. Same semantics as
   * {@link IEntityCommandHandler.route} — validates and mutates the entity.
   */
  route(entity: TEntity, params: TSingleParams): Outcome<void>;
}

// ── Batch semantic marker interfaces ────────────────────────────

/**
 * Batch handler for entity creation commands.
 * @description Equivalent to the DDD `ICreateMultipleCommandHandler`.
 */
export interface IEntityCreateBatchHandler<
  TEntity extends EntityRoot<any, any>,
  TBatchCommand,
  TSingleParams = unknown,
> extends IEntityBatchHandler<TEntity, TBatchCommand, TSingleParams> {}

/**
 * Batch handler for entity update commands.
 * @description Equivalent to the DDD `IUpdateMultipleCommandHandler`.
 */
export interface IEntityUpdateBatchHandler<
  TEntity extends EntityRoot<any, any>,
  TBatchCommand,
  TSingleParams = unknown,
> extends IEntityBatchHandler<TEntity, TBatchCommand, TSingleParams> {}
