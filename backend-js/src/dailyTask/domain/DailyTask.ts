import { randomUUID } from "node:crypto";
import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { Outcome, type Outcome as OutcomeType } from "@/es-kit/domain/Outcome.js";
import type {
  DailyTaskCreated,
  DailyTaskDeleted,
  DailyTaskEvent,
  DailyTaskFields,
  DailyTaskUpdated,
} from "./events.js";
import { normalizeOwner } from "./ValueObjects/Owner.js";
import { validateSchedule } from "./Services/validateSchedule.js";

function toIsoUtc(date: Date): string {
  return date.toISOString();
}

// ── State types (absorbed from state.ts) ─────────────────────────

export type ActiveDailyTask = DailyTaskFields & {
  lifecycle: "Active";
  id: string;
  created_at: string;
  updated_at: string;
};

export type DailyTaskState =
  | { lifecycle: "Empty" }
  | ActiveDailyTask
  | { lifecycle: "Deleted"; id: string };

// ── Entity ───────────────────────────────────────────────────────

/**
 * DailyTask aggregate root — calendar block entity.
 *
 * @businessContext  Time-blocked work sessions linked to parent Tasks.
 * @invariants       Lifecycle: Empty → Active → Deleted (no resurrection).
 *                   Schedule must be valid (YYYY-MM-DD, 15-min aligned, start < end).
 *                   Owner must be a known team member.
 * @emits DailyTaskCreated, DailyTaskUpdated, DailyTaskDeleted
 */
export class DailyTask extends EntityRoot<DailyTaskState, DailyTaskEvent> {
  /** Persisted stream type — NEVER rename without migration. */
  static readonly streamType = "dailyTask" as const;

  static readonly initialState: DailyTaskState = { lifecycle: "Empty" };

  constructor(state: DailyTaskState) {
    super(state);
  }

  // ── Evolve bridge ────────────────────────────────────────────

  /**
   * Folds one domain event into state. Used by handler dispatch as `evolve`.
   */
  static replayState(
    state: DailyTaskState,
    event: DailyTaskEvent,
  ): DailyTaskState {
    return DailyTask.fromState(state).when(state, event);
  }

  protected when(
    state: DailyTaskState,
    event: DailyTaskEvent,
  ): DailyTaskState {
    switch (event.type) {
      case "DailyTaskCreated":
        return {
          lifecycle: "Active",
          id: event.data.id,
          task_id: event.data.task_id,
          date: event.data.date,
          start_time: event.data.start_time,
          end_time: event.data.end_time,
          title: event.data.title,
          owner: event.data.owner,
          parent_task_name: event.data.parent_task_name,
          parent_task_grouping: event.data.parent_task_grouping,
          parent_project_id: event.data.parent_project_id,
          parent_status: event.data.parent_status,
          parent_archived: event.data.parent_archived,
          created_at: event.data.created_at,
          updated_at: event.data.updated_at,
        };
      case "DailyTaskUpdated":
        return state.lifecycle === "Active"
          ? { ...state, ...event.data.patch, updated_at: event.data.updated_at }
          : state;
      case "DailyTaskDeleted":
        return { lifecycle: "Deleted", id: event.data.id };
      default:
        return state;
    }
  }

  // ── Domain methods (Apply pattern) ──────────────────────────

  /**
   * Creates a new daily task when lifecycle is Empty.
   *
   * @precondition Lifecycle must be Empty.
   * @emits DailyTaskCreated
   * @throws Never throws — returns Outcome.fail on invalid state or data.
   */
  create(
    data: Partial<DailyTaskFields> & {
      id?: string;
      date: string;
      start_time: string;
      end_time: string;
    },
    now?: Date,
  ): OutcomeType<void> {
    if (this.state.lifecycle !== "Empty") {
      return Outcome.fail("illegal", "Daily task already exists.");
    }

    const timestamp = toIsoUtc(now ?? new Date());

    const scheduleResult = validateSchedule(
      data.date,
      data.start_time,
      data.end_time,
    );
    if (!scheduleResult.ok) return scheduleResult;

    const ownerResult = normalizeOwner(data.owner ?? "Alice");
    if (!ownerResult.ok) return ownerResult;

    const event: DailyTaskCreated = {
      type: "DailyTaskCreated",
      data: {
        id: data.id ?? randomUUID(),
        task_id: data.task_id ?? null,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        title: data.title ?? null,
        owner: ownerResult.value,
        parent_task_name: data.parent_task_name ?? null,
        parent_task_grouping: data.parent_task_grouping ?? null,
        parent_project_id: data.parent_project_id ?? null,
        parent_status: data.parent_status ?? null,
        parent_archived: data.parent_archived ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      },
    };

    this.apply(event);
    return Outcome.unit();
  }

  /**
   * Updates an active daily task with a partial field patch.
   *
   * @precondition Lifecycle must be Active.
   * @emits DailyTaskUpdated
   * @throws Never throws — returns Outcome.fail on invalid state or data.
   */
  update(
    data: { id: string; patch: Partial<DailyTaskFields> },
    now?: Date,
  ): OutcomeType<void> {
    const active = this.requireActive(data.id);
    if (!active.ok) return active;

    // Validate owner if present in patch
    let validatedPatch = { ...data.patch };
    if (validatedPatch.owner !== undefined) {
      const ownerResult = normalizeOwner(validatedPatch.owner);
      if (!ownerResult.ok) return ownerResult;
      validatedPatch = { ...validatedPatch, owner: ownerResult.value };
    }

    // Validate merged schedule
    const merged = { ...active.value, ...validatedPatch };
    const scheduleResult = validateSchedule(
      merged.date,
      merged.start_time,
      merged.end_time,
    );
    if (!scheduleResult.ok) return scheduleResult;

    const event: DailyTaskUpdated = {
      type: "DailyTaskUpdated",
      data: {
        id: data.id,
        patch: validatedPatch,
        updated_at: toIsoUtc(now ?? new Date()),
      },
    };

    this.apply(event);
    return Outcome.unit();
  }

  /**
   * Soft-deletes an active daily task.
   *
   * @precondition Lifecycle must be Active.
   * @emits DailyTaskDeleted
   * @throws Never throws — returns Outcome.fail on invalid state.
   */
  delete(
    data: { id: string },
    now?: Date,
  ): OutcomeType<void> {
    const active = this.requireActive(data.id);
    if (!active.ok) return active;

    const event: DailyTaskDeleted = {
      type: "DailyTaskDeleted",
      data: {
        id: data.id,
        deleted_at: toIsoUtc(now ?? new Date()),
      },
    };

    this.apply(event);
    return Outcome.unit();
  }

  // ── Private helpers ──────────────────────────────────────────

  private requireActive(dailyTaskId: string): OutcomeType<ActiveDailyTask> {
    if (this.state.lifecycle !== "Active") {
      return Outcome.fail(
        "not_found",
        `Daily task with ID '${dailyTaskId}' not found.`,
      );
    }
    return Outcome.ok(this.state);
  }
}
