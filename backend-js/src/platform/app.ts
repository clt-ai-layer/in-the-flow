import type { EventStore } from "@event-driven-io/emmett";

import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";

import cors from "cors";

import express, { type Express } from "express";

import { registerDailyTaskRoutes } from "@/dailyTask/api/routes.js";

import { registerProjectRoutes } from "@/project/api/routes.js";

import "@/project/seed/registerProjectSeed.js";

import { registerSettingsRoutes } from "@/settings/api/routes.js";

import "@/settings/seed/registerSettingsSeed.js";

import { registerTaskRoutes } from "@/task/api/routes.js";

import "@/task/seed/registerTaskSeed.js";


import { createCommandBus } from "./entityHandlers.js";

import { registerAiRoutes } from "@/ai/routes.js";

import { registerViewRoutes } from "@/views/api/routes.js";

import "@/views/seed/registerEavSchemaSeed.js";

import "@/views/seed/registerViewsSeed.js";

import { fastApiErrorMiddleware } from "./fastApiErrorMiddleware.js";



export const HEALTH_RESPONSE = {

  status: "online",

  app: "InTheFlow Backend API",

  version: "2.0.0",

} as const;



/**

 * Creates the InTheFlow Express application shell.

 *

 * Domain routers register against this app via dedicated `register*Routes` functions.

 *

 * @param eventStore - Event store instance for route handlers and seed phases.

 * @returns Configured Express application.

 */

export function createApp(eventStore: EventStore): Express {

  const app = express();

  const mongoStore = eventStore as MongoDBEventStore;

  // Extract MongoClient from Emmett's internal store for transactional batch support.
  // The client property is not on the public type but is set at construction time.
  const mongoClient = (mongoStore as any).client as import("mongodb").MongoClient | undefined;

  const bus = createCommandBus(mongoStore, mongoClient);



  app.use(

    cors({

      origin: "*",

      credentials: true,

      methods: "*",

      allowedHeaders: "*",

    }),

  );



  app.use(express.json());

  app.use(express.urlencoded({ extended: true }));



  app.get("/", (_req, res) => {

    res.json(HEALTH_RESPONSE);

  });



  registerTaskRoutes(app, mongoStore, bus);

  registerProjectRoutes(app, mongoStore, bus);

  registerDailyTaskRoutes(app, mongoStore, bus);

  registerSettingsRoutes(app, mongoStore, bus);

  registerAiRoutes(app, mongoStore);

  registerViewRoutes(app, mongoStore, bus);



  app.use(fastApiErrorMiddleware);



  return app;

}


