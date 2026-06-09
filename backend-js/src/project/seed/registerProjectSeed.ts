import { randomUUID } from "node:crypto";
import type { EventStore } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { registerSeedPhase } from "@/platform/seedService.js";
import { Project } from "@/project/domain/Project.js";
import { CreateProjectHandler } from "@/project/application/ProjectCommandHandlers.js";
import type { CreateProject } from "@/project/application/commands.js";
import { PROJECT_LIST_PROJECTION_NAME } from "@/project/projections/projectListProjection.js";

const DEFAULT_PROJECTS = [
  {
    name: "Sample Project",
    color: "#3B82F6",
    description: "Sample project for task management",
  },
] as const;

/**
 * Registers the idempotent project seed phase.
 */
export function registerProjectSeedPhase(): void {
  registerSeedPhase({
    name: "default-projects",
    isNeeded: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const count = await store.projections.inline.count(
        { streamType: Project.streamType, projectionName: PROJECT_LIST_PROJECTION_NAME },
      );
      return count === 0;
    },
    run: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const now = new Date();

      const bus = new EntityCommandBus(store);
      bus.register(new CreateProjectHandler());

      for (const project of DEFAULT_PROJECTS) {
        const projectId = randomUUID();
        const command: CreateProject = {
          type: "CreateProject",
          data: {
            id: projectId,
            name: project.name,
            description: project.description,
            color: project.color,
          },
          metadata: { now },
        };

        await bus.send(command);
      }
    },
  });
}

// Side-effect registration on import
registerProjectSeedPhase();
