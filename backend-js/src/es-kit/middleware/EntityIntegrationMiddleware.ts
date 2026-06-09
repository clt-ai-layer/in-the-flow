import type { Event } from "@event-driven-io/emmett";
import type {
  BusBehavior,
  BusBehaviorContext,
  CommandResult,
  EntityCommandBus,
} from "../bus/EntityCommandBus.js";

/**
 * Handler for cross-aggregate consistency — reacts to committed events.
 *
 * @description Registered with {@link EntityIntegrationMiddleware}. After a command's
 * events are persisted, the middleware dispatches matching events to all registered
 * integration handlers. Handlers may send further commands via the bus.
 *
 * Replaces manual side-effect wiring (e.g. `taskSideEffects.onTaskCreated`).
 *
 * @example
 * ```typescript
 * class TaskIntegrationHandler implements IEntityIntegrationHandler {
 *   readonly sourceEventTypes = ["TaskCreated", "TaskUpdated", "TaskDeleted"];
 *
 *   async handle(events, bus) {
 *     for (const event of events) {
 *       if (event.type === "TaskDeleted") {
 *         // Cascade delete linked daily tasks
 *         await bus.send({ type: "DeleteDailyTask", data: { id: dt.id } });
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface IEntityIntegrationHandler {
  /** Event types this handler subscribes to. */
  readonly sourceEventTypes: ReadonlyArray<string>;
  /** Called after events are persisted. May send further commands via the bus. */
  handle(
    events: ReadonlyArray<Event>,
    bus: EntityCommandBus,
  ): Promise<void>;
}

/**
 * Pipeline middleware that dispatches cross-aggregate integration events.
 *
 * @description Wraps command execution: calls `next()` first to persist events,
 * then dispatches matching events to registered {@link IEntityIntegrationHandler}s.
 *
 * Integration handlers run **after** the primary command's events are committed (ADR-002).
 * If an integration handler fails, the primary events are NOT rolled back.
 */
export class EntityIntegrationMiddleware implements BusBehavior {
  private readonly integrationHandlers: IEntityIntegrationHandler[] = [];

  constructor(private readonly bus: EntityCommandBus) {}

  /** Register an integration handler for cross-aggregate consistency. */
  register(handler: IEntityIntegrationHandler): this {
    this.integrationHandlers.push(handler);
    return this;
  }

  async handle(
    ctx: BusBehaviorContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const result = await next();

    if (result.newEvents.length === 0 || this.integrationHandlers.length === 0) {
      return result;
    }

    for (const handler of this.integrationHandlers) {
      const matching = result.newEvents.filter((event) =>
        handler.sourceEventTypes.includes((event as Event & { type: string }).type),
      );
      if (matching.length > 0) {
        await handler.handle(matching, this.bus);
      }
    }

    return result;
  }
}
