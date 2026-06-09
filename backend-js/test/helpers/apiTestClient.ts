import type { EventStore } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import type { Express } from "express";
import request from "supertest";

/**
 * Type alias for the Supertest agent returned by `request(app)`.
 * Derived from the actual return type to stay compatible across supertest versions.
 */
export type ApiTestClient = ReturnType<typeof request>;
import { createApp } from "@/platform/app.js";
import { getTestMongoEventStore } from "./testEventStore.js";

/**
 * Builds an Express app wired for Supertest against the given event store.
 */
export function createTestApp(eventStore: EventStore): Express {
  return createApp(eventStore);
}

/**
 * Returns a Supertest agent for the given event store.
 */
export function apiClient(eventStore: EventStore): ApiTestClient {
  return request(createTestApp(eventStore));
}

/**
 * Creates a Supertest agent backed by an in-worker Mongo Memory Server + inline projections.
 */
export async function apiClientWithMongo(): Promise<{
  eventStore: MongoDBEventStore;
  client: ApiTestClient;
}> {
  const eventStore = await getTestMongoEventStore();
  return { eventStore, client: apiClient(eventStore) };
}
