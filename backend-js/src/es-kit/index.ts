export { Outcome, type OutcomeErrorCode } from "./domain/Outcome.js";
export type { Outcome as OutcomeType } from "./domain/Outcome.js";
export { toEmmettError } from "./domain/toEmmettError.js";
export { EntityRef } from "./domain/EntityRef.js";
export { EntityRoot } from "./domain/EntityRoot.js";
export { runEntity, type EntityExecutorOptions } from "./bus/EntityExecutor.js";
export {
  type EntityReactionContext,
  type EntityReactionHandler,
} from "./projections/EntityReactions.js";
export {
  defineEntityReadModel,
  type projectReadModel,
} from "./projections/defineEntityReadModel.js";
export {
  type IEntityCommandHandler,
  type IEntityCreateHandler,
  type IEntityUpdateHandler,
  type IEntityDeleteHandler,
} from "./handlers/IEntityCommandHandler.js";
export {
  type IEntityBatchHandler,
  type IEntityCreateBatchHandler,
  type IEntityUpdateBatchHandler,
} from "./handlers/IEntityBatchHandler.js";
export {
  type IEntityUpsertHandler,
  type IEntityUpsertBatchHandler,
} from "./handlers/IEntityUpsertHandler.js";
export {
  type IEntityCreateIfNotFoundHandler,
  type IEntityCreateIfNotFoundBatchHandler,
} from "./handlers/IEntityCreateIfNotFoundHandler.js";
export {
  type IEntityProcessHandler,
} from "./handlers/IEntityProcessHandler.js";
export {
  type EntityClass,
  type StateOf,
  type EventOf,
} from "./handlers/types.js";
export {
  EntityCommandBus,
  type BusBehavior,
  type BusBehaviorContext,
  type CommandResult,
  type BatchCommandResult,
  type TransactionalConfig,
} from "./bus/EntityCommandBus.js";
export {
  appendToStreamsTransactionally,
  type StreamWriteOperation,
  type TransactionalAppendResult,
} from "./persistence/TransactionalAppender.js";
export {
  bulkLoadStreams,
  type BulkStreamResult,
} from "./persistence/BulkStreamLoader.js";
export { EntityLoggingMiddleware } from "./middleware/EntityLoggingMiddleware.js";
export { EntityTimingMiddleware } from "./middleware/EntityTimingMiddleware.js";
export {
  EntityIntegrationMiddleware,
  type IEntityIntegrationHandler,
} from "./middleware/EntityIntegrationMiddleware.js";
export { EntityContextMiddleware } from "./middleware/EntityContextMiddleware.js";
export { CommandContext, type CommandContextData } from "./logging/CommandContext.js";
export { writeCommandLog } from "./logging/CommandFileLogger.js";
