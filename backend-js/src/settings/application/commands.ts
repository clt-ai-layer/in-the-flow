import type { Command } from "@event-driven-io/emmett";

export type UpsertSetting = Command<
  "UpsertSetting",
  {
    key: string;
    value: string;
  }
>;

export type SettingsCommand = UpsertSetting;
