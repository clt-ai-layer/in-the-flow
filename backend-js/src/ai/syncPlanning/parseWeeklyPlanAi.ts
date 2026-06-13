import { createAiService } from "@/ai/aiConfig.js";
import type { ParsedWeeklyTask } from "@/settings/syncPlanning/parseWeeklyPlan.js";
import type { SettingsDocument } from "@/settings/projections/settingsProjection.js";

/**
 * AI weekly plan parsing fallback when regex parser yields zero tasks.
 */
export async function parseWeeklyPlanAi(
  content: string,
  settings: SettingsDocument = {},
): Promise<{ tasks: ParsedWeeklyTask[] }> {
  const service = createAiService(settings);
  return service.parseWeeklyPlanAi(content);
}
