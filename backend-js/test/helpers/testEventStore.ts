import { getMongoDBEventStore, type MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { inlineProjections } from "@/platform/projections.js";

const TEST_DB_NAME = "intheflow_test";

let memoryServer: MongoMemoryServer | undefined;
let memoryClient: MongoClient | undefined;
let memoryEventStore: MongoDBEventStore | undefined;

/**
 * Starts embedded MongoDB (once per Vitest worker) for API/route tests requiring inline projections.
 */
export async function getTestMongoEventStore(): Promise<MongoDBEventStore> {
  if (memoryEventStore) {
    return memoryEventStore;
  }

  memoryServer ??= await MongoMemoryServer.create();
  const uri = memoryServer.getUri();

  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = TEST_DB_NAME;

  memoryClient = new MongoClient(uri);
  await memoryClient.connect();

  memoryEventStore = getMongoDBEventStore({
    client: memoryClient,
    storage: {
      type: "COLLECTION_PER_STREAM_TYPE",
      databaseName: TEST_DB_NAME,
    },
    projections: inlineProjections,
  });

  return memoryEventStore;
}

/**
 * Stops embedded MongoDB started by {@link getTestMongoEventStore}.
 */
export async function stopTestMongoEventStore(): Promise<void> {
  memoryEventStore = undefined;

  if (memoryClient) {
    await memoryClient.close();
    memoryClient = undefined;
  }

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}
