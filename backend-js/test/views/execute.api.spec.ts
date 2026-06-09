import { randomUUID } from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClient } from "../helpers/apiTestClient.js";
import { getTestMongoEventStore } from "../helpers/testEventStore.js";
import { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import type { CreateDatabaseView } from "@/views/application/commands.js";
import { CreateDatabaseViewHandler } from "@/views/application/DatabaseViewCommandHandlers.js";
import { TASKS_DATABASE_ID, VIEW_IDS } from "@/views/eavIds.js";
import { seedDatabaseView } from "../helpers/seedViewHelper.js";

describe("POST /api/views/:id/execute", () => {
  let eventStore: MongoDBEventStore;
  let client: ApiTestClient;

  beforeAll(async () => {
    eventStore = await getTestMongoEventStore();
    client = apiClient(eventStore);
  });

  it("returns required top-level keys for a seeded view config", async () => {
    await seedDatabaseView(eventStore, {
      id: VIEW_IDS.backlogTable,
      database_id: TASKS_DATABASE_ID,
      name: "Backlog Table",
      layout_type: "table",
      filters: {
        operator: "and",
        rules: [{ property: "Archived", condition: "equals", value: "false" }],
      },
      sorts: [],
      grouping: {},
      visible_properties: ["Name", "Status"],
    });

    const response = await client.post(`/api/views/${VIEW_IDS.backlogTable}/execute`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("grouped");
    expect(response.body).toHaveProperty("records");
    expect(response.body).toHaveProperty("visible_properties");
    expect(response.body.view_name).toBe("Backlog Table");
    expect(response.body.layout_type).toBe("table");
  });

  it("returns 404 when view does not exist", async () => {
    const response = await client.post("/api/views/missing-view-id/execute");

    expect(response.status).toBe(404);
    expect(response.body.detail).toContain("not found");
  });
});

describe("GET /api/views", () => {
  let eventStore: MongoDBEventStore;
  let client: ApiTestClient;

  beforeAll(async () => {
    eventStore = await getTestMongoEventStore();
    client = apiClient(eventStore);
  });

  it("lists views from projection", async () => {
    const viewId = randomUUID();

    await seedDatabaseView(eventStore, {
      id: viewId,
      database_id: TASKS_DATABASE_ID,
      name: "Sprint Board",
      layout_type: "board",
      grouping: { group_by: "Status" },
    });

    const response = await client.get("/api/views");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.some((v: { id: string }) => v.id === viewId)).toBe(true);
  });
});
