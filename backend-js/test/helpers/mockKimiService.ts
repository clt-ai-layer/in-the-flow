import { vi, type MockInstance } from "vitest";
import { KimiInvalidJsonError, KimiService } from "@/ai/KimiService.js";

type KimiSpyMethod = keyof Pick<
  KimiService,
  "classifyTask" | "compileWeeklyPlan" | "analyzeTasks" | "enhanceTask" | "parseWeeklyPlanAi"
>;

/**
 * Spies on a {@link KimiService} prototype method to reject with {@link KimiInvalidJsonError}.
 * Use in API specs where routes construct `new KimiService()` — prototype spy applies.
 */
export function spyKimiMethodInvalidJson(method: KimiSpyMethod): MockInstance {
  return vi
    .spyOn(KimiService.prototype, method)
    .mockRejectedValue(new KimiInvalidJsonError());
}

/** Convenience spy for POST `/api/ai/classify` invalid-JSON path (acceptance #18). */
export function spyKimiClassifyInvalidJson(): MockInstance {
  return spyKimiMethodInvalidJson("classifyTask");
}

/** Restores all KimiService mocks after a spec. */
export function restoreKimiMocks(): void {
  vi.restoreAllMocks();
}
