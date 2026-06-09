const VALID_TASK_STATUSES = new Set([
  "backlog",
  "ready_to_start",
  "in_progress",
  "on_hold",
  "done",
]);

const STATUS_ALIASES: Record<string, string> = {
  todo: "backlog",
  to_do: "backlog",
  not_started: "backlog",
  pending: "backlog",
  open: "backlog",
  ready: "ready_to_start",
  wip: "in_progress",
  "in-progress": "in_progress",
  hold: "on_hold",
  "on-hold": "on_hold",
  complete: "done",
  completed: "done",
};

/**
 * Returns a canonical task status or throws when the value is invalid.
 *
 * @param rawStatus - Raw status string from API input.
 * @returns Canonical status value.
 * @throws Error When the status cannot be mapped.
 */
export function validateTaskStatus(rawStatus: string | null | undefined): string {
  if (rawStatus === null || rawStatus === undefined) {
    return "backlog";
  }

  const normalized = String(rawStatus).trim().toLowerCase();
  if (!normalized) {
    return "backlog";
  }

  if (VALID_TASK_STATUSES.has(normalized)) {
    return normalized;
  }

  if (normalized in STATUS_ALIASES) {
    return STATUS_ALIASES[normalized]!;
  }

  const validList = [...VALID_TASK_STATUSES].sort().join(", ");
  const aliasList = Object.keys(STATUS_ALIASES).sort().join(", ");
  throw new Error(
    `Invalid task status '${rawStatus}'. Valid: ${validList}. Aliases: ${aliasList}`,
  );
}

/**
 * Permissive normalization for seed/import sources (mirrors Python `normalize_status`).
 *
 * @param rawStatus - Raw status from seed JSON or imports.
 * @returns Canonical status value.
 */
export function normalizeStatus(rawStatus: string | null | undefined): string {
  try {
    return validateTaskStatus(rawStatus);
  } catch {
    const statusLower = String(rawStatus ?? "").toLowerCase();

    if (statusLower.includes("progress")) {
      return "in_progress";
    }
    if (statusLower.includes("start")) {
      return "ready_to_start";
    }
    if (statusLower.includes("prioritized")) {
      return "ready_to_start";
    }
    if (statusLower.includes("hold")) {
      return "on_hold";
    }
    if (["done", "complete", "completed"].includes(statusLower)) {
      return "done";
    }

    return "backlog";
  }
}
