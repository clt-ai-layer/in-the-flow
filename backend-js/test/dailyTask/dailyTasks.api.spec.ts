import { describe, expect, it, beforeAll } from "vitest";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClientWithMongo } from "../helpers/apiTestClient.js";
import { clearSeedPhases } from "@/platform/seedService.js";

describe("Daily Tasks API", () => {
  let client: ApiTestClient;

  beforeAll(async () => {
    clearSeedPhases();
    ({ client } = await apiClientWithMongo());
  });

  it("GET /api/daily-tasks without params returns 400 with calendar mode error", async () => {
    const response = await client.get("/api/daily-tasks");

    expect(response.status).toBe(422);
    expect(response.body.detail).toBe(
      "Provide either start_date and end_date together for calendar fetch, or task_id alone for task-scoped list.",
    );
  });

  it("GET /api/daily-tasks with only start_date returns 400", async () => {
    const response = await client.get("/api/daily-tasks?start_date=2026-05-25");

    expect(response.status).toBe(422);
    expect(response.body.detail).toBe(
      "start_date and end_date must be provided together.",
    );
  });

  it("POST /api/daily-tasks with invalid schedule returns 400", async () => {
    const response = await client
      .post("/api/daily-tasks")
      .send({
        date: "2026-05-25",
        start_time: "09:07",
        end_time: "09:30",
      });

    expect(response.status).toBe(422);
    expect(response.body.detail).toBe(
      "start_time '09:07' must align to 15-minute boundaries.",
    );
  });

  it("POST and GET calendar range returns sorted results", async () => {
    await client
      .post("/api/daily-tasks")
      .send({
        date: "2026-05-26",
        start_time: "10:00",
        end_time: "10:30",
        title: "Later",
      });

    await client
      .post("/api/daily-tasks")
      .send({
        date: "2026-05-25",
        start_time: "14:00",
        end_time: "14:30",
        title: "Earlier day",
      });

    await client
      .post("/api/daily-tasks")
      .send({
        date: "2026-05-25",
        start_time: "09:00",
        end_time: "09:30",
        title: "Earlier time",
      });

    const response = await client.get(
      "/api/daily-tasks?start_date=2026-05-25&end_date=2026-05-26",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0].date).toBe("2026-05-25");
    expect(response.body[0].start_time).toBe("09:00");
    expect(response.body[1].date).toBe("2026-05-25");
    expect(response.body[1].start_time).toBe("14:00");
    expect(response.body[2].date).toBe("2026-05-26");
    expect(response.body[2].start_time).toBe("10:00");
  });

  it("GET range includes parent denormalized fields from linked task", async () => {
    const taskResponse = await client.post("/api/tasks").send({
      name: "Parent Task Name",
      status: "in_progress",
      category: "business",
      task_grouping: "Sprint A",
    });

    const taskId = taskResponse.body.id;

    await client.post("/api/daily-tasks").send({
      date: "2026-05-26",
      start_time: "11:00",
      end_time: "11:30",
      task_id: taskId,
      title: "Linked block",
    });

    const response = await client.get(
      "/api/daily-tasks?start_date=2026-05-26&end_date=2026-05-26",
    );

    expect(response.status).toBe(200);
    const block = response.body.find((b: { task_id: string }) => b.task_id === taskId);
    expect(block).toMatchObject({
      task_id: taskId,
      parent_task_name: "Parent Task Name",
      parent_task_grouping: "Sprint A",
      parent_status: "in_progress",
      parent_archived: false,
    });
  });

  it("GET by task_id returns only blocks for that task", async () => {
    const taskAResponse = await client.post("/api/tasks").send({
      name: "Task A",
      status: "backlog",
      category: "business",
    });
    const taskBResponse = await client.post("/api/tasks").send({
      name: "Task B",
      status: "backlog",
      category: "business",
    });

    const taskAId = taskAResponse.body.id;
    const taskBId = taskBResponse.body.id;

    await client.post("/api/daily-tasks").send({
      date: "2026-05-27",
      start_time: "09:00",
      end_time: "09:30",
      task_id: taskAId,
    });

    await client.post("/api/daily-tasks").send({
      date: "2026-05-27",
      start_time: "10:00",
      end_time: "10:30",
      task_id: taskBId,
    });

    const response = await client.get(`/api/daily-tasks?task_id=${taskAId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].task_id).toBe(taskAId);
  });
});
