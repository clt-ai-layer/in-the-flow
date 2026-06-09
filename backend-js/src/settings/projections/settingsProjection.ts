import { mongoDBInlineProjection, type MongoDBReadEvent } from "@event-driven-io/emmett-mongodb";
import type { SettingsEvent } from "../domain/events.js";

export type SettingsDocument = Record<string, string>;

export const SETTINGS_PROJECTION_NAME = "settings_map";

export const settingsProjection = mongoDBInlineProjection<SettingsDocument, SettingsEvent>({
  name: SETTINGS_PROJECTION_NAME,
  schemaVersion: 1,
  canHandle: ["SettingUpserted"],
  initialState: (): SettingsDocument => ({}),
  evolve: (
    document: SettingsDocument,
    event: MongoDBReadEvent<SettingsEvent>,
  ): SettingsDocument | null => {
    switch (event.type) {
      case "SettingUpserted":
        return { ...document, [event.data.key]: event.data.value };
      default:
        return document;
    }
  },
});
