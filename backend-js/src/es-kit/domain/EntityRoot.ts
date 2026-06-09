/**
 * Base class for Entity Kit domain entities.
 *
 * @description Implements the Apply pattern (similar to DDD AggregateRoot):
 * - Domain methods validate, then call `apply(event)` to mutate state immediately
 * - `apply()` calls `when()` to fold the event into state, then collects it as uncommitted
 * - The bus pipeline reads `getUncommittedEvents()` after `route()` completes and persists them
 *
 * @example
 * ```typescript
 * class Task extends EntityRoot<TaskState, TaskEvent> {
 *   create(data: CreateData, now?: Date): Outcome<void> {
 *     if (this.state.lifecycle !== "Empty") {
 *       return Outcome.fail("illegal", "Task already exists.");
 *     }
 *     this.apply({ type: "TaskCreated", data: { ... } });
 *     return Outcome.unit();
 *   }
 *
 *   protected when(state: TaskState, event: TaskEvent): TaskState {
 *     switch (event.type) {
 *       case "TaskCreated": return { lifecycle: "Active", ...event.data };
 *       // ...
 *     }
 *   }
 * }
 * ```
 */
export abstract class EntityRoot<
  TState,
  TEvent extends { type: string },
> {
  protected state: TState;
  private readonly _uncommittedEvents: TEvent[] = [];

  protected constructor(state: TState) {
    this.state = state;
  }

  /** Returns the current (mutable) entity state. */
  getState(): TState {
    return this.state;
  }

  /**
   * Applies a domain event: mutates state immediately and collects for persistence.
   *
   * @description Mirrors the classic `AggregateRoot.Apply()`. Call this at the end
   * of domain methods after validation passes. State is available immediately
   * for subsequent logic within the same command.
   */
  protected apply(event: TEvent): void {
    this.state = this.when(this.state, event);
    this._uncommittedEvents.push(event);
  }

  /**
   * Folds one domain event into entity state.
   *
   * @description Equivalent to a DDD `When()` reducer. Must be a pure state transition —
   * no side effects, no validation. Called by both `apply()` (new events) and
   * `replayState()` (historical events).
   */
  protected abstract when(state: TState, event: TEvent): TState;

  /** Returns uncommitted events collected by `apply()`. Read by the bus pipeline. */
  getUncommittedEvents(): ReadonlyArray<TEvent> {
    return this._uncommittedEvents;
  }

  /** Clears uncommitted events after persistence. Called by the bus. */
  clearUncommittedEvents(): void {
    this._uncommittedEvents.length = 0;
  }

  /**
   * Creates an entity instance from a given state.
   *
   * @description Used by the bus to hydrate entities from the event store,
   * and in tests to create entities at a specific state.
   */
  static fromState<
    TEntity extends EntityRoot<TState, TEvent>,
    TState,
    TEvent extends { type: string },
  >(
    this: new (state: TState) => TEntity,
    state: TState,
  ): TEntity {
    return new this(state);
  }
}
