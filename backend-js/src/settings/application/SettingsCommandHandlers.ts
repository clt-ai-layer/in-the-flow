import type { IEntityCommandHandler } from "@/es-kit/handlers/IEntityCommandHandler.js";
import type { Outcome } from "@/es-kit/domain/Outcome.js";
import { Settings } from "../domain/Settings.js";
import type { UpsertSetting } from "./commands.js";

/**
 * Upserts a single setting in the global Settings singleton.
 *
 * @commandHandler
 * @implements IEntityCommandHandler — always targets Settings.GLOBAL_ID.
 * @workflow Ignores command data for ID resolution, delegates to entity.upsertSetting().
 */
export class UpsertSettingHandler implements IEntityCommandHandler<Settings, UpsertSetting> {
  readonly commandType = "UpsertSetting";
  readonly Entity = Settings;

  getEntityId(_command: UpsertSetting): string {
    return Settings.GLOBAL_ID;
  }

  route(entity: Settings, command: UpsertSetting): Outcome<void> {
    return entity.upsertSetting(command.data, command.metadata?.now);
  }
}
