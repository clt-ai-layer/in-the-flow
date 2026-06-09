import type { EntityRoot } from "../domain/EntityRoot.js";
import type { Outcome } from "../domain/Outcome.js";
import type { EntityClass } from "./types.js";

// ── CreateIfNotFound handler interface ──────────────────────────

/**
 * Idempotent create handler — creates only if stream does not exist.
 *
 * @description Equivalent to a DDD `ICreateIfNotFoundCommandHandler`.
 * If the stream already exists, the handler returns success without
 * modifying the entity (no-op). If the stream is new, {@link initialize}
 * is called.
 *
 * @businessScenario Integration handlers that may receive duplicate events.
 * Seed operations that should not fail on re-run.
 *
 * @example
 * ```typescript
 * class EnsureProjectExistsHandler
 *   implements IEntityCreateIfNotFoundHandler<Project, EnsureProjectExists>
 * {
 *   readonly commandType = "EnsureProjectExists";
 *   readonly Entity = Project;
 *
 *   getEntityId(command: EnsureProjectExists): string {
 *     return command.data.projectId;
 *   }
 *
 *   initialize(entity: Project, command: EnsureProjectExists): Outcome<void> {
 *     return entity.create(command.data);
 *   }
 * }
 * ```
 */
export interface IEntityCreateIfNotFoundHandler<
  TEntity extends EntityRoot<any, any>,
  TCommand,
> {
  /** The command type string. */
  readonly commandType: string;
  /** The entity class used to create instances and resolve stream type. */
  readonly Entity: EntityClass<TEntity>;
  /** Extracts the entity/stream ID from the command envelope. */
  getEntityId(command: TCommand): string;
  /** Called ONLY when the stream does NOT exist. */
  initialize(entity: TEntity, command: TCommand): Outcome<void>;
}

// ── CreateIfNotFound batch handler interface ────────────────────

/**
 * Batch idempotent create handler — creates only entities that don't exist.
 *
 * @description Equivalent to a DDD `ICreateIfNotFoundMultipleCommandHandler`.
 * Skips already-existing streams (no-op), creates only new ones.
 *
 * @businessScenario Idempotent batch imports. Re-running a sync that may have
 * partially succeeded.
 */
export interface IEntityCreateIfNotFoundBatchHandler<
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
  /** Called ONLY for entities whose stream does NOT exist. Existing entities are skipped. */
  initialize(entity: TEntity, params: TSingleParams): Outcome<void>;
}
