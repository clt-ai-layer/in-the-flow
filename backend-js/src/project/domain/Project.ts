import { randomUUID } from "node:crypto";
import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { Outcome, type Outcome as OutcomeType } from "@/es-kit/domain/Outcome.js";
import type { ProjectCreated, ProjectEvent } from "./events.js";

function toIsoUtc(date: Date): string {
  return date.toISOString();
}

// ── State types (absorbed from state.ts) ─────────────────────────

export type EmptyProject = { lifecycle: "Empty" };

export type ActiveProject = {
  lifecycle: "Active";
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

export type ProjectState = EmptyProject | ActiveProject;

// ── Entity ───────────────────────────────────────────────────────

/**
 * Project aggregate root — top-level organizational container.
 *
 * @businessContext  Groups tasks and daily tasks under a named project.
 * @invariants       Lifecycle: Empty → Active (no duplicate creation).
 * @emits ProjectCreated
 */
export class Project extends EntityRoot<ProjectState, ProjectEvent> {
  /** Persisted stream type — NEVER rename without migration. */
  static readonly streamType = "project" as const;

  static readonly initialState: ProjectState = { lifecycle: "Empty" };

  constructor(state: ProjectState) {
    super(state);
  }

  // ── Evolve bridge ────────────────────────────────────────────

  /**
   * Folds one domain event into state. Used by handler dispatch as `evolve`.
   */
  static replayState(
    state: ProjectState,
    event: ProjectEvent,
  ): ProjectState {
    return Project.fromState(state).when(state, event);
  }

  protected when(
    state: ProjectState,
    event: ProjectEvent,
  ): ProjectState {
    switch (event.type) {
      case "ProjectCreated":
        return {
          lifecycle: "Active",
          id: event.data.id,
          name: event.data.name,
          description: event.data.description,
          color: event.data.color,
          created_at: event.data.created_at,
        };
      default:
        return state;
    }
  }

  // ── Domain methods (Apply pattern) ──────────────────────────

  /**
   * Creates a new project when lifecycle is Empty.
   *
   * @precondition Lifecycle must be Empty.
   * @emits ProjectCreated
   * @throws Never throws — returns Outcome.fail on invalid state.
   */
  create(
    data: {
      id?: string;
      name: string;
      description?: string | null;
      color?: string;
    },
    now?: Date,
  ): OutcomeType<void> {
    if (this.state.lifecycle !== "Empty") {
      return Outcome.fail("illegal", "Project already exists.");
    }

    const timestamp = toIsoUtc(now ?? new Date());

    const event: ProjectCreated = {
      type: "ProjectCreated",
      data: {
        id: data.id ?? randomUUID(),
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? "#3B82F6",
        created_at: timestamp,
      },
    };

    this.apply(event);
    return Outcome.unit();
  }
}
