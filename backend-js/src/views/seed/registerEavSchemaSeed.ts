import type { EventStore } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { getMongoClient } from "@/platform/mongoConfig.js";
import { registerSeedPhase } from "@/platform/seedService.js";
import { seedDatabaseSchemasIfEmpty, hasDatabaseSchemas } from "@/views/storage/databaseSchemaStore.js";

/**
 * Registers the idempotent EAV database schema seed phase.
 */
export function registerEavSchemaSeedPhase(): void {
  registerSeedPhase({
    name: "eav-database-schemas",
    isNeeded: async () => {
      const client = await getMongoClient();
      return !(await hasDatabaseSchemas(client));
    },
    run: async () => {
      const client = await getMongoClient();
      await seedDatabaseSchemasIfEmpty(client);
    },
  });
}

registerEavSchemaSeedPhase();
