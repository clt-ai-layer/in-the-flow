import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Router } from "express";
import { IllegalStateError, NotFoundError } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { asyncHandler } from "@/platform/fastApiErrorMiddleware.js";
import {
  filterReadModels,
  stripReadModelListMetadata,
  stripReadModelMetadata,
} from "@/platform/readModelUtils.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { EntityRef } from "@/es-kit/domain/EntityRef.js";
import type { CreateTask, UpdateTask } from "@/task/application/commands.js";
import { Task } from "@/task/domain/Task.js";
import { validateTaskStatus } from "@/task/domain/taskStatus.js";
import {
  TASK_LIST_PROJECTION_NAME,
  type TaskListDocument,
} from "@/task/projections/taskListProjection.js";

const IMMUTABLE_TASK_FIELDS = new Set(["id", "created_at"]);

type BulkSyncUpdate = {
  id: string;
  name?: string;
  description?: string;
  status?: string;
  category?: string;
  owner?: string;
  task_grouping?: string;
  archived?: boolean;
  estimated_duration?: number;
  current_duration?: number;
};

type BulkSyncCreate = {
  name: string;
  description?: string;
  status?: string;
  category?: string;
  owner?: string;
  task_grouping?: string;
  estimated_duration?: number;
  current_duration?: number;
};

type BulkSyncPayload = {
  updates?: BulkSyncUpdate[];
  creations?: BulkSyncCreate[];
};

function buildPatch(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (!IMMUTABLE_TASK_FIELDS.has(key)) {
      patch[key] = body[key];
    }
  }
  return patch;
}

function parseIncludeArchived(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  return value === true || value === "true" || value === "1";
}

function applySearchFilter(
  tasks: TaskListDocument[],
  search: string | undefined,
): TaskListDocument[] {
  if (!search) {
    return tasks;
  }

  const term = search.toLowerCase();
  return tasks.filter(
    (task) =>
      task.name.toLowerCase().includes(term) ||
      (task.description ?? "").toLowerCase().includes(term),
  );
}

async function findTaskById(
  eventStore: MongoDBEventStore,
  taskId: string,
): Promise<TaskListDocument | null> {
  const streamName = EntityRef.newId(Task.streamType, taskId).toStreamName();
  const doc = await eventStore.projections.inline.findOne<TaskListDocument>(
    { streamName, projectionName: TASK_LIST_PROJECTION_NAME },
  );
  return doc ? stripReadModelMetadata(doc) : null;
}

async function findDefaultProjectId(
  eventStore: MongoDBEventStore,
): Promise<string | null> {
  const projects = await eventStore.projections.inline.find<{ name: string; id: string }>(
    { streamType: "project", projectionName: "project_list" },
  );

  return projects[0]?.id ?? null;
}

/**
 * Registers `/api/tasks` REST routes with Python FastAPI parity.
 */
export function registerTaskRoutes(
  app: Express,
  eventStore: MongoDBEventStore,
  bus: EntityCommandBus,
): void {
  const router = Router();

  router.get(
    "",
    asyncHandler(async (req, res) => {
      const includeArchived = parseIncludeArchived(req.query.include_archived);
      const mongoQuery: Record<string, unknown> = {};

      if (!includeArchived) {
        mongoQuery.archived = false;
      }
      if (typeof req.query.category === "string" && req.query.category) {
        mongoQuery.category = req.query.category;
      }
      if (typeof req.query.status === "string" && req.query.status) {
        mongoQuery.status = req.query.status;
      }
      if (typeof req.query.project_id === "string" && req.query.project_id) {
        mongoQuery.project_id = req.query.project_id;
      }

      let tasks = stripReadModelListMetadata(
        await eventStore.projections.inline.find<TaskListDocument>({
          streamType: Task.streamType,
          projectionName: TASK_LIST_PROJECTION_NAME,
        }),
      );
      tasks = filterReadModels(tasks, mongoQuery);

      const search =
        typeof req.query.search === "string" ? req.query.search : undefined;
      tasks = applySearchFilter(tasks, search);

      res.json(tasks);
    }),
  );

  router.post(
    "/bulk-sync",
    asyncHandler(async (req, res) => {
      const payload = req.body as BulkSyncPayload;
      const updates = payload.updates ?? [];
      const creations = payload.creations ?? [];
      const now = new Date();

      const defaultProjectId = await findDefaultProjectId(eventStore);

      // Phase 1: Build all commands (validate status, build patches)
      const updateCommands: UpdateTask[] = [];
      for (const update of updates) {
        const patch: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(update)) {
          if (key !== "id" && value !== undefined) {
            if (key === "status" && value !== null) {
              try {
                patch[key] = validateTaskStatus(String(value));
              } catch (error) {
                throw new IllegalStateError(
                  error instanceof Error ? error.message : String(error),
                );
              }
            } else {
              patch[key] = value;
            }
          }
        }

        if (Object.keys(patch).length === 0) {
          continue;
        }

        updateCommands.push({
          type: "UpdateTask",
          data: { id: update.id, patch },
          metadata: { now },
        });
      }

      const createCommands: CreateTask[] = [];
      for (const creation of creations) {
        let status = "backlog";
        if (creation.status !== undefined && creation.status !== null) {
          try {
            status = validateTaskStatus(creation.status);
          } catch (error) {
            throw new IllegalStateError(
              error instanceof Error ? error.message : String(error),
            );
          }
        }

        const taskId = randomUUID();
        createCommands.push({
          type: "CreateTask",
          data: {
            id: taskId,
            name: creation.name,
            description: creation.description ?? "",
            status,
            category: creation.category ?? "business",
            owner: creation.owner ?? "Alice",
            task_grouping: creation.task_grouping ?? "General",
            estimated_duration: creation.estimated_duration ?? 60,
            current_duration: creation.current_duration ?? 0,
            source: "planning",
            project_id: defaultProjectId,
            archived: false,
          },
          metadata: { now },
        });
      }

      // Phase 2: Dispatch all commands in parallel
      await Promise.all([
        ...updateCommands.map((cmd) => bus.send(cmd)),
        ...createCommands.map((cmd) => bus.send(cmd)),
      ]);

      res.json({
        status: "success",
        tasks_updated: updateCommands.length,
        tasks_created: createCommands.length,
      });
    }),
  );

  router.get(
    "/:taskId",
    asyncHandler(async (req, res) => {
      const task = await findTaskById(eventStore, req.params.taskId);
      if (!task) {
        throw new NotFoundError({
          id: req.params.taskId,
          type: "Task",
          message: `Task with ID '${req.params.taskId}' not found.`,
        });
      }
      res.json(task);
    }),
  );

  router.post(
    "",
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const now = new Date();
      const taskId = randomUUID();

      const command: CreateTask = {
        type: "CreateTask",
        data: {
          id: taskId,
          name: String(body.name ?? ""),
          description: body.description != null ? String(body.description) : null,
          status: body.status != null ? String(body.status) : undefined,
          category: body.category != null ? String(body.category) : undefined,
          source: body.source != null ? String(body.source) : undefined,
          owner: body.owner != null ? String(body.owner) : undefined,
          task_grouping:
            body.task_grouping != null ? String(body.task_grouping) : undefined,
          archived: body.archived != null ? Boolean(body.archived) : undefined,
          estimated_duration:
            body.estimated_duration != null ? Number(body.estimated_duration) : undefined,
          current_duration:
            body.current_duration != null ? Number(body.current_duration) : undefined,
          project_id: body.project_id != null ? String(body.project_id) : undefined,
        },
        metadata: { now },
      };

      await bus.send(command);

      const created = await findTaskById(eventStore, taskId);
      res.status(201).json(created);
    }),
  );

  router.put(
    "/:taskId",
    asyncHandler(async (req, res) => {
      const taskId = req.params.taskId;
      const patch = buildPatch(req.body as Record<string, unknown>);
      const now = new Date();

      const command: UpdateTask = {
        type: "UpdateTask",
        data: { id: taskId, patch },
        metadata: { now },
      };

      await bus.send(command);

      const updated = await findTaskById(eventStore, taskId);
      res.json(updated);
    }),
  );

  router.delete(
    "/:taskId",
    asyncHandler(async (req, res) => {
      const taskId = req.params.taskId;
      const now = new Date();

      await bus.send({
        type: "DeleteTask",
        data: { id: taskId },
        metadata: { now },
      });

      res.json({
        status: "success",
        message: `Task '${taskId}' deleted.`,
      });
    }),
  );

  app.use("/api/tasks", router);
}
