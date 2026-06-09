import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { EventStore } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { findBackendJsRoot } from "@/platform/pathUtils.js";
import { registerSeedPhase } from "@/platform/seedService.js";
import { Task } from "@/task/domain/Task.js";
import { CreateTaskHandler } from "@/task/application/TaskCommandHandlers.js";
import type { CreateTask } from "@/task/application/commands.js";
import { normalizeStatus } from "@/task/domain/taskStatus.js";
import { TASK_LIST_PROJECTION_NAME } from "@/task/projections/taskListProjection.js";
import { PROJECT_LIST_PROJECTION_NAME } from "@/project/projections/projectListProjection.js";
import { Project } from "@/project/domain/Project.js";

type SeedTaskEntry = {
  name: string;
  status: string;
  project?: string;
  source?: string;
};

type SeedTasksFile = {
  business?: SeedTaskEntry[];
  technical?: SeedTaskEntry[];
};

/**
 * Registers the idempotent task seed phase (runs after projects).
 */
export function registerTaskSeedPhase(): void {
  registerSeedPhase({
    name: "seed-tasks",
    isNeeded: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const count = await store.projections.inline.count(
        { streamType: Task.streamType, projectionName: TASK_LIST_PROJECTION_NAME },
      );
      return count === 0;
    },
    run: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const backendRoot = findBackendJsRoot();
      if (!backendRoot) {
        console.warn("Task seed skipped: backend-js root not found.");
        return;
      }
      const seedPath = join(backendRoot, "seed", "seed_tasks.json");

      let data: SeedTasksFile;
      try {
        data = JSON.parse(readFileSync(seedPath, "utf-8")) as SeedTasksFile;
      } catch {
        console.warn(`Task seed file not found or unreadable at: ${seedPath}`);
        return;
      }

      const projects = await store.projections.inline.find<{ id: string; name: string }>(
        { streamType: Project.streamType, projectionName: PROJECT_LIST_PROJECTION_NAME },
      );
      const defaultProject = projects[0];
      const projectId = defaultProject?.id ?? null;
      const now = new Date();

      const bus = new EntityCommandBus(store);
      bus.register(new CreateTaskHandler());

      const seedEntries: Array<{ entry: SeedTaskEntry; category: string }> = [
        ...(data.business ?? []).map((entry) => ({ entry, category: "business" })),
        ...(data.technical ?? []).map((entry) => ({ entry, category: "dev" })),
      ];

      for (const { entry, category } of seedEntries) {
        const taskId = randomUUID();
        const command: CreateTask = {
          type: "CreateTask",
          data: {
            id: taskId,
            name: entry.name,
            status: normalizeStatus(entry.status),
            category,
            source: entry.source ?? "NotionArch",
            project_id: projectId,
          },
          metadata: { now },
        };

        await bus.send(command);
      }
    },
  });
}

registerTaskSeedPhase();
