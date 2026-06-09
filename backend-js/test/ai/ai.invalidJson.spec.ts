import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { clearAiLogs, getAiLogsForAction } from "../helpers/aiTestGate.js";
import { apiClientWithMongo } from "../helpers/apiTestClient.js";
import {
  restoreKimiMocks,
  spyKimiClassifyInvalidJson,
  spyKimiMethodInvalidJson,
} from "../helpers/mockKimiService.js";

describe("AI invalid JSON error path (acceptance #18)", () => {
  let client: ApiTestClient;

  beforeAll(async () => {
    ({ client } = await apiClientWithMongo());
  });

  beforeEach(async () => {
    await clearAiLogs();
  });

  afterEach(() => {
    restoreKimiMocks();
  });

  it("classify returns 500 and logs error on invalid JSON", async () => {
    spyKimiClassifyInvalidJson();

    const response = await client
      .post("/api/ai/classify")
      .send({ name: "Test task", description: "Some description" });

    expect(response.status).toBe(500);
    expect(response.body.detail).toBe("Invalid JSON from AI model");

    const logs = await getAiLogsForAction("classify_task");
    expect(logs.some((log) => log.error)).toBe(true);
    expect(logs.some((log) => log.error === "Invalid JSON from AI model")).toBe(true);
  });

  it("enhance-ticket returns 500 and logs error on invalid JSON", async () => {
    spyKimiMethodInvalidJson("enhanceTask");

    const response = await client
      .post("/api/ai/enhance-ticket")
      .send({ name: "Auth API", description_stub: "Implement auth flow" });

    expect(response.status).toBe(500);
    expect(response.body.detail).toBe("Invalid JSON from AI model");

    const logs = await getAiLogsForAction("ticket_description_enhancement");
    expect(logs.some((log) => log.error)).toBe(true);
    expect(logs.some((log) => log.error === "Invalid JSON from AI model")).toBe(true);
  });
});
