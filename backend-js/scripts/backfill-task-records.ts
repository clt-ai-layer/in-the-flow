/**
 * Rebuilds Tasks Workspace EAV records from task list projections.
 * Run after wiping database_records or when Kanban/views show 0 tasks.
 *
 * Usage: pnpm backfill:task-records
 */
import { stripReadModelListMetadata } from "@/platform/readModelUtils.js";
import { closeMongoResources, getEventStore, getMongoClient } from "@/platform/mongoConfig.js";
import { getDatabaseName } from "@/platform/mongoUri.js";
import { Task } from "@/task/domain/Task.js";
import { TASK_LIST_PROJECTION_NAME } from "@/task/projections/taskListProjection.js";
import type { TaskListDocument } from "@/task/projections/taskListProjection.js";
import { upsertTaskRecord } from "@/views/projections/taskRecordProjection.js";
import {
  DATABASE_RECORDS_COLLECTION,
  TASKS_DATABASE_ID,
} from "@/views/eavIds.js";

async function loadAllTasks(eventStore: Awaited<ReturnType<typeof getEventStore>>): Promise<TaskListDocument[]> {
  return stripReadModelListMetadata(
    await eventStore.projections.inline.find<TaskListDocument>({
      streamType: Task.streamType,
      projectionName: TASK_LIST_PROJECTION_NAME,
    }),
  );
}

async function purgeOrphanTaskRecords(
  client: Awaited<ReturnType<typeof getMongoClient>>,
  activeTaskIds: Set<string>,
): Promise<number> {
  const collection = client.db(getDatabaseName()).collection(DATABASE_RECORDS_COLLECTION);
  const existing = await collection
    .find({ database_id: TASKS_DATABASE_ID }, { projection: { id: 1 } })
    .toArray();

  const orphanIds = existing
    .map((doc) => String(doc.id))
    .filter((id) => !activeTaskIds.has(id));

  if (orphanIds.length === 0) {
    return 0;
  }

  const result = await collection.deleteMany({
    database_id: TASKS_DATABASE_ID,
    id: { $in: orphanIds },
  });

  return result.deletedCount ?? 0;
}

async function main(): Promise<void> {
  const eventStore = await getEventStore();
  const client = await getMongoClient();

  const tasks = await loadAllTasks(eventStore);
  const activeIds = new Set(tasks.map((t) => t.id));

  const purged = await purgeOrphanTaskRecords(client, activeIds);
  if (purged > 0) {
    console.log(`Removed ${purged} orphan EAV record(s) (stale after task stream wipe).`);
  }

  console.log(`Backfilling ${tasks.length} task(s) into EAV database_records…`);

  for (const task of tasks) {
    await upsertTaskRecord(client, task);
    console.log(`  ✓ ${task.task_grouping ?? "General"} — ${task.name}`);
  }

  console.log("Done.");
  await closeMongoResources();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
