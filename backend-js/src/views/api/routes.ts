import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Router } from "express";
import { NotFoundError } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { toStreamName } from "@event-driven-io/emmett-mongodb";
import { asyncHandler } from "@/platform/fastApiErrorMiddleware.js";
import { tryGetMongoClient } from "@/platform/mongoConfig.js";
import {
  stripReadModelListMetadata,
  stripReadModelMetadata,
} from "@/platform/readModelUtils.js";
import type { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import type {
  CreateDatabaseView,
  DeleteDatabaseView,
  UpdateDatabaseViewConfig,
} from "@/views/application/commands.js";
import { DatabaseView } from "@/views/domain/DatabaseView.js";
import { executeView } from "@/views/queryEngine/QueryEngine.js";
import type { DatabaseViewConfig } from "@/views/queryEngine/types.js";
import {
  DATABASE_VIEW_LIST_PROJECTION_NAME,
  type DatabaseViewListDocument,
} from "@/views/projections/databaseViewListProjection.js";
import { loadRecordsForDatabase } from "@/views/storage/databaseRecordsStore.js";
import {
  loadAllDatabaseSchemas,
  loadDatabaseSchema,
} from "@/views/storage/databaseSchemaStore.js";
import { TASKS_DATABASE_ID } from "@/views/eavIds.js";

async function findViewById(
  eventStore: MongoDBEventStore,
  viewId: string,
): Promise<DatabaseViewListDocument | null> {
  const doc = await eventStore.projections.inline.findOne<DatabaseViewListDocument>({
    streamName: toStreamName(DatabaseView.streamType, viewId),
    projectionName: DATABASE_VIEW_LIST_PROJECTION_NAME,
  });
  return doc ? stripReadModelMetadata(doc) : null;
}

function toViewConfig(doc: DatabaseViewListDocument): DatabaseViewConfig {
  return {
    id: doc.id,
    database_id: doc.database_id,
    name: doc.name,
    layout_type: doc.layout_type,
    filters: doc.filters as DatabaseViewConfig["filters"],
    sorts: doc.sorts as DatabaseViewConfig["sorts"],
    grouping: doc.grouping as DatabaseViewConfig["grouping"],
    visible_properties: doc.visible_properties,
  };
}

/**
 * Registers `/api/views` REST routes with Python FastAPI parity.
 */
export function registerViewRoutes(app: Express, eventStore: MongoDBEventStore, bus: EntityCommandBus): void {
  const router = Router();

  router.get(
    "",
    asyncHandler(async (_req, res) => {
      const views = stripReadModelListMetadata(
        await eventStore.projections.inline.find<DatabaseViewListDocument>(
          {
            streamType: DatabaseView.streamType,
            projectionName: DATABASE_VIEW_LIST_PROJECTION_NAME,
          },
        ),
      );

      const client = await tryGetMongoClient();
      const schemas = client ? await loadAllDatabaseSchemas(client) : [];
      const schemaById = new Map(schemas.map((s) => [s.id, s]));

      const result = views.map((view) => ({
        id: view.id,
        database_id: view.database_id,
        database_name: schemaById.get(view.database_id)?.name ?? "Unknown",
        name: view.name,
        layout_type: view.layout_type,
        filters: view.filters,
        sorts: view.sorts,
        grouping: view.grouping,
        visible_properties: view.visible_properties,
      }));

      res.json(result);
    }),
  );

  router.get(
    "/:viewId",
    asyncHandler(async (req, res) => {
      const view = await findViewById(eventStore, req.params.viewId);
      if (!view) {
        throw new NotFoundError({
          id: req.params.viewId,
          type: "DatabaseView",
          message: "View not found",
        });
      }

      const client = await tryGetMongoClient();
      const schema = client ? await loadDatabaseSchema(client, view.database_id) : null;

      res.json({
        id: view.id,
        database_id: view.database_id,
        database_name: schema?.name ?? "Unknown",
        name: view.name,
        layout_type: view.layout_type,
        filters: view.filters,
        sorts: view.sorts,
        grouping: view.grouping,
        visible_properties: view.visible_properties,
        properties: schema?.properties ?? [],
      });
    }),
  );

  router.post(
    "",
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const now = new Date();
      const existingId = body.id != null ? String(body.id) : undefined;

      if (existingId) {
        const existing = await findViewById(eventStore, existingId);
        if (existing) {
          const command: UpdateDatabaseViewConfig = {
            type: "UpdateDatabaseViewConfig",
            data: {
              id: existingId,
              filters: body.filters as Record<string, unknown> | undefined,
              sorts: body.sorts as unknown[] | undefined,
              grouping: body.grouping as Record<string, unknown> | undefined,
              visible_properties: body.visible_properties as string[] | undefined,
            },
            metadata: { now },
          };

          await bus.send(command);

          res.json({ status: "success", id: existingId });
          return;
        }
      }

      const databaseId =
        body.database_id != null ? String(body.database_id) : TASKS_DATABASE_ID;

      const viewId = existingId ?? randomUUID();
      const command: CreateDatabaseView = {
        type: "CreateDatabaseView",
        data: {
          id: viewId,
          database_id: databaseId,
          name: String(body.name ?? "Untitled View"),
          layout_type: String(body.layout_type ?? "table"),
          filters: (body.filters as Record<string, unknown>) ?? {},
          sorts: (body.sorts as unknown[]) ?? [],
          grouping: (body.grouping as Record<string, unknown>) ?? {},
          visible_properties: (body.visible_properties as string[]) ?? [],
        },
        metadata: { now },
      };

      await bus.send(command);

      res.json({ status: "success", id: viewId });
    }),
  );

  router.post(
    "/:viewId/update-config",
    asyncHandler(async (req, res) => {
      const viewId = req.params.viewId;
      const body = req.body as Record<string, unknown>;
      const now = new Date();

      const command: UpdateDatabaseViewConfig = {
        type: "UpdateDatabaseViewConfig",
        data: {
          id: viewId,
          filters: body.filters as Record<string, unknown> | undefined,
          sorts: body.sorts as unknown[] | undefined,
          grouping: body.grouping as Record<string, unknown> | undefined,
          visible_properties: body.visible_properties as string[] | undefined,
        },
        metadata: { now },
      };

      await bus.send(command);

      res.json({ status: "success", id: viewId });
    }),
  );

  router.delete(
    "/:viewId",
    asyncHandler(async (req, res) => {
      const viewId = req.params.viewId;
      const now = new Date();

      const command: DeleteDatabaseView = {
        type: "DeleteDatabaseView",
        data: { id: viewId },
        metadata: { now },
      };

      await bus.send(command);

      res.json({ status: "success" });
    }),
  );

  router.post(
    "/:viewId/execute",
    asyncHandler(async (req, res) => {
      const view = await findViewById(eventStore, req.params.viewId);
      if (!view) {
        throw new NotFoundError({
          id: req.params.viewId,
          type: "DatabaseView",
          message: `View ${req.params.viewId} not found.`,
        });
      }

      const client = await tryGetMongoClient();
      const schemas = client ? await loadAllDatabaseSchemas(client) : [];
      const records = client
        ? await loadRecordsForDatabase(client, view.database_id)
        : [];
      const result = executeView(toViewConfig(view), records, schemas);

      res.json(result);
    }),
  );

  app.use("/api/views", router);
}
