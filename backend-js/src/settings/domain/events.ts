import type { Event } from "@event-driven-io/emmett";

export type SettingUpserted = Event<
  "SettingUpserted",
  {
    key: string;
    value: string;
    updated_at: string;
  }
>;

export type SettingsEvent = SettingUpserted;
