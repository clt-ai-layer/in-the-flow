import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Router } from "express";
import { ValidationError } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { toStreamName } from "@event-driven-io/emmett-mongodb";
import { asyncHandler } from "@/platform/fastApiErrorMiddleware.js";
import {
  filterReadModels,
  stripReadModelListMetadata,
  stripReadModelMetadata,
} from "@/platform/readModelUtils.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { Project } from "@/project/domain/Project.js";
import type { CreateProject } from "@/project/application/commands.js";
import {
  PROJECT_LIST_PROJECTION_NAME,
  type ProjectListDocument,
} from "@/project/projections/projectListProjection.js";

async function assertProjectNameUnique(
  eventStore: MongoDBEventStore,
  name: string,
): Promise<void> {
  const all = stripReadModelListMetadata(
    await eventStore.projections.inline.find<ProjectListDocument>({
      streamType: Project.streamType,
      projectionName: PROJECT_LIST_PROJECTION_NAME,
    }),
  );
  const existing = filterReadModels(all, { name });

  if (existing.length > 0) {
    throw new ValidationError(`Project with name '${name}' already exists.`);
  }
}

/**
 * Registers `/api/projects` REST routes with Python FastAPI parity.
 */
export function registerProjectRoutes(
  app: Express,
  eventStore: MongoDBEventStore,
  bus: EntityCommandBus,
): void {
  const router = Router();

  router.get(
    "",
    asyncHandler(async (_req, res) => {
      const projects = stripReadModelListMetadata(
        await eventStore.projections.inline.find<ProjectListDocument>(
          { streamType: Project.streamType, projectionName: PROJECT_LIST_PROJECTION_NAME },
        ),
      );
      res.json(projects);
    }),
  );

  router.post(
    "",
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const name = String(body.name ?? "");
      const now = new Date();
      const projectId = randomUUID();

      await assertProjectNameUnique(eventStore, name);

      const command: CreateProject = {
        type: "CreateProject",
        data: {
          id: projectId,
          name,
          description: body.description != null ? String(body.description) : null,
          color: body.color != null ? String(body.color) : undefined,
        },
        metadata: { now },
      };

      await bus.send(command);

      const streamName = toStreamName(Project.streamType, projectId);
      const createdDoc = await eventStore.projections.inline.findOne<ProjectListDocument>(
        { streamName, projectionName: PROJECT_LIST_PROJECTION_NAME },
      );

      const created = createdDoc ? stripReadModelMetadata(createdDoc) : null;

      res.status(201).json(created);
    }),
  );

  app.use("/api/projects", router);
}
