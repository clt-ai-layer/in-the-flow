import { MongoDBContainer, type StartedMongoDBContainer } from "@testcontainers/mongodb";
import { closeMongoResources } from "@/platform/mongoConfig.js";
import { resolveMongoUri } from "@/platform/mongoUri.js";

const TEST_DB_NAME = "intheflow_test";

export type MongoIntegrationContext = {
  /** Mongo connection string used for this suite. */
  uri: string;
  /** Whether the URI came from TestContainers. */
  usedTestContainer: boolean;
};

let activeContainer: StartedMongoDBContainer | undefined;

/**
 * Starts TestContainers Mongo when Docker is available.
 */
export async function tryStartMongoTestContainer(): Promise<string | null> {
  try {
    const container = await new MongoDBContainer("mongo:7").start();
    activeContainer = container;
    return container.getConnectionString();
  } catch {
    return null;
  }
}

/**
 * Resolves integration Mongo URI: TestContainers first, then env / `.mongo-key`.
 */
export async function resolveIntegrationMongoUri(): Promise<string | null> {
  const containerUri = await tryStartMongoTestContainer();
  if (containerUri) {
    return containerUri;
  }

  try {
    return resolveMongoUri();
  } catch {
    return null;
  }
}

/**
 * Prepares process env for integration tests against `intheflow_test`.
 */
export function applyIntegrationMongoEnv(uri: string): void {
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = TEST_DB_NAME;
  process.env.NODE_ENV = "test";
}

/**
 * Drops all collections in the integration database (shared-cluster fallback).
 */
export async function truncateIntegrationDatabase(uri: string): Promise<void> {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(TEST_DB_NAME);
    const collections = await db.listCollections().toArray();
    await Promise.all(
      collections.map((c) => db.collection(c.name).deleteMany({})),
    );
  } finally {
    await client.close();
  }
}

/**
 * Creates a Mongo integration context or returns null when no URI is available.
 */
export async function createMongoIntegrationContext(): Promise<MongoIntegrationContext | null> {
  const usedTestContainer = !!activeContainer;
  const uri =
    activeContainer?.getConnectionString() ?? (await resolveIntegrationMongoUri());

  if (!uri) {
    return null;
  }

  applyIntegrationMongoEnv(uri);

  if (!usedTestContainer) {
    await truncateIntegrationDatabase(uri);
  }

  return { uri, usedTestContainer };
}

/**
 * Tears down TestContainers and closes shared Emmett Mongo clients.
 */
export async function teardownMongoIntegrationContext(): Promise<void> {
  await closeMongoResources();

  if (activeContainer) {
    await activeContainer.stop();
    activeContainer = undefined;
  }
}
