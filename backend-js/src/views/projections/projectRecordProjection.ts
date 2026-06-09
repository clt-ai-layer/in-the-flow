import type { MongoClient } from "mongodb";
import type { ProjectListDocument } from "@/project/projections/projectListProjection.js";
import {
  DATABASE_RECORDS_COLLECTION,
  PROJECTS_DATABASE_ID,
} from "@/views/eavIds.js";
import { getDatabaseName } from "@/platform/mongoUri.js";

export type ProjectRecordPropertyValues = {
  Name: string;
  Description: string;
  Color: string;
};

/**
 * Maps a project list read model to EAV property_values matching Python seed migration.
 */
export function mapProjectToPropertyValues(
  project: ProjectListDocument,
): ProjectRecordPropertyValues {
  return {
    Name: project.name,
    Description: project.description ?? "",
    Color: project.color,
  };
}

function getRecordsCollection(client: MongoClient) {
  return client.db(getDatabaseName()).collection(DATABASE_RECORDS_COLLECTION);
}

/**
 * Upserts a Projects Workspace EAV record for the given project.
 */
export async function upsertProjectRecord(
  client: MongoClient,
  project: ProjectListDocument,
): Promise<void> {
  const propertyValues = mapProjectToPropertyValues(project);

  await getRecordsCollection(client).updateOne(
    { id: project.id },
    {
      $set: {
        id: project.id,
        database_id: PROJECTS_DATABASE_ID,
        property_values: JSON.stringify(propertyValues),
      },
    },
    { upsert: true },
  );
}

/**
 * Removes the EAV record linked to a deleted project.
 */
export async function deleteProjectRecord(
  client: MongoClient,
  projectId: string,
): Promise<void> {
  await getRecordsCollection(client).deleteOne({ id: projectId });
}
