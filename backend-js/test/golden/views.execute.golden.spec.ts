import { describe, expect, it, beforeAll } from "vitest";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { apiClient } from "../helpers/apiTestClient.js";
import { getTestMongoEventStore } from "../helpers/testEventStore.js";
import {
  assertMatchesGoldenShape,
  loadGoldenFixture,
  normalizeForGolden,
} from "../helpers/normalizeGolden.js";
import type { CreateDatabaseView } from "@/views/application/commands.js";
import { seedDatabaseView } from "../helpers/seedViewHelper.js";
import { VIEW_IDS } from "@/views/eavIds.js";

const VIEW_GOLDEN_FILES: Record<string, string> = {
  [VIEW_IDS.sprintBoard]: "python-golden/views/sprint-board.shape.json",
  [VIEW_IDS.backlogTable]: "python-golden/views/backlog-table.shape.json",
  [VIEW_IDS.aiFlowHubList]: "python-golden/views/ai-flow-hub.shape.json",
  [VIEW_IDS.archivedTasksHistory]: "python-golden/views/archived-history.shape.json",
};

describe("golden: POST /api/views/:id/execute", () => {
  let eventStore: MongoDBEventStore;
  let client: ApiTestClient;

  beforeAll(async () => {
    eventStore = await getTestMongoEventStore();
    client = apiClient(eventStore);
  });

  for (const [viewId, fixturePath] of Object.entries(VIEW_GOLDEN_FILES)) {
    it(`matches shape golden for ${viewId}`, async () => {
      const golden = loadGoldenFixture(fixturePath) as {
        requiredTopLevelKeys: string[];
        exact?: Record<string, unknown>;
        seedView: CreateDatabaseView["data"];
      };

      await seedDatabaseView(eventStore, golden.seedView);

      const response = await client.post(`/api/views/${viewId}/execute`);

      expect(response.status).toBe(200);

      const normalized = normalizeForGolden(response.body) as Record<string, unknown>;
      assertMatchesGoldenShape(normalized, golden);

      if (golden.exact) {
        for (const [key, value] of Object.entries(golden.exact)) {
          expect(normalized[key]).toEqual(value);
        }
      }
    });
  }
});
