import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { ApiTestClient } from "./apiTestClient.js";
import { getMongoClient } from "@/platform/mongoConfig.js";
import { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { DatabaseView } from "@/views/domain/DatabaseView.js";
import type { CreateDatabaseView } from "@/views/application/commands.js";
import { CreateDatabaseViewHandler } from "@/views/application/DatabaseViewCommandHandlers.js";
import { VIEW_IDS } from "@/views/eavIds.js";
import { seedDatabaseSchemasIfEmpty } from "@/views/storage/databaseSchemaStore.js";
import { loadGoldenFixture } from "./normalizeGolden.js";

export type ViewExecuteRecord = Record<string, unknown>;

export type ViewExecuteBody = {
  grouped?: boolean;
  groups?: Record<string, unknown>;
  records?: ViewExecuteRecord[];
};

/**
 * Flattens grouped or flat view execute payloads into a single record list.
 */
export function collectViewExecuteRecords(body: ViewExecuteBody): ViewExecuteRecord[] {
  if (body.grouped && body.groups) {
    const flat: ViewExecuteRecord[] = [];
    for (const groupValue of Object.values(body.groups)) {
      if (Array.isArray(groupValue)) {
        flat.push(...(groupValue as ViewExecuteRecord[]));
        continue;
      }
      if (groupValue && typeof groupValue === "object") {
        for (const subGroupValue of Object.values(groupValue as Record<string, unknown>)) {
          if (Array.isArray(subGroupValue)) {
            flat.push(...(subGroupValue as ViewExecuteRecord[]));
          }
        }
      }
    }
    return flat;
  }

  return body.records ?? [];
}

/**
 * Seeds Projects and Tasks Workspace EAV schemas when the databases collection is empty.
 */
export async function seedProjectsWorkspaceSchema(): Promise<void> {
  const client = await getMongoClient();
  await seedDatabaseSchemasIfEmpty(client);
}

/**
 * Seeds a database view via the EntityCommandBus.
 */
export async function seedDatabaseView(
  eventStore: MongoDBEventStore,
  data: CreateDatabaseView["data"],
): Promise<void> {
  const now = new Date();
  const command: CreateDatabaseView = {
    type: "CreateDatabaseView",
    data,
    metadata: { now },
  };

  const bus = new EntityCommandBus(eventStore);
  bus.register(new CreateDatabaseViewHandler());
  await bus.send(command);
}

/**
 * Seeds the sprint board view from the python-golden shape fixture.
 *
 * @returns Sprint board view id from {@link VIEW_IDS}.
 */
export async function seedSprintBoardView(eventStore: MongoDBEventStore): Promise<string> {
  const golden = loadGoldenFixture("python-golden/views/sprint-board.shape.json") as {
    seedView: CreateDatabaseView["data"];
  };
  await seedDatabaseView(eventStore, golden.seedView);
  return VIEW_IDS.sprintBoard;
}

/**
 * Seeds sprint board view and creates a task visible on the board.
 * Used by TaskSideEffectsFreshness integration specs (acceptance #7).
 */
export async function seedSprintBoardWithTask(
  client: ApiTestClient,
  taskName: string,
  eventStore: MongoDBEventStore,
): Promise<{ taskId: string; viewId: string }> {
  const viewId = await seedSprintBoardView(eventStore);

  const response = await client
    .post("/api/tasks")
    .send({ name: taskName, status: "backlog", category: "dev" });

  if (response.status !== 201) {
    throw new Error(
      `Failed to create task: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return { taskId: response.body.id as string, viewId };
}
