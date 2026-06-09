import { describe, expect, it } from "vitest";
import {
  EntityRef,
  EntityRoot,
  EntityCommandBus,
  EntityLoggingMiddleware,
  EntityTimingMiddleware,
  EntityIntegrationMiddleware,
  Outcome,
  defineEntityReadModel,
  runEntity,
  toEmmettError,
  type EntityExecutorOptions,
  type EntityReactionContext,
  type EntityReactionHandler,
  type projectReadModel,
  type IEntityCommandHandler,
  type IEntityCreateHandler,
  type IEntityUpdateHandler,
  type IEntityDeleteHandler,
  type IEntityBatchHandler,
  type IEntityCreateBatchHandler,
  type IEntityUpdateBatchHandler,
  type IEntityUpsertHandler,
  type IEntityCreateIfNotFoundHandler,
  type IEntityUpsertBatchHandler,
  type IEntityCreateIfNotFoundBatchHandler,
  type IEntityProcessHandler,
  type EntityClass,
  type StateOf,
  type EventOf,
  type BusBehavior,
  type BusBehaviorContext,
  type CommandResult,
  type BatchCommandResult,
  type TransactionalConfig,
  type IEntityIntegrationHandler,
  appendToStreamsTransactionally,
  type StreamWriteOperation,
  type TransactionalAppendResult,
  bulkLoadStreams,
  type BulkStreamResult,
} from "@/es-kit/index.js";

describe("es-kit barrel", () => {
  it("exports public symbols", () => {
    expect(Outcome.ok(1)).toEqual({ ok: true, value: 1 });
    expect(Outcome.unit()).toEqual({ ok: true, value: undefined });
    expect(EntityRef.singleton("settings").id).toBe("global");
    expect(typeof EntityRoot).toBe("function");
    expect(typeof EntityCommandBus).toBe("function");
    expect(typeof EntityLoggingMiddleware).toBe("function");
    expect(typeof EntityTimingMiddleware).toBe("function");
    expect(typeof EntityIntegrationMiddleware).toBe("function");
    expect(typeof runEntity).toBe("function");
    expect(typeof toEmmettError).toBe("function");
    expect(typeof defineEntityReadModel).toBe("function");
    // Type-only exports (verify they compile)
    expect(typeof (null as unknown as EntityExecutorOptions<never, never, never, never>)).toBe(
      "object",
    );
    expect(typeof (null as unknown as EntityReactionContext)).toBe("object");
    expect(typeof (null as unknown as EntityReactionHandler)).toBe("object");
    expect(typeof (null as unknown as projectReadModel<unknown, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityCommandHandler<never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityCreateHandler<never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityUpdateHandler<never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityDeleteHandler<never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityBatchHandler<never, never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityCreateBatchHandler<never, never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityUpdateBatchHandler<never, never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityUpsertHandler<never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityCreateIfNotFoundHandler<never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityUpsertBatchHandler<never, never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityCreateIfNotFoundBatchHandler<never, never, never>)).toBe("object");
    expect(typeof (null as unknown as IEntityProcessHandler<never>)).toBe("object");
    expect(typeof (null as unknown as EntityClass<never>)).toBe("object");
    expect(typeof (null as unknown as StateOf<never>)).toBe("object");
    expect(typeof (null as unknown as EventOf<never>)).toBe("object");
    expect(typeof (null as unknown as BusBehavior)).toBe("object");
    expect(typeof (null as unknown as BusBehaviorContext)).toBe("object");
    expect(typeof (null as unknown as CommandResult)).toBe("object");
    expect(typeof (null as unknown as BatchCommandResult)).toBe("object");
    expect(typeof (null as unknown as TransactionalConfig)).toBe("object");
    expect(typeof (null as unknown as IEntityIntegrationHandler)).toBe("object");
    expect(typeof appendToStreamsTransactionally).toBe("function");
    expect(typeof (null as unknown as StreamWriteOperation)).toBe("object");
    expect(typeof (null as unknown as TransactionalAppendResult)).toBe("object");
    expect(typeof bulkLoadStreams).toBe("function");
    expect(typeof (null as unknown as BulkStreamResult<unknown>)).toBe("object");
  });
});
