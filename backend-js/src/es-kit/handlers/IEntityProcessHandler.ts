import type { Outcome } from "../domain/Outcome.js";

// ── Process handler interface ───────────────────────────────────

/**
 * Process handler for cross-aggregate orchestration.
 *
 * @description Equivalent to a DDD `ICommandProcessHandler`.
 * Unlike other handlers, the bus does NOT automatically load or create
 * an entity. The handler receives the bus and manages its own entity
 * loading, cross-aggregate coordination, and sub-command dispatch.
 *
 * @businessScenario
 * - Cross-aggregate workflows (e.g., "archive project and cascade to all tasks")
 * - Commands that spawn sub-commands via the bus
 * - Complex validation requiring multiple aggregate lookups
 * - Commands that don't fit the single-aggregate Create/Update pattern
 *
 * @example
 * ```typescript
 * class ArchiveProjectCascadeHandler
 *   implements IEntityProcessHandler<ArchiveProjectCascade>
 * {
 *   readonly commandType = "ArchiveProjectCascade";
 *
 *   async run(
 *     command: ArchiveProjectCascade,
 *     bus: EntityCommandBus,
 *   ): Promise<Outcome<void>> {
 *     // Archive the project
 *     await bus.send({ type: "ArchiveProject", data: { id: command.data.projectId } });
 *
 *     // Cascade to all tasks
 *     for (const taskId of command.data.taskIds) {
 *       await bus.send({ type: "ArchiveTask", data: { id: taskId } });
 *     }
 *
 *     return Outcome.ok();
 *   }
 * }
 * ```
 */
export interface IEntityProcessHandler<TCommand> {
  /** The command type string. */
  readonly commandType: string;
  /**
   * Orchestrates the full workflow — handler manages entity loading,
   * cross-aggregate coordination, and sub-command dispatch.
   *
   * @param command - The command to process.
   * @param bus - The command bus for dispatching sub-commands.
   * @returns Outcome indicating success or failure.
   */
  run(command: TCommand, bus: any): Promise<Outcome<void>>;
}
