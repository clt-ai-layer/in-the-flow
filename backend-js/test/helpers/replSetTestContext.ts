/**
 * Test helper that starts a single-node MongoDB replica set via
 * `MongoMemoryReplSet` for transaction support.
 *
 * @description Transactions require a replica set — `MongoMemoryServer`
 * (standalone) does NOT support them. This helper manages the lifecycle
 * of a single-node replica set for integration tests.
 */
import {
  getMongoDBEventStore,
  type MongoDBEventStore,
} from "@event-driven-io/emmett-mongodb";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { inlineProjections } from "@/platform/projections.js";

const TEST_DB_NAME = "eskit_integration_test";

export type ReplSetTestContext = {
  replSet: MongoMemoryReplSet;
  client: MongoClient;
  store: MongoDBEventStore;
};

/**
 * Starts a single-node replica set and creates a connected event store.
 *
 * @description Call in `beforeAll` with a generous timeout (≥30s for replset init).
 */
export async function createReplSetContext(): Promise<ReplSetTestContext> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  const uri = replSet.getUri();
  const client = new MongoClient(uri);
  await client.connect();

  const store = getMongoDBEventStore({
    client,
    storage: {
      type: "COLLECTION_PER_STREAM_TYPE",
      databaseName: TEST_DB_NAME,
    },
    projections: inlineProjections,
  });

  return { replSet, client, store };
}

/**
 * Drops the test database and shuts down the replica set.
 *
 * @description Call in `afterAll`.
 */
export async function teardownReplSetContext(
  ctx: ReplSetTestContext | null,
): Promise<void> {
  if (!ctx) return;

  try {
    await ctx.client.db(TEST_DB_NAME).dropDatabase();
  } catch {
    // ignore — db may not exist
  }

  await ctx.client.close();
  await ctx.replSet.stop();
}
