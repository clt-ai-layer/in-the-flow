import { mongoDBInlineProjection, type MongoDBReadEvent } from "@event-driven-io/emmett-mongodb";
import type { TaskEvent } from "../domain/events.js";

export type TaskListDocument = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  category: string;
  source: string;
  owner: string | null;
  task_grouping: string | null;
  archived: boolean;
  estimated_duration: number | null;
  current_duration: number | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

export const TASK_LIST_PROJECTION_NAME = "task_list";

export const taskListProjection = mongoDBInlineProjection<TaskListDocument, TaskEvent>({
  name: TASK_LIST_PROJECTION_NAME,
  schemaVersion: 1,
  canHandle: ["TaskCreated", "TaskUpdated", "TaskDeleted"],
  initialState: (): TaskListDocument => ({
    id: "",
    name: "",
    description: null,
    status: "backlog",
    category: "business",
    source: "user_created",
    owner: null,
    task_grouping: null,
    archived: false,
    estimated_duration: null,
    current_duration: 0,
    project_id: null,
    created_at: "",
    updated_at: "",
  }),
  evolve: (
    document: TaskListDocument,
    event: MongoDBReadEvent<TaskEvent>,
  ): TaskListDocument | null => {
    switch (event.type) {
      case "TaskCreated":
        return {
          id: event.data.id,
          name: event.data.name,
          description: event.data.description,
          status: event.data.status,
          category: event.data.category,
          source: event.data.source,
          owner: event.data.owner,
          task_grouping: event.data.task_grouping,
          archived: event.data.archived,
          estimated_duration: event.data.estimated_duration,
          current_duration: event.data.current_duration,
          project_id: event.data.project_id,
          created_at: event.data.created_at,
          updated_at: event.data.updated_at,
        };
      case "TaskUpdated":
        return {
          ...document,
          ...event.data.patch,
          updated_at: event.data.updated_at,
        };
      case "TaskDeleted":
        return null;
      default:
        return document;
    }
  },
});

export const TASK_LIST_INDEX_SPEC = {
  archived: 1,
  project_id: 1,
  status: 1,
  category: 1,
} as const;
