import { Outcome, type Outcome as OutcomeType } from "@/es-kit/domain/Outcome.js";

export const VALID_OWNERS = ["Alice", "Bob", "Shared"] as const;
export type DailyTaskOwner = (typeof VALID_OWNERS)[number];

/**
 * Normalizes and validates a daily-task owner value.
 *
 * @valueObject
 * @immutable
 * @businessConcept Team member assignment for calendar blocks.
 * @returns Outcome with validated DailyTaskOwner on success.
 * @throws Never throws — returns Outcome.fail on invalid input.
 */
export function normalizeOwner(owner: string): OutcomeType<DailyTaskOwner> {
  const normalized = owner.trim();
  if (!VALID_OWNERS.includes(normalized as DailyTaskOwner)) {
    return Outcome.fail(
      "validation",
      `Invalid owner '${owner}'. Must be one of: ${VALID_OWNERS.join(", ")}.`,
    );
  }
  return Outcome.ok(normalized as DailyTaskOwner);
}

/**
 * Resolves the effective owner for API responses.
 * Falls back through stored → parent → default ("Alice").
 */
export function resolveOwner(
  storedOwner: string | null,
  parentOwner: string | null | undefined,
): DailyTaskOwner {
  if (storedOwner && VALID_OWNERS.includes(storedOwner as DailyTaskOwner)) {
    return storedOwner as DailyTaskOwner;
  }
  if (parentOwner && VALID_OWNERS.includes(parentOwner as DailyTaskOwner)) {
    return parentOwner as DailyTaskOwner;
  }
  return "Alice";
}
