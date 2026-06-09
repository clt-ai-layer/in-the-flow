import { Outcome, type Outcome as OutcomeType } from "@/es-kit/domain/Outcome.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function parseTimeMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Validates schedule fields for a daily task.
 *
 * @service
 * @businessConcept Calendar blocks must have valid dates, 15-minute-aligned times,
 *   and positive duration within the same day.
 * @returns Outcome.ok on valid schedule, Outcome.fail("validation", ...) on invalid.
 * @throws Never throws.
 */
export function validateSchedule(
  date: string,
  startTime: string,
  endTime: string,
): OutcomeType<void> {
  if (!DATE_PATTERN.test(date)) {
    return Outcome.fail("validation", `Invalid date '${date}'. Expected YYYY-MM-DD.`);
  }

  for (const [label, timeVal] of [
    ["start_time", startTime] as const,
    ["end_time", endTime] as const,
  ]) {
    if (!TIME_PATTERN.test(timeVal)) {
      return Outcome.fail(
        "validation",
        `Invalid ${label} '${timeVal}'. Expected HH:mm.`,
      );
    }
    const minutes = Number(timeVal.split(":")[1]);
    if (minutes % 15 !== 0) {
      return Outcome.fail(
        "validation",
        `${label} '${timeVal}' must align to 15-minute boundaries.`,
      );
    }
  }

  const startMinutes = parseTimeMinutes(startTime);
  const endMinutes = parseTimeMinutes(endTime);

  if (endMinutes <= startMinutes) {
    return Outcome.fail(
      "validation",
      "end_time must be after start_time on the same day.",
    );
  }

  return Outcome.ok(undefined);
}
