import { describe, expect, it, beforeAll } from "vitest";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClient } from "../helpers/apiTestClient.js";
import { getTestMongoEventStore } from "../helpers/testEventStore.js";
import { seedProjectsWorkspaceSchema } from "../helpers/seedViewHelper.js";
import { clearSeedPhases } from "@/platform/seedService.js";
import { getMongoClient } from "@/platform/mongoConfig.js";
import { getDatabaseName } from "@/platform/mongoUri.js";
import {
  DATABASE_RECORDS_COLLECTION,
  PROJECTS_DATABASE_ID,
} from "@/views/eavIds.js";

describe("ProjectEavSync", () => {
  let eventStore: MongoDBEventStore;
  let client: ApiTestClient;

  beforeAll(async () => {
    clearSeedPhases();
    eventStore = await getTestMongoEventStore();
    client = apiClient(eventStore);
    await seedProjectsWorkspaceSchema();
  });

  it("project create upserts projects workspace record", async () => {
    const created = await client
      .post("/api/projects")
      .send({ name: "EAV Sync Project", color: "#112233" });

    expect(created.status).toBe(201);
    const projectId = created.body.id as string;

    const mongoClient = await getMongoClient();
    const record = await mongoClient
      .db(getDatabaseName())
      .collection(DATABASE_RECORDS_COLLECTION)
      .findOne({ id: projectId });

    expect(record).not.toBeNull();
    expect(record?.database_id).toBe(PROJECTS_DATABASE_ID);
    expect(record?.id).toBe(projectId);
  });
});
