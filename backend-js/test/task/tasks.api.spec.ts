import { describe, expect, it, beforeAll } from "vitest";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClient } from "../helpers/apiTestClient.js";
import { getTestMongoEventStore } from "../helpers/testEventStore.js";
import { clearSeedPhases } from "@/platform/seedService.js";

describe("Tasks API", () => {
  let eventStore: MongoDBEventStore;
  let client: ApiTestClient;

  beforeAll(async () => {
    clearSeedPhases();
    eventStore = await getTestMongoEventStore();
    client = apiClient(eventStore);
  });

  it("GET /api/tasks returns an array", async () => {
    const response = await client.get("/api/tasks");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("POST /api/tasks returns 201 with assigned id", async () => {
    const response = await client
      .post("/api/tasks")
      .send({ name: "New task", status: "backlog", category: "business" });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe("New task");
  });

  it("POST /api/tasks with invalid status returns 422", async () => {
    const response = await client
      .post("/api/tasks")
      .send({ name: "Bad task", status: "not_a_real_status" });

    expect(response.status).toBe(422);
    expect(response.body.detail).toContain("Invalid task status");
  });

  it("PUT partial merge preserves omitted fields", async () => {
    const createResponse = await client.post("/api/tasks").send({
      name: "Original",
      status: "backlog",
      description: "desc",
      category: "business",
    });

    expect(createResponse.status).toBe(201);
    const { id, created_at } = createResponse.body;

    const putResponse = await client.put(`/api/tasks/${id}`).send({ status: "Done" });

    expect(putResponse.status).toBe(200);

    const getResponse = await client.get(`/api/tasks/${id}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(id);
    expect(getResponse.body.created_at).toBe(created_at);
    expect(getResponse.body.name).toBe("Original");
    expect(getResponse.body.description).toBe("desc");
    expect(getResponse.body.status).toBe("done");
    expect(new Date(getResponse.body.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(created_at).getTime(),
    );
  });

  it("GET default list excludes archived tasks", async () => {
    const createResponse = await client.post("/api/tasks").send({
      name: "Archived task",
      status: "backlog",
      category: "business",
    });

    const taskId = createResponse.body.id;

    await client.put(`/api/tasks/${taskId}`).send({ archived: true });

    const listResponse = await client.get("/api/tasks");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.find((t: { id: string }) => t.id === taskId)).toBeUndefined();

    const includeArchivedResponse = await client.get("/api/tasks?include_archived=true");

    expect(includeArchivedResponse.status).toBe(200);
    expect(
      includeArchivedResponse.body.find((t: { id: string }) => t.id === taskId),
    ).toMatchObject({ archived: true });
  });
});
