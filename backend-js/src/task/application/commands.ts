import type { Command } from "@event-driven-io/emmett";
import type { TaskFields } from "../domain/events.js";

export type CreateTask = Command<
  "CreateTask",
  Partial<TaskFields> & { name: string; id?: string }
>;

export type UpdateTask = Command<
  "UpdateTask",
  {
    id: string;
    patch: Partial<TaskFields>;
  }
>;

export type DeleteTask = Command<
  "DeleteTask",
  {
    id: string;
  }
>;

export type TaskCommand = CreateTask | UpdateTask | DeleteTask;
