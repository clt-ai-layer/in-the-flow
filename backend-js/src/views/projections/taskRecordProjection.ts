import type { MongoClient } from "mongodb";
import type { TaskListDocument } from "@/task/projections/taskListProjection.js";
import {
  DATABASE_RECORDS_COLLECTION,
  TASKS_DATABASE_ID,
} from "@/views/eavIds.js";
import { getDatabaseName } from "@/platform/mongoUri.js";

export type TaskRecordPropertyValues = {
  Name: string;
  Description: string;
  Status: string;
  Category: string;
  Source: string;
  Owner: string;
  TaskGrouping: string;
  "Estimated Duration": number;
  "Current Duration": number;
  Project: string[];
  Archived: boolean;
};

/**
 * Maps a task list read model to EAV property_values matching Python `sync_task_to_record`.
 */
export function mapTaskToPropertyValues(task: TaskListDocument): TaskRecordPropertyValues {
  return {
    Name: task.name,
    Description: task.description ?? "",
    Status: task.status,
    Category: task.category,
    Source: task.source,
    Owner: task.owner ?? "Alice",
    TaskGrouping: task.task_grouping ?? "General",
    "Estimated Duration": task.estimated_duration ?? 0,
    "Current Duration": task.current_duration ?? 0,
    Project: task.project_id ? [task.project_id] : [],
    Archived: task.archived,
  };
}

function getRecordsCollection(client: MongoClient) {
  return client.db(getDatabaseName()).collection(DATABASE_RECORDS_COLLECTION);
}

/**
 * Upserts a Tasks Workspace EAV record for the given task.
 */
export async function upsertTaskRecord(
  client: MongoClient,
  task: TaskListDocument,
): Promise<void> {
  const propertyValues = mapTaskToPropertyValues(task);

  await getRecordsCollection(client).updateOne(
    { id: task.id },
    {
      $set: {
        id: task.id,
        database_id: TASKS_DATABASE_ID,
        property_values: JSON.stringify(propertyValues),
      },
    },
    { upsert: true },
  );
}

/**
 * Removes the EAV record linked to a deleted task.
 */
export async function deleteTaskRecord(
  client: MongoClient,
  taskId: string,
): Promise<void> {
  await getRecordsCollection(client).deleteOne({ id: taskId });
}
