import type { Event } from "@event-driven-io/emmett";
import type { IEntityIntegrationHandler } from "@/es-kit/middleware/EntityIntegrationMiddleware.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import type { ProjectCreated } from "@/project/domain/events.js";
import type { ProjectListDocument } from "@/project/projections/projectListProjection.js";
import { getMongoClient } from "@/platform/mongoConfig.js";
import { upsertProjectRecord } from "@/views/projections/projectRecordProjection.js";

/**
 * Cross-aggregate integration handler for Project events.
 *
 * @processHandler
 * @workflow On ProjectCreated → dual-writes EAV project record to MongoDB.
 * @participatingAggregates Project (source) → EAV Records (side effect)
 * @errorHandling Primary events are NOT rolled back if the EAV write fails.
 */
export class ProjectIntegrationHandler implements IEntityIntegrationHandler {
  readonly sourceEventTypes = ["ProjectCreated"] as const;

  async handle(
    events: ReadonlyArray<Event>,
    _bus: EntityCommandBus,
  ): Promise<void> {
    for (const event of events) {
      if (event.type === "ProjectCreated") {
        await this.onProjectCreated(event as ProjectCreated);
      }
    }
  }

  /**
   * Dual-writes Projects Workspace EAV record on project create.
   */
  private async onProjectCreated(event: ProjectCreated): Promise<void> {
    const project = event.data as ProjectListDocument;
    const client = await getMongoClient();
    await upsertProjectRecord(client, project);
  }
}
