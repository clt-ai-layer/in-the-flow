import type { EntityRoot } from "../domain/EntityRoot.js";

/** Extracts the State type from an EntityRoot subclass. */
export type StateOf<T extends EntityRoot<any, any>> =
  T extends EntityRoot<infer S, any> ? S : never;

/** Extracts the Event type from an EntityRoot subclass. */
export type EventOf<T extends EntityRoot<any, any>> =
  T extends EntityRoot<any, infer E> ? E : never;

/**
 * Static shape that Entity classes must expose for the bus to create instances.
 *
 * @description EntityRoot subclasses conform when they expose
 * `streamType`, `initialState`, `fromState()`, and `replayState()` as statics.
 */
export type EntityClass<TEntity extends EntityRoot<any, any>> = {
  readonly streamType: string;
  readonly initialState: StateOf<TEntity>;
  fromState(state: StateOf<TEntity>): TEntity;
  replayState(
    state: StateOf<TEntity>,
    event: EventOf<TEntity>,
  ): StateOf<TEntity>;
};
