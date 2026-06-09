import eavIds from "../../seed/eav-ids.json" with { type: "json" };

/** Projects Workspace database id (seeded EAV schema). */
export const PROJECTS_DATABASE_ID = eavIds.projectsDatabaseId;

/** Tasks Workspace database id (seeded EAV schema). */
export const TASKS_DATABASE_ID = eavIds.tasksDatabaseId;

/** Deterministic seeded view ids from eav-ids.json. */
export const VIEW_IDS = eavIds.views;

/** Mongo collection for EAV database schema documents. */
export const DATABASES_COLLECTION = "databases";

/** Mongo collection for EAV record documents consumed by QueryEngine. */
export const DATABASE_RECORDS_COLLECTION = "database_records";
