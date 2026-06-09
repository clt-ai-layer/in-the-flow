import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { Event } from "@event-driven-io/emmett";
import type { IEntityIntegrationHandler } from "@/es-kit/middleware/EntityIntegrationMiddleware.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { Task } from "@/task/domain/Task.js";
import {
  TASK_LIST_PROJECTION_NAME,
  type TaskListDocument,
} from "@/task/projections/taskListProjection.js";
import { tryGetMongoClient } from "@/platform/mongoConfig.js";
import {
  filterReadModels,
  stripReadModelListMetadata,
  stripReadModelMetadata,
} from "@/platform/readModelUtils.js";
import {
  deleteTaskRecord,
  upsertTaskRecord,
} from "@/views/projections/taskRecordProjection.js";
import {
  DAILY_TASK_PROJECTION_NAME,
  type DailyTaskDocument,
} from "@/dailyTask/projections/dailyTaskProjection.js";
import { DailyTask } from "@/dailyTask/domain/DailyTask.js";
import { parentFieldsFromTask } from "@/dailyTask/domain/events.js";
import type { TaskCreated, TaskUpdated, TaskDeleted } from "@/task/domain/events.js";
import { EntityRef } from "@/es-kit/domain/EntityRef.js";

/**
 * Cross-aggregate integration handler for Task events.
 *
 * @processHandler
 * @workflow
 *   1. TaskCreated → upsert EAV record + sync daily task parent fields
 *   2. TaskUpdated → upsert EAV record + sync daily task parent fields
 *   3. TaskDeleted → cascade delete linked daily tasks + remove EAV record
 *
 * @participatingAggregates Task (source), DailyTask (target for parent sync + cascade delete)
 * @errorHandling Integration failures do NOT roll back primary task events (ADR-002).
 */
export class TaskIntegrationHandler implements IEntityIntegrationHandler {
  readonly sourceEventTypes = ["TaskCreated", "TaskUpdated", "TaskDeleted"];

  constructor(private readonly eventStore: MongoDBEventStore) {}

  async handle(
    events: ReadonlyArray<Event>,
    bus: EntityCommandBus,
  ): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case "TaskCreated":
          await this.onTaskCreated(event as TaskCreated, bus);
          break;
        case "TaskUpdated":
          await this.onTaskUpdated(event as TaskUpdated, bus);
          break;
        case "TaskDeleted":
          await this.onTaskDeleted(event as TaskDeleted, bus);
          break;
      }
    }
  }

  // ── Event handlers ───────────────────────────────────────────

  private async onTaskCreated(
    event: TaskCreated,
    bus: EntityCommandBus,
  ): Promise<void> {
    const task = event.data as TaskListDocument;
    const client = await tryGetMongoClient();
    if (client) {
      await upsertTaskRecord(client, task);
    }
    await this.syncDailyTaskParentFields(task, bus);
  }

  private async onTaskUpdated(
    event: TaskUpdated,
    bus: EntityCommandBus,
  ): Promise<void> {
    const task = await this.loadTaskById(event.data.id);
    if (!task) {
      return;
    }

    const client = await tryGetMongoClient();
    if (client) {
      await upsertTaskRecord(client, task);
    }
    await this.syncDailyTaskParentFields(task, bus);
  }

  private async onTaskDeleted(
    event: TaskDeleted,
    bus: EntityCommandBus,
  ): Promise<void> {
    await this.cascadeDeleteDailyTasks(event.data.id, bus);

    const client = await tryGetMongoClient();
    if (client) {
      await deleteTaskRecord(client, event.data.id);
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  private async loadTaskById(
    taskId: string,
  ): Promise<TaskListDocument | null> {
    const streamName = EntityRef.newId(Task.streamType, taskId).toStreamName();
    const doc =
      await this.eventStore.projections.inline.findOne<TaskListDocument>({
        streamName,
        projectionName: TASK_LIST_PROJECTION_NAME,
      });
    return doc ? stripReadModelMetadata(doc) : null;
  }

  private async findDailyTasksByTaskId(
    taskId: string,
  ): Promise<DailyTaskDocument[]> {
    const docs = stripReadModelListMetadata(
      await this.eventStore.projections.inline.find<DailyTaskDocument>({
        streamType: DailyTask.streamType,
        projectionName: DAILY_TASK_PROJECTION_NAME,
      }),
    );
    return filterReadModels(docs, { task_id: taskId });
  }

  private async syncDailyTaskParentFields(
    task: TaskListDocument,
    bus: EntityCommandBus,
  ): Promise<void> {
    const linked = await this.findDailyTasksByTaskId(task.id);
    if (linked.length === 0) {
      return;
    }

    const now = new Date();
    const parentPatch = parentFieldsFromTask(task);

    for (const dailyTask of linked) {
      await bus.send({
        type: "UpdateDailyTask",
        data: {
          id: dailyTask.id,
          patch: parentPatch,
        },
        metadata: { now },
      });
    }
  }

  private async cascadeDeleteDailyTasks(
    taskId: string,
    bus: EntityCommandBus,
  ): Promise<void> {
    const linked = await this.findDailyTasksByTaskId(taskId);
    if (linked.length === 0) {
      return;
    }

    const now = new Date();

    for (const dailyTask of linked) {
      await bus.send({
        type: "DeleteDailyTask",
        data: { id: dailyTask.id },
        metadata: { now },
      });
    }
  }
}
