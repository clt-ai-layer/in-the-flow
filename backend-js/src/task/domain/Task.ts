import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { Outcome, type Outcome as OutcomeType } from "@/es-kit/domain/Outcome.js";
import type {
  TaskCreated,
  TaskDeleted,
  TaskEvent,
  TaskFields,
  TaskUpdated,
} from "./events.js";
import { validateTaskStatus } from "./taskStatus.js";

function toIsoUtc(date: Date): string {
  return date.toISOString();
}

// ── State types (absorbed from state.ts) ─────────────────────────

export type EmptyTask = { lifecycle: "Empty" };

export type ActiveTask = {
  lifecycle: "Active";
  id: string;
  name: string;
  description: string | null;
  status: string;
  category: string;
  source: string;
  owner: string | null;
  task_grouping: string | null;
  archived: boolean;
  estimated_duration: number | null;
  current_duration: number | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DeletedTask = {
  lifecycle: "Deleted";
  id: string;
};

export type TaskState = EmptyTask | ActiveTask | DeletedTask;

// ── Entity ───────────────────────────────────────────────────────

/**
 * Task aggregate root — master task entity.
 *
 * @businessContext  Tracks work items across their full lifecycle.
 * @invariants       Lifecycle: Empty → Active → Deleted (no resurrection).
 *                   Status must be a valid canonical task status.
 * @emits TaskCreated, TaskUpdated, TaskDeleted
 */
export class Task extends EntityRoot<TaskState, TaskEvent> {
  /** Persisted stream type — NEVER rename without migration. */
  static readonly streamType = "task" as const;

  static readonly initialState: TaskState = { lifecycle: "Empty" };

  constructor(state: TaskState) {
    super(state);
  }

  // ── Evolve bridge ────────────────────────────────────────────

  /**
   * Folds one domain event into state. Used by the bus as `evolve`.
   */
  static replayState(state: TaskState, event: TaskEvent): TaskState {
    return Task.fromState(state).when(state, event);
  }

  protected when(state: TaskState, event: TaskEvent): TaskState {
    switch (event.type) {
      case "TaskCreated":
        return {
          lifecycle: "Active",
          id: event.data.id,
          name: event.data.name,
          description: event.data.description,
          status: event.data.status,
          category: event.data.category,
          source: event.data.source,
          owner: event.data.owner,
          task_grouping: event.data.task_grouping,
          archived: event.data.archived,
          estimated_duration: event.data.estimated_duration,
          current_duration: event.data.current_duration,
          project_id: event.data.project_id,
          created_at: event.data.created_at,
          updated_at: event.data.updated_at,
        };
      case "TaskUpdated": {
        if (state.lifecycle !== "Active") {
          return state;
        }
        return {
          ...state,
          ...event.data.patch,
          updated_at: event.data.updated_at,
        };
      }
      case "TaskDeleted":
        return { lifecycle: "Deleted", id: event.data.id };
      default:
        return state;
    }
  }

  // ── Domain methods (Apply pattern) ────────────────────────────

  /**
   * Creates a new task when lifecycle is Empty.
   *
   * @precondition Lifecycle must be Empty.
   * @emits TaskCreated
   * @throws Never throws — returns Outcome.fail on invalid state or data.
   */
  create(
    data: Partial<TaskFields> & { name: string; id?: string },
    now?: Date,
  ): OutcomeType<void> {
    if (this.state.lifecycle !== "Empty") {
      return Outcome.fail("illegal", "Task already exists.");
    }

    const timestamp = toIsoUtc(now ?? new Date());

    let status: string;
    try {
      status = validateTaskStatus(data.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Outcome.fail("validation", message);
    }

    const event: TaskCreated = {
      type: "TaskCreated",
      data: {
        id: data.id ?? "",
        name: data.name,
        description: data.description ?? null,
        status,
        category: data.category ?? "business",
        source: data.source ?? "user_created",
        owner: data.owner ?? "Alice",
        task_grouping: data.task_grouping ?? "General",
        archived: data.archived ?? false,
        estimated_duration: data.estimated_duration ?? null,
        current_duration: data.current_duration ?? 0,
        project_id: data.project_id ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      },
    };

    this.apply(event);
    return Outcome.unit();
  }

  /**
   * Updates an active task with a partial field patch.
   *
   * @precondition Lifecycle must be Active.
   * @emits TaskUpdated
   * @throws Never throws — returns Outcome.fail on invalid state or data.
   */
  update(
    data: { id: string; patch: Partial<TaskFields> },
    now?: Date,
  ): OutcomeType<void> {
    const active = this.requireActive(data.id);
    if (!active.ok) return active;

    let validatedPatch = { ...data.patch };
    if (validatedPatch.status !== undefined) {
      try {
        validatedPatch = {
          ...validatedPatch,
          status: validateTaskStatus(validatedPatch.status),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Outcome.fail("validation", message);
      }
    }

    const event: TaskUpdated = {
      type: "TaskUpdated",
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
   * Soft-deletes an active task.
   *
   * @precondition Lifecycle must be Active.
   * @emits TaskDeleted
   * @throws Never throws — returns Outcome.fail on invalid state.
   */
  delete(data: { id: string }, now?: Date): OutcomeType<void> {
    const active = this.requireActive(data.id);
    if (!active.ok) return active;

    const event: TaskDeleted = {
      type: "TaskDeleted",
      data: {
        id: data.id,
        deleted_at: toIsoUtc(now ?? new Date()),
      },
    };

    this.apply(event);
    return Outcome.unit();
  }

  // ── Private helpers ──────────────────────────────────────────

  private requireActive(taskId: string): OutcomeType<ActiveTask> {
    if (this.state.lifecycle === "Empty") {
      return Outcome.fail(
        "not_found",
        `Task with ID '${taskId}' not found.`,
      );
    }
    if (this.state.lifecycle === "Deleted") {
      return Outcome.fail(
        "not_found",
        `Task with ID '${taskId}' not found.`,
      );
    }
    return Outcome.ok(this.state);
  }
}
