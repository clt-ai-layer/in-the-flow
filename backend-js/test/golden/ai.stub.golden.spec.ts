import { describe, expect, it, beforeAll } from "vitest";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClientWithMongo } from "../helpers/apiTestClient.js";
import {
  assertMatchesGoldenShape,
  loadGoldenFixture,
  normalizeForGolden,
} from "../helpers/normalizeGolden.js";

type AiStubCase = {
  route: string;
  body: Record<string, unknown>;
  fixture: string;
};

const AI_STUB_CASES: AiStubCase[] = [
  {
    route: "/api/ai/classify",
    body: { name: "Implement API endpoint", description: "" },
    fixture: "python-golden/ai/classify.stub.json",
  },
  {
    route: "/api/ai/weekly-plan",
    body: {},
    fixture: "python-golden/ai/weekly-plan.stub.json",
  },
  {
    route: "/api/ai/flow-analyzer",
    body: {},
    fixture: "python-golden/ai/flow-analyzer.stub-empty.json",
  },
  {
    route: "/api/ai/enhance-ticket",
    body: {
      name: "Auth API",
      description_stub: "Implement user authentication flow.",
    },
    fixture: "python-golden/ai/enhance-ticket.stub.json",
  },
];

describe("golden: AI stub endpoints", () => {
  let client: ApiTestClient;

  beforeAll(async () => {
    ({ client } = await apiClientWithMongo());
  });

  it.each(AI_STUB_CASES)(
    "stub $route matches python-golden shape",
    async ({ route, body, fixture }) => {
      const golden = loadGoldenFixture(fixture) as Record<string, unknown>;

      const response = await client.post(route).send(body);

      expect(response.status).toBe(200);

      const normalized = normalizeForGolden(response.body) as Record<string, unknown>;
      const normalizedGolden = normalizeForGolden(golden) as Record<string, unknown>;

      assertMatchesGoldenShape(normalized, {
        requiredTopLevelKeys: Object.keys(normalizedGolden),
        exact: normalizedGolden,
      });
    },
  );
});
