import type { EventStore } from "@event-driven-io/emmett";
import {
  getMongoDBEventStore,
  type MongoDBEventStore,
} from "@event-driven-io/emmett-mongodb";
import { MongoClient } from "mongodb";
import { inlineProjections } from "./projections.js";
import { getDatabaseName, resolveMongoUri } from "./mongoUri.js";

let mongoClient: MongoClient | undefined;
let eventStore: MongoDBEventStore | undefined;

/**
 * Creates or returns the shared MongoDB client.
 *
 * @returns Connected Mongo client instance.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (mongoClient) {
    return mongoClient;
  }

  const uri = resolveMongoUri();
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  return mongoClient;
}

/**
 * Returns a Mongo client when credentials are configured; otherwise `null` (in-memory Vitest).
 */
export async function tryGetMongoClient(): Promise<MongoClient | null> {
  try {
    return await getMongoClient();
  } catch {
    return null;
  }
}

/**
 * Creates or returns the shared Emmett MongoDB event store.
 *
 * @returns Configured MongoDB event store.
 */
export async function getEventStore(): Promise<MongoDBEventStore> {
  if (eventStore) {
    return eventStore;
  }

  const client = await getMongoClient();
  eventStore = getMongoDBEventStore({
    client,
    storage: {
      type: "COLLECTION_PER_STREAM_TYPE",
      databaseName: getDatabaseName(),
    },
    projections: inlineProjections,
  });

  return eventStore;
}

/**
 * Closes MongoDB and event-store resources opened during startup.
 */
export async function closeMongoResources(): Promise<void> {
  eventStore = undefined;

  if (mongoClient) {
    await mongoClient.close();
    mongoClient = undefined;
  }
}

/**
 * Type alias used by route registration and seed hooks.
 */
export type InTheFlowEventStore = EventStore;
