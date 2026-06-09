import { KimiService } from "@/ai/KimiService.js";
import type { ParsedWeeklyTask } from "@/settings/syncPlanning/parseWeeklyPlan.js";

/**
 * AI weekly plan parsing fallback when regex parser yields zero tasks.
 *
 * @param content - Full planning markdown file content.
 * @param apiKey - Resolved Kimi API key from settings or env.
 * @returns Parsed tasks from Kimi, or empty list when unconfigured.
 */
export async function parseWeeklyPlanAi(
  content: string,
  apiKey: string,
): Promise<{ tasks: ParsedWeeklyTask[] }> {
  const service = new KimiService(apiKey);
  return service.parseWeeklyPlanAi(content);
}
