import type { MongoDBReadEvent } from "@event-driven-io/emmett-mongodb";
import { defineEntityReadModel } from "@/es-kit/projections/defineEntityReadModel.js";
import type { DailyTaskEvent } from "../domain/events.js";

export type DailyTaskDocument = {
  id: string;
  task_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  owner: string;
  parent_task_name: string | null;
  parent_task_grouping: string | null;
  parent_project_id: string | null;
  parent_status: string | null;
  parent_archived: boolean | null;
  created_at: string;
  updated_at: string;
};

export const DAILY_TASK_PROJECTION_NAME = "daily_task";
export const DAILY_TASK_READ_MODEL_NAME = DAILY_TASK_PROJECTION_NAME;

/**
 * Folds DailyTask domain events into the inline read model document.
 */
export function projectReadModel(
  document: DailyTaskDocument,
  event: MongoDBReadEvent<DailyTaskEvent>,
): DailyTaskDocument | null {
  switch (event.type) {
    case "DailyTaskCreated":
      return {
        id: event.data.id,
        task_id: event.data.task_id,
        date: event.data.date,
        start_time: event.data.start_time,
        end_time: event.data.end_time,
        title: event.data.title,
        owner: event.data.owner,
        parent_task_name: event.data.parent_task_name,
        parent_task_grouping: event.data.parent_task_grouping,
        parent_project_id: event.data.parent_project_id,
        parent_status: event.data.parent_status,
        parent_archived: event.data.parent_archived,
        created_at: event.data.created_at,
        updated_at: event.data.updated_at,
      };
    case "DailyTaskUpdated":
      return {
        ...document,
        ...event.data.patch,
        updated_at: event.data.updated_at,
      };
    case "DailyTaskDeleted":
      return null;
    default:
      return document;
  }
}

export const dailyTaskProjection = defineEntityReadModel<
  DailyTaskDocument,
  DailyTaskEvent
>({
  name: DAILY_TASK_PROJECTION_NAME,
  schemaVersion: 1,
  canHandle: ["DailyTaskCreated", "DailyTaskUpdated", "DailyTaskDeleted"],
  initialReadModel: (): DailyTaskDocument => ({
    id: "",
    task_id: null,
    date: "",
    start_time: "",
    end_time: "",
    title: null,
    owner: "Alice",
    parent_task_name: null,
    parent_task_grouping: null,
    parent_project_id: null,
    parent_status: null,
    parent_archived: null,
    created_at: "",
    updated_at: "",
  }),
  projectReadModel,
});

export const DAILY_TASK_INDEX_SPEC = {
  date: 1,
  start_time: 1,
  task_id: 1,
} as const;
