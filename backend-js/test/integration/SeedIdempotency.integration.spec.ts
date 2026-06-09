import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import {
  createMongoIntegrationContext,
  teardownMongoIntegrationContext,
  truncateIntegrationDatabase,
  type MongoIntegrationContext,
} from "../helpers/mongoTestContext.js";
import { stopTestMongoEventStore } from "../helpers/testEventStore.js";
import { closeMongoResources, getEventStore } from "@/platform/mongoConfig.js";
import { runSeed } from "@/platform/seedService.js";
import { Project } from "@/project/domain/Project.js";
import { PROJECT_LIST_PROJECTION_NAME } from "@/project/projections/projectListProjection.js";
import { Task } from "@/task/domain/Task.js";
import { TASK_LIST_PROJECTION_NAME } from "@/task/projections/taskListProjection.js";

import "@/project/seed/registerProjectSeed.js";
import "@/settings/seed/registerSettingsSeed.js";
import "@/task/seed/registerTaskSeed.js";
import "@/views/seed/registerEavSchemaSeed.js";
import "@/views/seed/registerViewsSeed.js";

describe("SeedIdempotency", () => {
  let mongoCtx: MongoIntegrationContext | null = null;
  let eventStore: MongoDBEventStore;

  beforeAll(async () => {
    await stopTestMongoEventStore();
    await closeMongoResources();

    mongoCtx = await createMongoIntegrationContext();
    if (!mongoCtx) {
      return;
    }

    await truncateIntegrationDatabase(mongoCtx.uri);
    eventStore = await getEventStore();
  }, 120_000);

  afterAll(async () => {
    await teardownMongoIntegrationContext();
  });

  async function countTasks(store: MongoDBEventStore): Promise<number> {
    return store.projections.inline.count({
      streamType: Task.streamType,
      projectionName: TASK_LIST_PROJECTION_NAME,
    });
  }

  async function countProjects(store: MongoDBEventStore): Promise<number> {
    return store.projections.inline.count({
      streamType: Project.streamType,
      projectionName: PROJECT_LIST_PROJECTION_NAME,
    });
  }

  it.skipIf(() => !mongoCtx)("second runSeed does not duplicate entities", async () => {
    await runSeed(eventStore);

    const tasksAfterFirst = await countTasks(eventStore);
    const projectsAfterFirst = await countProjects(eventStore);

    expect(tasksAfterFirst).toBeGreaterThan(0);
    expect(projectsAfterFirst).toBeGreaterThan(0);

    await runSeed(eventStore);

    const tasksAfterSecond = await countTasks(eventStore);
    const projectsAfterSecond = await countProjects(eventStore);

    expect(tasksAfterSecond).toBe(tasksAfterFirst);
    expect(projectsAfterSecond).toBe(projectsAfterFirst);
  });
});
