import { EntityRoot } from "@/es-kit/domain/EntityRoot.js";
import { Outcome, type Outcome as OutcomeType } from "@/es-kit/domain/Outcome.js";
import type {
  DatabaseViewCreated,
  DatabaseViewConfigUpdated,
  DatabaseViewDeleted,
  DatabaseViewEvent,
} from "./events.js";

// ── State types (absorbed from state.ts) ─────────────────────────

export type EmptyDatabaseView = { lifecycle: "Empty" };

export type ActiveDatabaseView = {
  lifecycle: "Active";
  id: string;
  database_id: string;
  name: string;
  layout_type: string;
  filters: Record<string, unknown>;
  sorts: unknown[];
  grouping: Record<string, unknown>;
  visible_properties: string[];
};

export type DeletedDatabaseView = {
  lifecycle: "Deleted";
  id: string;
};

export type DatabaseViewState =
  | EmptyDatabaseView
  | ActiveDatabaseView
  | DeletedDatabaseView;

// ── Entity ───────────────────────────────────────────────────────

/**
 * DatabaseView aggregate root — database view configuration entity.
 *
 * @businessContext  Manages user-defined views over EAV databases (filters,
 *                  sorts, grouping, visible properties, layout).
 * @invariants      Lifecycle: Empty → Active → Deleted (no resurrection).
 *                  Only one create per stream; updates and deletes require Active.
 * @emits DatabaseViewCreated, DatabaseViewConfigUpdated, DatabaseViewDeleted
 */
export class DatabaseView extends EntityRoot<DatabaseViewState, DatabaseViewEvent> {
  /** Persisted stream type — NEVER rename without migration. */
  static readonly streamType = "databaseView" as const;

  static readonly initialState: DatabaseViewState = { lifecycle: "Empty" };

  constructor(state: DatabaseViewState) {
    super(state);
  }

  // ── Evolve bridge ────────────────────────────────────────────

  /**
   * Folds one domain event into state. Used by the bus as `evolve`.
   */
  static replayState(state: DatabaseViewState, event: DatabaseViewEvent): DatabaseViewState {
    return DatabaseView.fromState(state).when(state, event);
  }

  protected when(state: DatabaseViewState, event: DatabaseViewEvent): DatabaseViewState {
    switch (event.type) {
      case "DatabaseViewCreated":
        return {
          lifecycle: "Active",
          id: event.data.id,
          database_id: event.data.database_id,
          name: event.data.name,
          layout_type: event.data.layout_type,
          filters: event.data.filters,
          sorts: event.data.sorts as unknown[],
          grouping: event.data.grouping,
          visible_properties: event.data.visible_properties,
        };
      case "DatabaseViewConfigUpdated": {
        if (state.lifecycle !== "Active") {
          return state;
        }
        return {
          ...state,
          filters: event.data.filters ?? state.filters,
          sorts: (event.data.sorts ?? state.sorts) as unknown[],
          grouping: event.data.grouping ?? state.grouping,
          visible_properties: event.data.visible_properties ?? state.visible_properties,
        };
      }
      case "DatabaseViewDeleted":
        return { lifecycle: "Deleted", id: event.data.id };
      default:
        return state;
    }
  }

  // ── Domain methods (Apply pattern) ────────────────────────────

  /**
   * Creates a new database view when lifecycle is Empty.
   *
   * @precondition Lifecycle must be Empty.
   * @emits DatabaseViewCreated
   * @throws Never throws — returns Outcome.fail on invalid state.
   */
  create(
    data: {
      id?: string;
      database_id: string;
      name: string;
      layout_type: string;
      filters?: Record<string, unknown>;
      sorts?: unknown[];
      grouping?: Record<string, unknown>;
      visible_properties?: string[];
    },
    now?: Date,
  ): OutcomeType<void> {
    if (this.state.lifecycle !== "Empty") {
      return Outcome.fail("illegal", "Database view already exists.");
    }

    const event: DatabaseViewCreated = {
      type: "DatabaseViewCreated",
      data: {
        id: data.id ?? "",
        database_id: data.database_id,
        name: data.name,
        layout_type: data.layout_type,
        filters: data.filters ?? {},
        sorts: data.sorts ?? [],
        grouping: data.grouping ?? {},
        visible_properties: data.visible_properties ?? [],
      },
    };

    this.apply(event);
    return Outcome.unit();
  }

  /**
   * Updates the configuration of an active database view.
   *
   * @precondition Lifecycle must be Active.
   * @emits DatabaseViewConfigUpdated
   * @throws Never throws — returns Outcome.fail on invalid state.
   */
  updateConfig(
    data: {
      id: string;
      filters?: Record<string, unknown>;
      sorts?: unknown[];
      grouping?: Record<string, unknown>;
      visible_properties?: string[];
    },
    now?: Date,
  ): OutcomeType<void> {
    const active = this.requireActive(data.id);
    if (!active.ok) return active;

    const event: DatabaseViewConfigUpdated = {
      type: "DatabaseViewConfigUpdated",
      data: {
        id: data.id,
        filters: data.filters,
        sorts: data.sorts,
        grouping: data.grouping,
        visible_properties: data.visible_properties,
      },
    };

    this.apply(event);
    return Outcome.unit();
  }

  /**
   * Soft-deletes an active database view.
   *
   * @precondition Lifecycle must be Active.
   * @emits DatabaseViewDeleted
   * @throws Never throws — returns Outcome.fail on invalid state.
   */
  delete(
    data: { id: string },
    now?: Date,
  ): OutcomeType<void> {
    const active = this.requireActive(data.id);
    if (!active.ok) return active;

    const event: DatabaseViewDeleted = {
      type: "DatabaseViewDeleted",
      data: { id: data.id },
    };

    this.apply(event);
    return Outcome.unit();
  }

  // ── Private helpers ──────────────────────────────────────────

  private requireActive(viewId: string): OutcomeType<ActiveDatabaseView> {
    if (this.state.lifecycle === "Empty") {
      return Outcome.fail(
        "not_found",
        `View ${viewId} not found.`,
      );
    }
    if (this.state.lifecycle === "Deleted") {
      return Outcome.fail(
        "not_found",
        `View ${viewId} not found.`,
      );
    }
    return Outcome.ok(this.state);
  }
}
