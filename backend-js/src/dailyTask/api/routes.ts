import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Router } from "express";
import { NotFoundError, ValidationError } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { toStreamName } from "@event-driven-io/emmett-mongodb";
import { asyncHandler } from "@/platform/fastApiErrorMiddleware.js";
import {
  filterReadModels,
  stripReadModelListMetadata,
  stripReadModelMetadata,
} from "@/platform/readModelUtils.js";
import { toEmmettError } from "@/es-kit/domain/toEmmettError.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { DailyTask } from "@/dailyTask/domain/DailyTask.js";
import {
  EMPTY_PARENT_FIELDS,
  parentFieldsFromTask,
  type DailyTaskParentFields,
} from "@/dailyTask/domain/events.js";
import { normalizeOwner, resolveOwner } from "@/dailyTask/domain/ValueObjects/Owner.js";
import type {
  CreateDailyTask,
  UpdateDailyTask,
} from "@/dailyTask/application/commands.js";
import {
  DAILY_TASK_PROJECTION_NAME,
  type DailyTaskDocument,
} from "@/dailyTask/projections/dailyTaskProjection.js";
import {
  TASK_LIST_PROJECTION_NAME,
  type TaskListDocument,
} from "@/task/projections/taskListProjection.js";
import { Task } from "@/task/domain/Task.js";

const IMMUTABLE_DAILY_TASK_FIELDS = new Set(["id", "created_at", "updated_at"]);

function buildPatch(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (!IMMUTABLE_DAILY_TASK_FIELDS.has(key)) {
      patch[key] = body[key];
    }
  }
  return patch;
}

function toResponse(doc: DailyTaskDocument): DailyTaskDocument {
  return {
    ...doc,
    owner: resolveOwner(doc.owner, null),
  };
}

function getDailyTaskStreamName(dailyTaskId: string) {
  return toStreamName(DailyTask.streamType, dailyTaskId);
}

async function findDailyTaskById(
  eventStore: MongoDBEventStore,
  dailyTaskId: string,
): Promise<DailyTaskDocument | null> {
  const doc = await eventStore.projections.inline.findOne<DailyTaskDocument>({
    streamName: getDailyTaskStreamName(dailyTaskId),
    projectionName: DAILY_TASK_PROJECTION_NAME,
  });
  return doc ? stripReadModelMetadata(doc) : null;
}

async function findTaskById(
  eventStore: MongoDBEventStore,
  taskId: string,
): Promise<TaskListDocument | null> {
  const doc = await eventStore.projections.inline.findOne<TaskListDocument>({
    streamName: toStreamName(Task.streamType, taskId),
    projectionName: TASK_LIST_PROJECTION_NAME,
  });
  return doc ? stripReadModelMetadata(doc) : null;
}

async function ensureTaskExists(
  eventStore: MongoDBEventStore,
  taskId: string,
): Promise<TaskListDocument> {
  const task = await findTaskById(eventStore, taskId);
  if (!task) {
    throw new NotFoundError({
      id: taskId,
      type: "Task",
      message: `Task with ID '${taskId}' not found.`,
    });
  }
  return task;
}

async function resolveParentFieldsForTaskId(
  eventStore: MongoDBEventStore,
  taskId: string | null | undefined,
): Promise<DailyTaskParentFields> {
  if (taskId == null) {
    return EMPTY_PARENT_FIELDS;
  }
  const task = await ensureTaskExists(eventStore, taskId);
  return parentFieldsFromTask(task);
}

function resolveCreateOwner(
  bodyOwner: unknown,
  parent: TaskListDocument | null,
): string {
  if (bodyOwner != null && bodyOwner !== "") {
    const result = normalizeOwner(String(bodyOwner));
    if (!result.ok) {
      toEmmettError(result);
    }
    return result.value;
  }
  if (parent?.owner) {
    const result = normalizeOwner(parent.owner);
    if (result.ok) {
      return result.value;
    }
  }
  return "Alice";
}

function validateListQueryParams(
  startDate: string | undefined,
  endDate: string | undefined,
  taskId: string | undefined,
): { mode: "calendar" | "task"; startDate?: string; endDate?: string; taskId?: string } {
  const hasStartDate = startDate !== undefined;
  const hasEndDate = endDate !== undefined;
  const hasDateRange = hasStartDate && hasEndDate;
  const hasTaskOnly = taskId !== undefined && !hasDateRange;

  if (hasStartDate !== hasEndDate) {
    throw new ValidationError(
      "start_date and end_date must be provided together.",
    );
  }

  if (!hasDateRange && !hasTaskOnly) {
    throw new ValidationError(
      "Provide either start_date and end_date together for calendar fetch, or task_id alone for task-scoped list.",
    );
  }

  if (hasDateRange) {
    return { mode: "calendar", startDate, endDate, taskId };
  }

  return { mode: "task", taskId };
}

function sortDailyTasks(tasks: DailyTaskDocument[]): DailyTaskDocument[] {
  return [...tasks].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;
  });
}

/**
 * Registers `/api/daily-tasks` REST routes.
 *
 * @description Receives pre-wired handlers from central DI —
 * does not import runEntity, DailyTaskDispatch, or EntityRef.
 */
export function registerDailyTaskRoutes(
  app: Express,
  eventStore: MongoDBEventStore,
  bus: EntityCommandBus,
): void {
  const router = Router();

  router.get(
    "",
    asyncHandler(async (req, res) => {
      const startDate =
        typeof req.query.start_date === "string" ? req.query.start_date : undefined;
      const endDate =
        typeof req.query.end_date === "string" ? req.query.end_date : undefined;
      const taskId =
        typeof req.query.task_id === "string" ? req.query.task_id : undefined;

      const queryMode = validateListQueryParams(startDate, endDate, taskId);

      const mongoQuery: Record<string, unknown> = {};

      if (queryMode.mode === "calendar") {
        mongoQuery.date = { $gte: queryMode.startDate, $lte: queryMode.endDate };
        if (queryMode.taskId) {
          mongoQuery.task_id = queryMode.taskId;
        }
      } else {
        mongoQuery.task_id = queryMode.taskId;
      }

      let tasks = stripReadModelListMetadata(
        await eventStore.projections.inline.find<DailyTaskDocument>({
          streamType: DailyTask.streamType,
          projectionName: DAILY_TASK_PROJECTION_NAME,
        }),
      );
      tasks = filterReadModels(tasks, mongoQuery);

      tasks = sortDailyTasks(tasks);

      res.json(tasks.map(toResponse));
    }),
  );

  router.post(
    "",
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const now = new Date();
      const dailyTaskId = randomUUID();

      const taskId = body.task_id != null ? String(body.task_id) : null;
      let parent: TaskListDocument | null = null;
      let parentFields = EMPTY_PARENT_FIELDS;

      if (taskId) {
        parent = await ensureTaskExists(eventStore, taskId);
        parentFields = parentFieldsFromTask(parent);
      }

      const owner = resolveCreateOwner(body.owner, parent);

      const command: CreateDailyTask = {
        type: "CreateDailyTask",
        data: {
          id: dailyTaskId,
          date: String(body.date ?? ""),
          start_time: String(body.start_time ?? ""),
          end_time: String(body.end_time ?? ""),
          title: body.title != null ? String(body.title) : null,
          owner,
          task_id: taskId,
          ...parentFields,
        },
        metadata: { now },
      };

      await bus.send(command);

      const created = await findDailyTaskById(eventStore, dailyTaskId);
      res.status(201).json(created ? toResponse(created) : null);
    }),
  );

  router.patch(
    "/:dailyTaskId",
    asyncHandler(async (req, res) => {
      const dailyTaskId = req.params.dailyTaskId;
      const existing = await findDailyTaskById(eventStore, dailyTaskId);
      if (!existing) {
        throw new NotFoundError({
          id: dailyTaskId,
          type: "DailyTask",
          message: `Daily task with ID '${dailyTaskId}' not found.`,
        });
      }

      const rawPatch = buildPatch(req.body as Record<string, unknown>);
      const patch: Record<string, unknown> = { ...rawPatch };

      if ("owner" in patch && patch.owner != null) {
        const result = normalizeOwner(String(patch.owner));
        if (!result.ok) {
          toEmmettError(result);
        }
        patch.owner = result.value;
      }

      if ("task_id" in patch) {
        const newTaskId = patch.task_id != null ? String(patch.task_id) : null;
        if (newTaskId) {
          await ensureTaskExists(eventStore, newTaskId);
        }
        const parentFields = await resolveParentFieldsForTaskId(
          eventStore,
          newTaskId,
        );
        Object.assign(patch, parentFields);
      }

      const now = new Date();
      const command: UpdateDailyTask = {
        type: "UpdateDailyTask",
        data: {
          id: dailyTaskId,
          patch: patch as UpdateDailyTask["data"]["patch"],
        },
        metadata: { now },
      };

      await bus.send(command);

      const updated = await findDailyTaskById(eventStore, dailyTaskId);
      res.json(updated ? toResponse(updated) : null);
    }),
  );

  router.delete(
    "/:dailyTaskId",
    asyncHandler(async (req, res) => {
      const dailyTaskId = req.params.dailyTaskId;
      const existing = await findDailyTaskById(eventStore, dailyTaskId);
      if (!existing) {
        throw new NotFoundError({
          id: dailyTaskId,
          type: "DailyTask",
          message: `Daily task with ID '${dailyTaskId}' not found.`,
        });
      }

      const now = new Date();

      await bus.send({
        type: "DeleteDailyTask",
        data: { id: dailyTaskId },
        metadata: { now },
      });

      res.json({
        status: "success",
        message: `Daily task '${dailyTaskId}' deleted.`,
      });
    }),
  );

  // ── Bulk sync ────────────────────────────────────────────────

  type DailyBulkCreation = {
    date: string;
    start_time: string;
    end_time: string;
    title?: string | null;
    task_id?: string | null;
    owner?: string | null;
  };

  type DailyBulkUpdate = {
    id: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    title?: string | null;
    task_id?: string | null;
    owner?: string | null;
  };

  type DailyBulkSyncPayload = {
    creations?: DailyBulkCreation[];
    updates?: DailyBulkUpdate[];
    deletions?: string[];
  };

  router.post(
    "/bulk-sync",
    asyncHandler(async (req, res) => {
      const payload = req.body as DailyBulkSyncPayload;
      const creations = payload.creations ?? [];
      const updates = payload.updates ?? [];
      const deletions = payload.deletions ?? [];
      const now = new Date();

      // Phase 1: Build all commands (resolve parents, validate owners)
      const createCommands: CreateDailyTask[] = [];
      for (const item of creations) {
        const dailyTaskId = randomUUID();
        const taskId = item.task_id != null ? String(item.task_id) : null;
        let parent: TaskListDocument | null = null;
        let parentFields = EMPTY_PARENT_FIELDS;

        if (taskId) {
          parent = await ensureTaskExists(eventStore, taskId);
          parentFields = parentFieldsFromTask(parent);
        }

        const owner = resolveCreateOwner(item.owner, parent);

        createCommands.push({
          type: "CreateDailyTask",
          data: {
            id: dailyTaskId,
            date: String(item.date ?? ""),
            start_time: String(item.start_time ?? ""),
            end_time: String(item.end_time ?? ""),
            title: item.title != null ? String(item.title) : null,
            owner,
            task_id: taskId,
            ...parentFields,
          },
          metadata: { now },
        });
      }

      const updateCommands: UpdateDailyTask[] = [];
      for (const item of updates) {
        const rawPatch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(item)) {
          if (key !== "id" && !IMMUTABLE_DAILY_TASK_FIELDS.has(key) && value !== undefined) {
            rawPatch[key] = value;
          }
        }

        if ("owner" in rawPatch && rawPatch.owner != null) {
          const result = normalizeOwner(String(rawPatch.owner));
          if (!result.ok) {
            toEmmettError(result);
          }
          rawPatch.owner = result.value;
        }

        if ("task_id" in rawPatch) {
          const newTaskId = rawPatch.task_id != null ? String(rawPatch.task_id) : null;
          if (newTaskId) {
            await ensureTaskExists(eventStore, newTaskId);
          }
          const parentFields = await resolveParentFieldsForTaskId(eventStore, newTaskId);
          Object.assign(rawPatch, parentFields);
        }

        if (Object.keys(rawPatch).length === 0) {
          continue;
        }

        updateCommands.push({
          type: "UpdateDailyTask",
          data: {
            id: item.id,
            patch: rawPatch as UpdateDailyTask["data"]["patch"],
          },
          metadata: { now },
        });
      }

      const deleteCommands = deletions.map((id) => ({
        type: "DeleteDailyTask" as const,
        data: { id },
        metadata: { now },
      }));

      // Phase 2: Dispatch all commands in parallel
      await Promise.all([
        ...createCommands.map((cmd) => bus.send(cmd)),
        ...updateCommands.map((cmd) => bus.send(cmd)),
        ...deleteCommands.map((cmd) => bus.send(cmd)),
      ]);

      res.json({
        status: "success",
        daily_tasks_created: createCommands.length,
        daily_tasks_updated: updateCommands.length,
        daily_tasks_deleted: deleteCommands.length,
      });
    }),
  );

  app.use("/api/daily-tasks", router);
}
