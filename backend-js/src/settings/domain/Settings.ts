import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { Outcome, type Outcome as OutcomeType } from "@/es-kit/domain/Outcome.js";
import type { SettingUpserted, SettingsEvent } from "./events.js";
import { validateSettingValue } from "./validateSetting.js";

function toIsoUtc(date: Date): string {
  return date.toISOString();
}

// ── State types (absorbed from state.ts) ─────────────────────────

export type SettingsState =
  | { lifecycle: "Empty" }
  | { lifecycle: "Active"; settings: Record<string, string> };

// ── Entity ───────────────────────────────────────────────────────

/**
 * Settings singleton aggregate root — global application configuration.
 *
 * @businessContext  Stores key-value settings (theme, API keys, sync config).
 *                   Only one instance exists (GLOBAL_ID = "global").
 * @invariants       Setting key must be non-empty. Known keys are validated
 *                   by the validateSetting domain service.
 * @emits SettingUpserted
 */
export class Settings extends EntityRoot<SettingsState, SettingsEvent> {
  /** Persisted stream type — NEVER rename without migration. */
  static readonly streamType = "settings" as const;

  static readonly initialState: SettingsState = { lifecycle: "Empty" };

  /** Singleton entity ID — only one Settings aggregate exists. */
  static readonly GLOBAL_ID = "global";

  constructor(state: SettingsState) {
    super(state);
  }

  // ── Evolve bridge ────────────────────────────────────────────

  /**
   * Folds one domain event into state. Used by handler dispatch as `evolve`.
   */
  static replayState(
    state: SettingsState,
    event: SettingsEvent,
  ): SettingsState {
    return Settings.fromState(state).when(state, event);
  }

  protected when(
    state: SettingsState,
    event: SettingsEvent,
  ): SettingsState {
    switch (event.type) {
      case "SettingUpserted": {
        const settings =
          state.lifecycle === "Active"
            ? { ...state.settings }
            : ({} as Record<string, string>);
        settings[event.data.key] = event.data.value;
        return { lifecycle: "Active", settings };
      }
      default:
        return state;
    }
  }

  // ── Domain methods (Apply pattern) ──────────────────────────

  /**
   * Upserts a single setting key-value pair.
   *
   * @precondition Key must be non-empty. Known keys are validated by the
   *               validateSetting domain service.
   * @emits SettingUpserted
   * @throws Never throws — returns Outcome.fail on validation errors.
   */
  upsertSetting(
    data: { key: string; value: string },
    now?: Date,
  ): OutcomeType<void> {
    const { key, value } = data;

    if (!key || key.trim().length === 0) {
      return Outcome.fail("validation", "Setting key must be non-empty.");
    }

    // Delegate to domain service for known-key validation.
    // validateSettingValue throws ValidationError on failure — catch and convert.
    try {
      validateSettingValue(key, value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Outcome.fail("validation", message);
    }

    const timestamp = toIsoUtc(now ?? new Date());

    const event: SettingUpserted = {
      type: "SettingUpserted",
      data: {
        key,
        value,
        updated_at: timestamp,
      },
    };

    this.apply(event);
    return Outcome.unit();
  }
}
