import { describe, expect, it, beforeAll } from "vitest";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClientWithMongo } from "../helpers/apiTestClient.js";
import { clearSeedPhases } from "@/platform/seedService.js";

describe("Settings API", () => {
  let client: ApiTestClient;

  beforeAll(async () => {
    clearSeedPhases();
    ({ client } = await apiClientWithMongo());
  });

  it("GET returns flat key-value map", async () => {
    const upsertResponse = await client
      .post("/api/settings")
      .send({ test_setting_key: "initial-value" });

    expect(upsertResponse.status).toBe(200);

    const getResponse = await client.get("/api/settings");

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toMatchObject({
      test_setting_key: "initial-value",
    });
  });

  it("POST upserts setting and GET reflects update", async () => {
    const firstResponse = await client
      .post("/api/settings")
      .send({ upsert_test_key: "first" });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.settings_updated).toContain("upsert_test_key");

    const updateResponse = await client
      .post("/api/settings")
      .send({ upsert_test_key: "second" });

    expect(updateResponse.status).toBe(200);

    const getResponse = await client.get("/api/settings");

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.upsert_test_key).toBe("second");
  });
});
