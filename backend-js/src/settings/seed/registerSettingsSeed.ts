import type { EventStore } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { registerSeedPhase } from "@/platform/seedService.js";
import { UpsertSettingHandler } from "@/settings/application/SettingsCommandHandlers.js";
import type { UpsertSetting } from "@/settings/application/commands.js";
import {
  DEFAULT_PLANNING_DIR,
  PLANNING_FOLDER_SETTING_KEY,
  PLANNING_SYNC_ENABLED_KEY,
} from "@/settings/syncPlanning/constants.js";
import { loadSettingsMap } from "@/settings/syncPlanning/syncService.js";

/**
 * Registers the idempotent settings seed phase (default planning folder path).
 */
export function registerSettingsSeedPhase(): void {
  registerSeedPhase({
    name: "seed-settings",
    isNeeded: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const settings = await loadSettingsMap(store);
      return (
        settings[PLANNING_FOLDER_SETTING_KEY] === undefined ||
        settings[PLANNING_SYNC_ENABLED_KEY] === undefined
      );
    },
    run: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const now = new Date();
      const settings = await loadSettingsMap(store);

      const bus = new EntityCommandBus(store);
      bus.register(new UpsertSettingHandler());

      if (settings[PLANNING_FOLDER_SETTING_KEY] === undefined) {
        const command: UpsertSetting = {
          type: "UpsertSetting",
          data: {
            key: PLANNING_FOLDER_SETTING_KEY,
            value: DEFAULT_PLANNING_DIR,
          },
          metadata: { now },
        };

        await bus.send(command);
      }

      if (settings[PLANNING_SYNC_ENABLED_KEY] === undefined) {
        const command: UpsertSetting = {
          type: "UpsertSetting",
          data: {
            key: PLANNING_SYNC_ENABLED_KEY,
            value: "false",
          },
          metadata: { now },
        };

        await bus.send(command);
      }
    },
  });
}

registerSettingsSeedPhase();
