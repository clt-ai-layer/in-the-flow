/**
 * Pipeline behavior that wraps command execution in an `AsyncLocalStorage` context.
 *
 * @description Establishes a `CommandContext` scope around each command
 * execution, capturing:
 * - Command metadata (type, entity, ID)
 * - Timing (start → end, durationMs)
 * - Events emitted
 * - Success/failure status + error details
 *
 * When `ENTITY_LOG_FILE_ENABLED=true`, the context is flushed to a
 * JSON-Lines log file at the end of execution via {@link writeCommandLog}.
 *
 * **Pipeline position**: Should be the FIRST behavior in the chain
 * (before logging and timing) so that all downstream middleware
 * can read/enrich the context.
 *
 * @example
 * ```typescript
 * const bus = new EntityCommandBus(store);
 * bus.use(new EntityContextMiddleware());  // first
 * bus.use(new EntityLoggingMiddleware());  // reads context
 * bus.use(new EntityTimingMiddleware());   // enriches context
 * ```
 */
import { randomUUID } from "node:crypto";
import { CommandContext } from "../logging/CommandContext.js";
import { writeCommandLog } from "../logging/CommandFileLogger.js";
import type { BusBehavior, BusBehaviorContext, CommandResult } from "../bus/EntityCommandBus.js";

export class EntityContextMiddleware implements BusBehavior {
  async handle(
    ctx: BusBehaviorContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const contextData = CommandContext.create({
      commandId: randomUUID(),
      commandType: ctx.commandType,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
    });

    return CommandContext.run(contextData, async () => {
      CommandContext.log("info", "Command dispatched", {
        entityType: ctx.entityType,
        entityId: ctx.entityId,
      });

      try {
        const result = await next();

        // Enrich with success data
        CommandContext.enrich({
          eventsEmitted: result.newEvents.length,
          durationMs: parseFloat((performance.now() - contextData.startTime).toFixed(2)),
          status: "success",
        });

        CommandContext.log("info", `Handler completed — ${result.newEvents.length} event(s) emitted`);

        // Flush to file (fire-and-forget)
        void writeCommandLog(contextData);

        return result;
      } catch (error) {
        const elapsed = parseFloat((performance.now() - contextData.startTime).toFixed(2));

        CommandContext.enrich({
          durationMs: elapsed,
          status: "failure",
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });

        CommandContext.log("error", "Command execution failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        // Flush to file (fire-and-forget)
        void writeCommandLog(contextData);

        throw error;
      }
    }) as Promise<CommandResult>;
  }
}
