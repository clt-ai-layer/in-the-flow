import type { Express } from "express";
import { Router } from "express";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { asyncHandler } from "@/platform/fastApiErrorMiddleware.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import type { UpsertSetting } from "@/settings/application/commands.js";
import {
  loadSettingsMap,
  SyncPlanningNotFoundError,
  syncWeeklyPlan,
} from "@/settings/syncPlanning/syncService.js";

function parseForceFlag(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

/**
 * Registers `/api/settings` REST routes with Python FastAPI parity.
 */
export function registerSettingsRoutes(
  app: Express,
  eventStore: MongoDBEventStore,
  bus: EntityCommandBus,
): void {
  const router = Router();

  router.get(
    "",
    asyncHandler(async (_req, res) => {
      const settings = await loadSettingsMap(eventStore);
      res.json(settings);
    }),
  );

  router.post(
    "",
    asyncHandler(async (req, res) => {
      const incoming = req.body as Record<string, string>;
      const current = await loadSettingsMap(eventStore);
      const now = new Date();
      const updatedKeys: string[] = [];

      for (const [key, value] of Object.entries(incoming)) {
        if (current[key] === value) {
          continue;
        }

        const command: UpsertSetting = {
          type: "UpsertSetting",
          data: { key, value },
          metadata: { now },
        };

        await bus.send(command);

        updatedKeys.push(key);
      }

      res.json({ status: "success", settings_updated: updatedKeys });
    }),
  );

  router.post(
    "/sync-planning",
    asyncHandler(async (req, res) => {
      const force = parseForceFlag(req.query.force);

      try {
        const result = await syncWeeklyPlan(eventStore, bus, force);
        res.json(result);
      } catch (error) {
        if (error instanceof SyncPlanningNotFoundError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        const wrapped = new Error(`An error occurred during synchronization: ${message}`);
        (wrapped as Error & { status: number }).status = 500;
        throw wrapped;
      }
    }),
  );

  app.use("/api/settings", router);
}
