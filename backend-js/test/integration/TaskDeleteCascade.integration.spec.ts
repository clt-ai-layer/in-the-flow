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

describe("TaskDeleteCascade", () => {
  let eventStore: MongoDBEventStore;
  let client: ApiTestClient;
  let taskId: string;
  let viewId: string;

  beforeAll(async () => {
    clearSeedPhases();
    eventStore = await getTestMongoEventStore();
    client = apiClient(eventStore);

    const seeded = await seedSprintBoardWithTask(client, "Cascade Task", eventStore);
    taskId = seeded.taskId;
    viewId = seeded.viewId;

    const daily = await client.post("/api/daily-tasks").send({
      date: "2026-05-25",
      start_time: "09:00",
      end_time: "09:30",
      task_id: taskId,
      title: "Linked block",
    });
    expect(daily.status).toBe(201);
  });

  it("delete removes daily tasks and view record", async () => {
    const deleted = await client.delete(`/api/tasks/${taskId}`);
    expect(deleted.status).toBe(200);

    const dailyTasks = await client.get(`/api/daily-tasks?task_id=${taskId}`);
    expect(dailyTasks.status).toBe(200);
    expect(dailyTasks.body).toEqual([]);

    const tasks = await client.get("/api/tasks?archived=false");
    expect(tasks.status).toBe(200);
    expect(tasks.body.some((task: { id: string }) => task.id === taskId)).toBe(false);

    const execute = await client.post(`/api/views/${viewId}/execute`).send({});
    expect(execute.status).toBe(200);

    const recordIds = collectViewExecuteRecords(execute.body).map((record) => String(record.id));
    expect(recordIds).not.toContain(taskId);
  });

  describe("multiple linked daily tasks", () => {
    let multiTaskId: string;

    beforeAll(async () => {
      const created = await client
        .post("/api/tasks")
        .send({ name: "Multi Cascade Task", status: "backlog", category: "dev" });
      expect(created.status).toBe(201);
      multiTaskId = created.body.id as string;

      for (const slot of [
        { start_time: "09:00", end_time: "09:30", title: "Block 1" },
        { start_time: "10:00", end_time: "10:30", title: "Block 2" },
        { start_time: "11:00", end_time: "11:30", title: "Block 3" },
      ]) {
        const daily = await client.post("/api/daily-tasks").send({
          date: "2026-05-26",
          ...slot,
          task_id: multiTaskId,
        });
        expect(daily.status).toBe(201);
      }
    });

    it("delete removes all linked daily tasks", async () => {
      const before = await client.get(`/api/daily-tasks?task_id=${multiTaskId}`);
      expect(before.status).toBe(200);
      expect(before.body).toHaveLength(3);

      const deleted = await client.delete(`/api/tasks/${multiTaskId}`);
      expect(deleted.status).toBe(200);

      const after = await client.get(`/api/daily-tasks?task_id=${multiTaskId}`);
      expect(after.status).toBe(200);
      expect(after.body).toEqual([]);
    });
  });
});
