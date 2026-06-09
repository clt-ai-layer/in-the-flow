import type { MongoClient } from "mongodb";
import { getDatabaseName } from "@/platform/mongoUri.js";
import { DATABASE_RECORDS_COLLECTION } from "@/views/eavIds.js";
import type { RawDatabaseRecord } from "@/views/queryEngine/types.js";

function getRecordsCollection(client: MongoClient) {
  return client.db(getDatabaseName()).collection(DATABASE_RECORDS_COLLECTION);
}

/**
 * Loads all EAV records for a database id.
 */
export async function loadRecordsForDatabase(
  client: MongoClient,
  databaseId: string,
): Promise<RawDatabaseRecord[]> {
  const docs = await getRecordsCollection(client).find({ database_id: databaseId }).toArray();

  return docs.map((doc) => ({
    id: String(doc.id),
    database_id: String(doc.database_id),
    property_values: doc.property_values as string | Record<string, unknown>,
  }));
}

/**
 * Loads related EAV records by id list (used for rollup stub lookups).
 */
export async function loadRecordsByIds(
  client: MongoClient,
  recordIds: string[],
): Promise<RawDatabaseRecord[]> {
  if (recordIds.length === 0) {
    return [];
  }

  const docs = await getRecordsCollection(client)
    .find({ id: { $in: recordIds } })
    .toArray();

  return docs.map((doc) => ({
    id: String(doc.id),
    database_id: String(doc.database_id),
    property_values: doc.property_values as string | Record<string, unknown>,
  }));
}
