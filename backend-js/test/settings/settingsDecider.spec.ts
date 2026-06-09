import { describe, expect, it } from "vitest";
import { Settings } from "@/settings/domain/Settings.js";

const now = new Date("2026-01-01T00:00:00.000Z");

describe("Settings Entity", () => {
  it("upsert_setting_emits_event", () => {
    const settings = new Settings(Settings.initialState);
    const result = settings.upsertSetting({ key: "foo", value: "bar" }, now);

    expect(result.ok).toBe(true);

    const uncommitted = settings.getUncommittedEvents();
    expect(uncommitted).toHaveLength(1);
    expect(uncommitted[0]).toMatchObject({
      type: "SettingUpserted",
      data: {
        key: "foo",
        value: "bar",
        updated_at: now.toISOString(),
      },
    });
  });

  it("upsert_overwrites_existing_key", () => {
    const settings = new Settings(Settings.initialState);
    const secondNow = new Date("2026-01-02T00:00:00.000Z");

    settings.upsertSetting({ key: "foo", value: "bar" }, now);
    settings.upsertSetting({ key: "foo", value: "baz" }, secondNow);

    const uncommitted = settings.getUncommittedEvents();
    expect(uncommitted).toHaveLength(2);
    expect(uncommitted[1]).toMatchObject({
      type: "SettingUpserted",
      data: {
        key: "foo",
        value: "baz",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(settings.getState()).toEqual({
      lifecycle: "Active",
      settings: { foo: "baz" },
    });
  });

  it("rejects_empty_key", () => {
    const settings = new Settings(Settings.initialState);
    const result = settings.upsertSetting({ key: "", value: "bar" }, now);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.message).toContain("non-empty");
    }
  });
});
