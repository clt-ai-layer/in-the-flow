import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { toStreamName } from "@event-driven-io/emmett-mongodb";
import { stripReadModelListMetadata, stripReadModelMetadata } from "@/platform/readModelUtils.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import type { CreateTask, UpdateTask } from "@/task/application/commands.js";
import { Task } from "@/task/domain/Task.js";
import {
  TASK_LIST_PROJECTION_NAME,
  type TaskListDocument,
} from "@/task/projections/taskListProjection.js";
import { PROJECT_LIST_PROJECTION_NAME } from "@/project/projections/projectListProjection.js";
import { Project } from "@/project/domain/Project.js";
import type { UpsertSetting } from "@/settings/application/commands.js";
import {
  SETTINGS_PROJECTION_NAME,
  type SettingsDocument,
} from "@/settings/projections/settingsProjection.js";
import { Settings } from "@/settings/domain/Settings.js";
import { getKimiApiKey } from "@/ai/keyResolution.js";
import {
  DEFAULT_PLANNING_DIR,
  PLANNING_FOLDER_SETTING_KEY,
  PLANNING_SYNC_ENABLED_KEY,
  SYNC_HASH_SETTING_KEY,
} from "./constants.js";
import {
  buildProjectMap,
  guessProjectId,
  guessTaskGrouping,
} from "./guessTaskGrouping.js";
import { parseWeeklyPlan } from "./parseWeeklyPlan.js";
import type { ParsedWeeklyTask } from "./parseWeeklyPlan.js";

export type SyncWeeklyPlanResult = {
  status: "success" | "skipped";
  reason?: string;
  file_parsed: string;
  parser_mode: "regex" | "ai" | "skipped";
  tasks_created: number;
  tasks_updated: number;
  tasks_archived: number;
  total_parsed: number;
};

type StoredHashData = {
  file_name?: string;
  hash?: string;
};

export class SyncPlanningNotFoundError extends Error {
  readonly status = 404;

  constructor(message: string) {
    super(message);
    this.name = "SyncPlanningNotFoundError";
  }
}

/**
 * Loads the flat settings map from the inline projection.
 */
export async function loadSettingsMap(
  eventStore: MongoDBEventStore,
): Promise<SettingsDocument> {
  const streamName = toStreamName(Settings.streamType, Settings.GLOBAL_ID);
  const doc = await eventStore.projections.inline.findOne<SettingsDocument>({
    streamName,
    projectionName: SETTINGS_PROJECTION_NAME,
  });

  return doc ? stripReadModelMetadata(doc) : {};
}

/**
 * Upserts a single setting key via the bus.
 */
export async function upsertSettingValue(
  bus: EntityCommandBus,
  key: string,
  value: string,
  now: Date = new Date(),
): Promise<void> {
  const command: UpsertSetting = {
    type: "UpsertSetting",
    data: { key, value },
    metadata: { now },
  };

  await bus.send(command);
}

function resolvePlanningDir(settings: SettingsDocument): string {
  return settings[PLANNING_FOLDER_SETTING_KEY] || DEFAULT_PLANNING_DIR;
}

/**
 * Finds the latest `Current_Planning_*.md` file in the planning directory.
 */
export function getActivePlanningFile(planningDir: string): { filePath: string; fileName: string } {
  if (!existsSync(planningDir)) {
    throw new SyncPlanningNotFoundError(
      `Planning directory not found at: ${planningDir}`,
    );
  }

  const files = readdirSync(planningDir);
  const currentPlanningFiles = files.filter(
    (f) => f.startsWith("Current_Planning_") && f.endsWith(".md"),
  );

  if (currentPlanningFiles.length === 0) {
    throw new SyncPlanningNotFoundError(
      "No active weekly planning file (prefixed with 'Current_Planning_') found.",
    );
  }

  currentPlanningFiles.sort();
  const fileName = currentPlanningFiles[currentPlanningFiles.length - 1];
  return { filePath: join(planningDir, fileName), fileName };
}

function computeFileHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function parseStoredHash(settings: SettingsDocument): StoredHashData {
  const raw = settings[SYNC_HASH_SETTING_KEY];
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as StoredHashData;
  } catch {
    return {};
  }
}

async function findTaskByNameAndSource(
  eventStore: MongoDBEventStore,
  name: string,
  source: string,
): Promise<TaskListDocument | null> {
  const tasks = stripReadModelListMetadata(
    await eventStore.projections.inline.find<TaskListDocument>(
      { streamType: Task.streamType, projectionName: TASK_LIST_PROJECTION_NAME },
      { name, source },
    ),
  );

  return tasks[0] ?? null;
}

async function findDonePlanningTasks(
  eventStore: MongoDBEventStore,
): Promise<TaskListDocument[]> {
  return stripReadModelListMetadata(
    await eventStore.projections.inline.find<TaskListDocument>(
      { streamType: Task.streamType, projectionName: TASK_LIST_PROJECTION_NAME },
      { source: "planning", status: "done", archived: false },
    ),
  );
}

async function loadProjectMap(eventStore: MongoDBEventStore): Promise<Map<string, string>> {
  const projects = stripReadModelListMetadata(
    await eventStore.projections.inline.find<{ name: string; id: string }>(
      { streamType: Project.streamType, projectionName: PROJECT_LIST_PROJECTION_NAME },
    ),
  );
  return buildProjectMap(projects);
}

async function handleCreateTask(
  bus: EntityCommandBus,
  taskData: ParsedWeeklyTask,
  projectId: string | null,
  now: Date,
): Promise<void> {
  const taskId = randomUUID();
  const grouping = guessTaskGrouping(
    taskData.name,
    taskData.description,
    taskData.category,
  );

  const command: CreateTask = {
    type: "CreateTask",
    data: {
      id: taskId,
      name: taskData.name,
      description: taskData.description,
      status: taskData.status,
      category: taskData.category,
      owner: taskData.owner,
      task_grouping: grouping,
      estimated_duration: 60,
      current_duration: 0,
      source: "planning",
      project_id: projectId,
      archived: taskData.status === "done",
    },
    metadata: { now },
  };

  // bus.send() triggers the handler + integration middleware (EAV upsert, etc.)
  await bus.send(command);
}

async function handleUpdateTask(
  bus: EntityCommandBus,
  existingTask: TaskListDocument,
  taskData: ParsedWeeklyTask,
  projectId: string | null,
  now: Date,
): Promise<void> {
  const grouping = guessTaskGrouping(
    taskData.name,
    taskData.description,
    taskData.category,
  );

  const patch: Record<string, unknown> = {
    description: taskData.description,
    status: taskData.status,
    category: taskData.category,
    owner: taskData.owner,
    task_grouping: grouping,
  };

  if (projectId) {
    patch.project_id = projectId;
  }

  if (taskData.status === "done") {
    patch.archived = true;
  }

  const command: UpdateTask = {
    type: "UpdateTask",
    data: { id: existingTask.id, patch },
    metadata: { now },
  };

  await bus.send(command);
}

async function handleArchiveTask(
  bus: EntityCommandBus,
  task: TaskListDocument,
  now: Date,
): Promise<void> {
  const patch = { archived: true };
  const command: UpdateTask = {
    type: "UpdateTask",
    data: { id: task.id, patch },
    metadata: { now },
  };

  await bus.send(command);
}

/**
 * Synchronizes weekly planning markdown into task aggregates (Python sync_weekly_plan parity).
 */
export async function syncWeeklyPlan(
  eventStore: MongoDBEventStore,
  bus: EntityCommandBus,
  force = false,
): Promise<SyncWeeklyPlanResult> {
  const settings = await loadSettingsMap(eventStore);

  const syncEnabled = settings[PLANNING_SYNC_ENABLED_KEY];
  if (!force && syncEnabled === "false") {
    return {
      status: "skipped",
      reason:
        "Automatic weekly plan sync is disabled. Use the weekly-planning-assistant CLI (apply-changes / seed-week) or POST with ?force=true.",
      file_parsed: "",
      parser_mode: "skipped",
      tasks_created: 0,
      tasks_updated: 0,
      tasks_archived: 0,
      total_parsed: 0,
    };
  }

  const planningDir = resolvePlanningDir(settings);
  const { filePath, fileName } = getActivePlanningFile(planningDir);

  const fileContent = readFileSync(filePath, "utf-8");
  const fileHash = computeFileHash(fileContent);
  const storedData = parseStoredHash(settings);

  if (
    !force &&
    storedData.file_name === fileName &&
    storedData.hash === fileHash
  ) {
    return {
      status: "skipped",
      reason: "File content hash has not changed.",
      file_parsed: fileName,
      parser_mode: "skipped",
      tasks_created: 0,
      tasks_updated: 0,
      tasks_archived: 0,
      total_parsed: 0,
    };
  }

  let parsedTasks = parseWeeklyPlan(fileContent);
  let parserMode: "regex" | "ai" = "regex";

  if (parsedTasks.length === 0) {
    const apiKey = getKimiApiKey(settings);
    if (apiKey) {
      try {
        const { parseWeeklyPlanAi } = await import("@/ai/syncPlanning/parseWeeklyPlanAi.js");
        const aiResult = await parseWeeklyPlanAi(fileContent, apiKey);
        parsedTasks = aiResult.tasks ?? [];
        if (parsedTasks.length > 0) {
          parserMode = "ai";
        }
      } catch (error) {
        console.warn(
          "AI parsing fallback error:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  const projectMap = await loadProjectMap(eventStore);
  const now = new Date();
  let createdCount = 0;
  let updatedCount = 0;

  for (const taskData of parsedTasks) {
    const existingTask = await findTaskByNameAndSource(
      eventStore,
      taskData.name,
      "planning",
    );

    const projectId = guessProjectId(
      taskData.name,
      taskData.description,
      taskData.category,
      projectMap,
    );

    if (existingTask) {
      await handleUpdateTask(bus, existingTask, taskData, projectId, now);
      updatedCount += 1;
    } else {
      await handleCreateTask(bus, taskData, projectId, now);
      createdCount += 1;
    }
  }

  const parsedNames = new Set(parsedTasks.map((t) => t.name));
  const doneTasks = await findDonePlanningTasks(eventStore);
  let archivedCount = 0;

  for (const doneTask of doneTasks) {
    if (!parsedNames.has(doneTask.name)) {
      await handleArchiveTask(bus, doneTask, now);
      archivedCount += 1;
    }
  }

  await upsertSettingValue(
    bus,
    SYNC_HASH_SETTING_KEY,
    JSON.stringify({ file_name: fileName, hash: fileHash }),
    now,
  );

  return {
    status: "success",
    file_parsed: fileName,
    parser_mode: parserMode,
    tasks_created: createdCount,
    tasks_updated: updatedCount,
    tasks_archived: archivedCount,
    total_parsed: parsedTasks.length,
  };
}
