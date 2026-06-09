import { describe, expect, it, beforeAll } from "vitest";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClientWithMongo } from "../helpers/apiTestClient.js";
import { clearSeedPhases } from "@/platform/seedService.js";

describe("Projects API", () => {
  let client: ApiTestClient;

  beforeAll(async () => {
    clearSeedPhases();
    ({ client } = await apiClientWithMongo());
  });

  it("GET /api/projects returns an array", async () => {
    const response = await client.get("/api/projects");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("POST /api/projects returns 201", async () => {
    const response = await client
      .post("/api/projects")
      .send({ name: "My Project", color: "#FF0000" });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("My Project");
  });

  it("POST creates project with color visible on GET list", async () => {
    const createResponse = await client
      .post("/api/projects")
      .send({ name: "NewProj", color: "#ff0000" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.color).toBe("#ff0000");

    const listResponse = await client.get("/api/projects");

    expect(listResponse.status).toBe(200);
    const match = listResponse.body.find(
      (p: { name: string }) => p.name === "NewProj",
    );
    expect(match).toMatchObject({ name: "NewProj", color: "#ff0000" });
  });

  it("POST duplicate project name returns 400 with exact detail", async () => {
    await client.post("/api/projects").send({ name: "Unique Name" });

    const response = await client
      .post("/api/projects")
      .send({ name: "Unique Name" });

    expect(response.status).toBe(422);
    expect(response.body.detail).toBe("Project with name 'Unique Name' already exists.");
  });
});
