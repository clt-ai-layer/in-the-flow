import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  createMongoIntegrationContext,
  teardownMongoIntegrationContext,
  type MongoIntegrationContext,
} from "../helpers/mongoTestContext.js";
import { getEventStore } from "@/platform/mongoConfig.js";
import { createApp, HEALTH_RESPONSE } from "@/platform/app.js";

describe("Mongo integration", () => {
  let mongoCtx: MongoIntegrationContext | null = null;

  beforeAll(async () => {
    mongoCtx = await createMongoIntegrationContext();
  }, 120_000);

  afterAll(async () => {
    await teardownMongoIntegrationContext();
  });

  it.skipIf(() => !mongoCtx)("connects event store against intheflow_test", async () => {
    const store = await getEventStore();
    expect(store).toBeDefined();
  });

  it.skipIf(() => !mongoCtx)("GET / health returns 2.0.0 over real Mongo bootstrap", async () => {
    const store = await getEventStore();
    const app = createApp(store);
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(HEALTH_RESPONSE);
  });
});
