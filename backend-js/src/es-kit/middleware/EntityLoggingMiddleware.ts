import type { BusBehavior, BusBehaviorContext, CommandResult } from "../bus/EntityCommandBus.js";

/**
 * Logs command dispatches — entry, success (with event count), and failures.
 *
 * @description Provides visibility into the command pipeline. Place before
 * `EntityTimingMiddleware` in the behavior chain to include timing in logs.
 */
export class EntityLoggingMiddleware implements BusBehavior {
  async handle(
    ctx: BusBehaviorContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    console.log(
      `→ [${ctx.commandType}] on ${ctx.entityType}/${ctx.entityId}`,
    );
    try {
      const result = await next();
      console.log(
        `✓ [${ctx.commandType}] emitted ${result.newEvents.length} event(s)`,
      );
      return result;
    } catch (error) {
      console.error(
        `✗ [${ctx.commandType}] on ${ctx.entityType}/${ctx.entityId} failed:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }
}
