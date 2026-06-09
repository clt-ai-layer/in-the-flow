import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { MongoClient } from "mongodb";
import { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { EntityLoggingMiddleware } from "@/es-kit/middleware/EntityLoggingMiddleware.js";
import { EntityTimingMiddleware } from "@/es-kit/middleware/EntityTimingMiddleware.js";
import { EntityIntegrationMiddleware } from "@/es-kit/middleware/EntityIntegrationMiddleware.js";
import { EntityContextMiddleware } from "@/es-kit/middleware/EntityContextMiddleware.js";
import {
  CreateDailyTaskHandler,
  UpdateDailyTaskHandler,
  DeleteDailyTaskHandler,
} from "@/dailyTask/application/DailyTaskCommandHandlers.js";
import {
  CreateTaskHandler,
  UpdateTaskHandler,
  DeleteTaskHandler,
} from "@/task/application/TaskCommandHandlers.js";
import { CreateProjectHandler } from "@/project/application/ProjectCommandHandlers.js";
import { UpsertSettingHandler } from "@/settings/application/SettingsCommandHandlers.js";
import { TaskIntegrationHandler } from "@/task/integration/TaskIntegrationHandler.js";
import { ProjectIntegrationHandler } from "@/project/integration/ProjectIntegrationHandler.js";
import {
  CreateDatabaseViewHandler,
  UpdateDatabaseViewConfigHandler,
  DeleteDatabaseViewHandler,
} from "@/views/application/DatabaseViewCommandHandlers.js";

// ── Central wiring ──────────────────────────────────────────────

/**
 * Creates the application-wide {@link EntityCommandBus} with all
 * registered command handlers, integration handlers, and pipeline behaviors.
 *
 * @description Called once at app bootstrap. The returned bus is passed to
 * route registrations — consumers dispatch via `bus.send(command)`.
 *
 * @param store - MongoDB event store for stream persistence.
 * @param client - Optional MongoDB client for transactional batch support.
 *   When provided, batch handlers will write all streams atomically via
 *   a MongoDB transaction. When omitted (e.g., in tests), batch handlers
 *   fall back to parallel non-transactional appends.
 */
export function createCommandBus(
  store: MongoDBEventStore,
  client?: MongoClient,
): EntityCommandBus {
  // Extract inline projection definitions from the store for transactional writes.
  // These are needed to compute projection updates inside the transaction.
  const inlineProjections = (store as any).inlineProjections as
    | ReadonlyArray<{ name: string; canHandle: string[]; handle: Function }>
    | undefined;

  const bus = new EntityCommandBus(
    store,
    client
      ? { client, inlineProjections: inlineProjections ?? [] }
      : undefined,
  );

  // ── Command handlers ────────────────────────────────────────
  bus.register(new CreateDailyTaskHandler());
  bus.register(new UpdateDailyTaskHandler());
  bus.register(new DeleteDailyTaskHandler());
  bus.register(new CreateTaskHandler());
  bus.register(new UpdateTaskHandler());
  bus.register(new DeleteTaskHandler());
  bus.register(new CreateProjectHandler());
  bus.register(new UpsertSettingHandler());
  bus.register(new CreateDatabaseViewHandler());
  bus.register(new UpdateDatabaseViewConfigHandler());
  bus.register(new DeleteDatabaseViewHandler());

  // ── Integration middleware (cross-aggregate side effects) ───
  const integration = new EntityIntegrationMiddleware(bus);
  integration.register(new TaskIntegrationHandler(store));
  integration.register(new ProjectIntegrationHandler());

  // ── Pipeline behaviors (order matters) ──────────────────────
  bus.use(new EntityContextMiddleware());  // context scope (first — wraps everything)
  bus.use(new EntityLoggingMiddleware());
  bus.use(new EntityTimingMiddleware());
  bus.use(integration);

  return bus;
}

