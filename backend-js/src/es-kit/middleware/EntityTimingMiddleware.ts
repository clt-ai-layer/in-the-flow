import type { BusBehavior, BusBehaviorContext, CommandResult } from "../bus/EntityCommandBus.js";

/**
 * Measures and logs command execution duration.
 *
 * @description Uses `performance.now()` for sub-millisecond precision.
 * Place after `EntityLoggingMiddleware` to time only the downstream pipeline.
 */
export class EntityTimingMiddleware implements BusBehavior {
  async handle(
    ctx: BusBehaviorContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const start = performance.now();
    try {
      const result = await next();
      const elapsed = (performance.now() - start).toFixed(2);
      console.log(`⏱ [${ctx.commandType}] ${elapsed}ms`);
      return result;
    } catch (error) {
      const elapsed = (performance.now() - start).toFixed(2);
      console.log(`⏱ [${ctx.commandType}] ${elapsed}ms (failed)`);
      throw error;
    }
  }
}
