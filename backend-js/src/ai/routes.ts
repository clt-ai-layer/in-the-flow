import type { Express } from "express";
import { Router } from "express";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { asyncHandler } from "@/platform/fastApiErrorMiddleware.js";
import { stripReadModelListMetadata } from "@/platform/readModelUtils.js";
import { appendAiLog } from "@/ai/AiLogRepository.js";
import { getKimiApiKey } from "@/ai/keyResolution.js";
import { KimiInvalidJsonError, KimiService } from "@/ai/KimiService.js";
import { loadAllPlanningMarkdown, loadEnhanceTicketContext } from "@/ai/planningFiles.js";
import { PROJECT_LIST_PROJECTION_NAME } from "@/project/projections/projectListProjection.js";
import { Project } from "@/project/domain/Project.js";
import {
  DEFAULT_PLANNING_DIR,
  PLANNING_FOLDER_SETTING_KEY,
} from "@/settings/syncPlanning/constants.js";
import { loadSettingsMap } from "@/settings/syncPlanning/syncService.js";
import {
  TASK_LIST_PROJECTION_NAME,
  type TaskListDocument,
} from "@/task/projections/taskListProjection.js";
import { Task } from "@/task/domain/Task.js";

type ClassifyRequestBody = {
  name: string;
  description?: string;
};

type EnhanceRequestBody = {
  name: string;
  description_stub?: string;
};

function resolvePlanningPath(settings: Record<string, string>): string {
  return settings[PLANNING_FOLDER_SETTING_KEY] || DEFAULT_PLANNING_DIR;
}

async function logAiCall(
  action: string,
  prompt: string,
  result: unknown,
  tokensUsed: number,
  model: string,
  error?: string,
): Promise<void> {
  try {
    await appendAiLog({
      action,
      prompt,
      response: typeof result === "string" ? result : JSON.stringify(result),
      tokens_used: tokensUsed,
      model,
      error,
    });
  } catch (logError) {
    console.error(
      "Failed to append AiLog:",
      logError instanceof Error ? logError.message : String(logError),
    );
  }
}

/**
 * Registers `/api/ai` REST routes with Python FastAPI parity.
 */
export function registerAiRoutes(
  app: Express,
  eventStore: MongoDBEventStore,
): void {
  const router = Router();

  router.post(
    "/classify",
    asyncHandler(async (req, res) => {
      const body = req.body as ClassifyRequestBody;
      const settings = await loadSettingsMap(eventStore);
      const apiKey = getKimiApiKey(settings);
      const service = new KimiService(apiKey);

      const projects = stripReadModelListMetadata(
        await eventStore.projections.inline.find<{ id: string; name: string }>(
          { streamType: Project.streamType, projectionName: PROJECT_LIST_PROJECTION_NAME },
        ),
      );
      const projectNames = projects.map((project) => project.name);

      const promptStr = `Classify task: ${body.name}\nDescription: ${body.description ?? ""}`;

      try {
        const result = await service.classifyTask(
          body.name,
          body.description ?? "",
          projectNames,
        );

        await logAiCall(
          "classify_task",
          promptStr,
          result,
          service.getLastTokensUsed(),
          service.isConfigured ? service.model : "stub",
        );

        if (result.project_name && typeof result.project_name === "string") {
          const matched = projects.find((project) => project.name === result.project_name);
          if (matched) {
            result.project_id = matched.id;
          }
        }

        res.json(result);
      } catch (error) {
        const detail =
          error instanceof KimiInvalidJsonError
            ? error.detail
            : error instanceof Error
              ? error.message
              : "Internal server error";

        await logAiCall("classify_task", promptStr, { detail }, 0, "kimi-k2.6", detail);

        const httpError = new Error(detail);
        (httpError as Error & { status: number }).status = 500;
        throw httpError;
      }
    }),
  );

  router.post(
    "/weekly-plan",
    asyncHandler(async (req, res) => {
      const settings = await loadSettingsMap(eventStore);
      const apiKey = getKimiApiKey(settings);
      const service = new KimiService(apiKey);
      const planningPath = resolvePlanningPath(settings);
      const planningContext = loadAllPlanningMarkdown(planningPath);
      const prompt = "Loaded planning folder md files";

      try {
        const result = await service.compileWeeklyPlan(planningContext);
        await logAiCall(
          "weekly_plan_compilation",
          prompt,
          result,
          service.getLastTokensUsed(),
          service.isConfigured ? service.model : "stub",
        );
        res.json(result);
      } catch (error) {
        const detail =
          error instanceof KimiInvalidJsonError
            ? error.detail
            : error instanceof Error
              ? error.message
              : "Internal server error";

        await logAiCall("weekly_plan_compilation", prompt, { detail }, 0, "kimi-k2.6", detail);

        const httpError = new Error(detail);
        (httpError as Error & { status: number }).status = 500;
        throw httpError;
      }
    }),
  );

  router.post(
    "/flow-analyzer",
    asyncHandler(async (req, res) => {
      const settings = await loadSettingsMap(eventStore);
      const apiKey = getKimiApiKey(settings);
      const service = new KimiService(apiKey);

      const activeTasks = stripReadModelListMetadata(
        await eventStore.projections.inline.find<TaskListDocument>(
          { streamType: Task.streamType, projectionName: TASK_LIST_PROJECTION_NAME },
        ),
      ).filter((task) => task.status !== "done");

      const tasksData = activeTasks.map((task) => ({
        name: task.name,
        status: task.status,
        category: task.category,
        estimated_duration: task.estimated_duration,
        current_duration: task.current_duration,
      }));

      const prompt = `Analyzing ${tasksData.length} tasks`;

      try {
        const result = await service.analyzeTasks(tasksData);
        await logAiCall(
          "flow_blocker_diagnosis",
          prompt,
          result,
          service.getLastTokensUsed(),
          service.isConfigured ? service.model : "stub",
        );
        res.json(result);
      } catch (error) {
        const detail =
          error instanceof KimiInvalidJsonError
            ? error.detail
            : error instanceof Error
              ? error.message
              : "Internal server error";

        await logAiCall("flow_blocker_diagnosis", prompt, { detail }, 0, "kimi-k2.6", detail);

        const httpError = new Error(detail);
        (httpError as Error & { status: number }).status = 500;
        throw httpError;
      }
    }),
  );

  router.post(
    "/enhance-ticket",
    asyncHandler(async (req, res) => {
      const body = req.body as EnhanceRequestBody;
      const settings = await loadSettingsMap(eventStore);
      const apiKey = getKimiApiKey(settings);
      const service = new KimiService(apiKey);
      const planningPath = resolvePlanningPath(settings);
      const contextStr = loadEnhanceTicketContext(planningPath);
      const prompt = `Enhance: ${body.name}`;

      try {
        const result = await service.enhanceTask(
          body.name,
          body.description_stub ?? "",
          contextStr || undefined,
        );

        await logAiCall(
          "ticket_description_enhancement",
          prompt,
          result,
          service.getLastTokensUsed(),
          service.isConfigured ? service.model : "stub",
        );

        res.json(result);
      } catch (error) {
        const detail =
          error instanceof KimiInvalidJsonError
            ? error.detail
            : error instanceof Error
              ? error.message
              : "Internal server error";

        await logAiCall("ticket_description_enhancement", prompt, { detail }, 0, "kimi-k2.6", detail);

        const httpError = new Error(detail);
        (httpError as Error & { status: number }).status = 500;
        throw httpError;
      }
    }),
  );

  app.use("/api/ai", router);
}
