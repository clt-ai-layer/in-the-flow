import { describe, expect, it, beforeAll } from "vitest";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClient } from "../helpers/apiTestClient.js";
import { getTestMongoEventStore } from "../helpers/testEventStore.js";
import {
  collectViewExecuteRecords,
  seedSprintBoardWithTask,
} from "../helpers/seedViewHelper.js";
import { clearSeedPhases } from "@/platform/seedService.js";

describe("TaskSideEffectsFreshness", () => {
  let eventStore: MongoDBEventStore;
  let client: ApiTestClient;
  let taskId: string;
  let viewId: string;

  beforeAll(async () => {
    clearSeedPhases();
    eventStore = await getTestMongoEventStore();
    client = apiClient(eventStore);

    const seeded = await seedSprintBoardWithTask(client, "Original Task", eventStore);
    taskId = seeded.taskId;
    viewId = seeded.viewId;
  });

  it("task rename visible in Kanban immediately after PUT", async () => {
    const update = await client.put(`/api/tasks/${taskId}`).send({ name: "Renamed Task" });
    expect(update.status).toBe(200);

    const execute = await client.post(`/api/views/${viewId}/execute`).send({});
    expect(execute.status).toBe(200);

    const records = collectViewExecuteRecords(execute.body);
    const names = records.map((record) => String(record.Name ?? ""));

    expect(names).toContain("Renamed Task");
  });
});
