import type { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findBackendJsRoot } from "@/platform/pathUtils.js";
import { getDatabaseName } from "@/platform/mongoUri.js";
import {
  DATABASES_COLLECTION,
  PROJECTS_DATABASE_ID,
  TASKS_DATABASE_ID,
} from "@/views/eavIds.js";
import type { DatabaseProperty, DatabaseSchema } from "@/views/queryEngine/types.js";

type SchemaFile = {
  name: string;
  icon?: string;
  properties: DatabaseProperty[];
};

function getDatabasesCollection(client: MongoClient) {
  return client.db(getDatabaseName()).collection(DATABASES_COLLECTION);
}

function loadSchemaFile(filename: string): SchemaFile {
  const backendRoot = findBackendJsRoot();
  if (!backendRoot) {
    throw new Error("backend-js root not found for schema seed.");
  }

  const raw = readFileSync(join(backendRoot, "seed", filename), "utf-8");
  return JSON.parse(raw) as SchemaFile;
}

/**
 * Returns all database schemas from the read model collection.
 */
export async function loadAllDatabaseSchemas(client: MongoClient): Promise<DatabaseSchema[]> {
  const docs = await getDatabasesCollection(client).find({}).toArray();
  return docs.map((doc) => ({
    id: String(doc.id),
    name: String(doc.name),
    icon: doc.icon != null ? String(doc.icon) : undefined,
    properties: doc.properties as DatabaseProperty[],
  }));
}

/**
 * Loads a single database schema by id.
 */
export async function loadDatabaseSchema(
  client: MongoClient,
  databaseId: string,
): Promise<DatabaseSchema | null> {
  const doc = await getDatabasesCollection(client).findOne({ id: databaseId });
  if (!doc) {
    return null;
  }

  return {
    id: String(doc.id),
    name: String(doc.name),
    icon: doc.icon != null ? String(doc.icon) : undefined,
    properties: doc.properties as DatabaseProperty[],
  };
}

/**
 * Seeds Projects and Tasks Workspace schemas when the databases collection is empty.
 *
 * @returns true when schemas were inserted.
 */
export async function seedDatabaseSchemasIfEmpty(client: MongoClient): Promise<boolean> {
  const collection = getDatabasesCollection(client);
  const count = await collection.countDocuments({});
  if (count > 0) {
    return false;
  }

  const projectsSchema = loadSchemaFile("projects-workspace-schema.json");
  const tasksSchema = loadSchemaFile("tasks-workspace-schema.json");

  await collection.insertMany([
    {
      id: PROJECTS_DATABASE_ID,
      name: projectsSchema.name,
      icon: projectsSchema.icon,
      properties: projectsSchema.properties,
    },
    {
      id: TASKS_DATABASE_ID,
      name: tasksSchema.name,
      icon: tasksSchema.icon,
      properties: tasksSchema.properties,
    },
  ]);

  return true;
}

/**
 * Returns whether EAV database schemas have been seeded.
 */
export async function hasDatabaseSchemas(client: MongoClient): Promise<boolean> {
  const count = await getDatabasesCollection(client).countDocuments({});
  return count > 0;
}
