import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiTestClient } from "../helpers/apiTestClient.js";
import { clearSeedPhases } from "@/platform/seedService.js";
import {
  PLANNING_FOLDER_SETTING_KEY,
  PLANNING_SYNC_ENABLED_KEY,
  SYNC_HASH_SETTING_KEY,
} from "@/settings/syncPlanning/constants.js";
import { apiClientWithMongo } from "../helpers/apiTestClient.js";
import {
  computeFileHash,
  CURRENT_PLANNING_FILE_NAME,
  FIXTURE_BASELINE_MARKDOWN,
  FIXTURE_CHANGED_MARKDOWN,
  FIXTURE_DONE_MARKDOWN,
  writePlanningFixture,
} from "../helpers/syncPlanningFixtures.js";

describe("Sync Planning API", () => {
  let client: ApiTestClient;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    clearSeedPhases();
    ({ client } = await apiClientWithMongo());
  });

  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createPlanningDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "sync-planning-"));
    tempDirs.push(dir);
    return dir;
  }

  async function configurePlanningFolder(content: string): Promise<string> {
    const dir = createPlanningDir();
    writePlanningFixture(dir, content);
    await client.post("/api/settings").send({
      [PLANNING_FOLDER_SETTING_KEY]: dir,
      [PLANNING_SYNC_ENABLED_KEY]: "true",
    });
    return dir;
  }

  async function seedMatchingHash(content: string): Promise<void> {
    await client.post("/api/settings").send({
      [SYNC_HASH_SETTING_KEY]: JSON.stringify({
        file_name: CURRENT_PLANNING_FILE_NAME,
        hash: computeFileHash(content),
      }),
    });
  }

  async function getPlanningTasks(): Promise<
    Array<{ name: string; archived?: boolean; project_id?: string | null; source?: string }>
  > {
    const response = await client.get("/api/tasks?include_archived=true");
    expect(response.status).toBe(200);
    return response.body.filter(
      (task: { source?: string }) => task.source === "planning",
    );
  }

  it("sync_skips_unchanged_hash", async () => {
    await configurePlanningFolder(FIXTURE_BASELINE_MARKDOWN);
    await seedMatchingHash(FIXTURE_BASELINE_MARKDOWN);

    const countBefore = (await client.get("/api/tasks")).body.length;

    const syncResponse = await client.post("/api/settings/sync-planning");

    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body).toMatchObject({
      status: "skipped",
      reason: "File content hash has not changed.",
      tasks_created: 0,
      tasks_updated: 0,
    });

    const countAfter = (await client.get("/api/tasks")).body.length;
    expect(countAfter).toBe(countBefore);
  });

  it("sync_imports_modified_markdown", async () => {
    await configurePlanningFolder(FIXTURE_CHANGED_MARKDOWN);

    const syncResponse = await client.post("/api/settings/sync-planning");

    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body.status).toBe("success");
    expect(syncResponse.body.tasks_created + syncResponse.body.tasks_updated).toBeGreaterThan(
      0,
    );
    expect(typeof syncResponse.body.tasks_created).toBe("number");
    expect(typeof syncResponse.body.tasks_updated).toBe("number");

    const tasksResponse = await client.get("/api/tasks");
    expect(tasksResponse.status).toBe(200);
    expect(
      tasksResponse.body.some((task: { name: string }) => task.name === "New task from sync"),
    ).toBe(true);

    const settingsResponse = await client.get("/api/settings");
    expect(settingsResponse.status).toBe(200);

    const storedHash = JSON.parse(settingsResponse.body[SYNC_HASH_SETTING_KEY]) as {
      file_name: string;
      hash: string;
    };
    expect(storedHash.file_name).toBe(CURRENT_PLANNING_FILE_NAME);
    expect(storedHash.hash).toBe(computeFileHash(FIXTURE_CHANGED_MARKDOWN));
  });

  it("sync_archives_done_checkbox_tasks", async () => {
    await configurePlanningFolder(FIXTURE_DONE_MARKDOWN);

    const syncResponse = await client.post("/api/settings/sync-planning");

    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body.status).toBe("success");

    const allPlanningTasks = await getPlanningTasks();
    const doneTask = allPlanningTasks.find(
      (task) => task.name === "Completed fixture task",
    );

    expect(doneTask).toMatchObject({
      name: "Completed fixture task",
      archived: true,
    });

    const defaultListResponse = await client.get("/api/tasks");
    expect(defaultListResponse.status).toBe(200);
    expect(
      defaultListResponse.body.find(
        (task: { name: string }) => task.name === "Completed fixture task",
      ),
    ).toBeUndefined();

    const activeTask = defaultListResponse.body.find(
      (task: { name: string }) => task.name === "Active fixture task",
    );
    expect(activeTask).toBeDefined();
    expect(activeTask.archived).toBe(false);
  });

  it("sync_missing_default_project_uses_null_project_id", async () => {
    await configurePlanningFolder(FIXTURE_BASELINE_MARKDOWN);

    const syncResponse = await client.post("/api/settings/sync-planning");

    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body.status).toBe("success");

    const planningTasks = await getPlanningTasks();
    expect(planningTasks.length).toBeGreaterThan(0);
    for (const task of planningTasks) {
      expect(task.project_id).toBeNull();
    }
  });
});
