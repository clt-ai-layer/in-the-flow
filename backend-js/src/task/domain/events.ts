import type { Event } from "@event-driven-io/emmett";

export type TaskFields = {
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
};

export type TaskCreated = Event<
  "TaskCreated",
  TaskFields & {
    id: string;
    created_at: string;
    updated_at: string;
  }
>;

export type TaskUpdated = Event<
  "TaskUpdated",
  {
    id: string;
    patch: Partial<TaskFields>;
    updated_at: string;
  }
>;

export type TaskDeleted = Event<
  "TaskDeleted",
  {
    id: string;
    deleted_at: string;
  }
>;

export type TaskEvent = TaskCreated | TaskUpdated | TaskDeleted;
