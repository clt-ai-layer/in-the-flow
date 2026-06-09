import type { EntityRoot } from "../domain/EntityRoot.js";
import type { Outcome } from "../domain/Outcome.js";
import type { EntityClass } from "./types.js";

// ── Handler interface ───────────────────────────────────────────

/**
 * Command handler interface for Entity Kit.
 *
 * @description Handlers are pure routing adapters — they extract the entity ID
 * from the command and delegate to entity domain methods. The bus orchestrates
 * execution (state loading, event persistence, afterCommit).
 *
 * Distinct from traditional `ICreateCommandHandler` / `IUpdateCommandHandler`
 * to avoid name collisions across the monorepo.
 *
 * @example
 * ```typescript
 * class CreateDailyTaskHandler implements IEntityCreateHandler<DailyTask, CreateDailyTask> {
 *   readonly commandType = "CreateDailyTask";
 *   readonly Entity = DailyTask;
 *
 *   getEntityId(command: CreateDailyTask): string {
 *     return command.data.id ?? randomUUID();
 *   }
 *
 *   route(entity: DailyTask, command: CreateDailyTask): Outcome<void> {
 *     return entity.create(command.data, command.metadata?.now);
 *   }
 * }
 * ```
 */
export interface IEntityCommandHandler<
  TEntity extends EntityRoot<any, any>,
  TCommand,
> {
  /** The command type string this handler processes, e.g. `"CreateDailyTask"`. */
  readonly commandType: string;
  /** The entity class used to create instances and resolve stream type. */
  readonly Entity: EntityClass<TEntity>;
  /** Extracts the entity/stream ID from the command envelope. */
  getEntityId(command: TCommand): string;
  /** Routes command → entity domain method. Returns `Outcome<void>` for validation. */
  route(entity: TEntity, command: TCommand): Outcome<void>;
}

// ── Semantic marker interfaces ──────────────────────────────────
// Same contract, named for clarity and documentation.
// Names are distinct from traditional ICreateCommandHandler etc.

/**
 * Handler for entity creation commands.
 * @description Equivalent to a DDD `ICreateCommandHandler`.
 */
export interface IEntityCreateHandler<
  TEntity extends EntityRoot<any, any>,
  TCommand,
> extends IEntityCommandHandler<TEntity, TCommand> {}

/**
 * Handler for entity update commands.
 * @description Equivalent to a DDD `IUpdateCommandHandler`.
 */
export interface IEntityUpdateHandler<
  TEntity extends EntityRoot<any, any>,
  TCommand,
> extends IEntityCommandHandler<TEntity, TCommand> {}

/**
 * Handler for entity deletion commands.
 */
export interface IEntityDeleteHandler<
  TEntity extends EntityRoot<any, any>,
  TCommand,
> extends IEntityCommandHandler<TEntity, TCommand> {}
