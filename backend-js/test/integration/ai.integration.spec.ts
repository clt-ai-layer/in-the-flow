import { describe, expect, it, beforeAll } from "vitest";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClientWithMongo } from "../helpers/apiTestClient.js";
import { shouldRunAiIntegration } from "../helpers/aiTestGate.js";

const gated = shouldRunAiIntegration();

describe.skipIf(!gated)("InTheFlow AI integration (live Kimi)", () => {
  let client: ApiTestClient;

  beforeAll(async () => {
    ({ client } = await apiClientWithMongo());
  });

  it("classify returns 200 with category and estimated_duration", async () => {
    const response = await client
      .post("/api/ai/classify")
      .send({
        name: "Implement API middleware",
        description: "zod validation and express routes",
      });

    expect(response.status).toBe(200);
    expect(["business", "dev"]).toContain(response.body.category);
    expect(typeof response.body.estimated_duration).toBe("number");
    expect(response.body.rationale).toBeDefined();
  });
});
