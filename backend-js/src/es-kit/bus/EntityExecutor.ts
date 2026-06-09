import {
  CommandHandler,
  type Event,
  type EventStore,
} from "@event-driven-io/emmett";
import { executeCommandHandlerCore } from "@/platform/emmett/executeCommandHandlerCore.js";
import type { EntityRef } from "../domain/EntityRef.js";
import type { Outcome } from "../domain/Outcome.js";
import { toEmmettError } from "../domain/toEmmettError.js";

export type EntityExecutorOptions<
  Store extends EventStore,
  TState,
  TEvent extends Event,
  TCommand,
> = {
  store: Store;
  ref: EntityRef;
  dispatch: {
    decide: (state: TState, command: TCommand) => Outcome<TEvent[]>;
    evolve: (state: TState, event: TEvent) => TState;
    initialState: TState | (() => TState);
  };
  command: TCommand;
  afterCommit?: (ctx: {
    ref: EntityRef;
    newState: TState;
    newEvents: TEvent[];
  }) => Promise<void> | void;
};

/**
 * Runs an Entity Kit command against a stream.
 *
 * @description On {@link Outcome.fail}, throws via {@link toEmmettError} before append.
 * Events persist before afterCommit (ADR-002). Shared execution core with {@link runCommand}.
 */
export async function runEntity<
  Store extends EventStore,
  TState,
  TEvent extends Event,
  TCommand,
>(
  options: EntityExecutorOptions<Store, TState, TEvent, TCommand>,
): Promise<{ newState: TState; newEvents: TEvent[] }> {
  const configured = options.dispatch.initialState;
  const initialState: () => TState =
    typeof configured === "function"
      ? (configured as () => TState)
      : () => configured as TState;

  const handler = CommandHandler({
    evolve: options.dispatch.evolve,
    initialState,
  });

  return executeCommandHandlerCore({
    store: options.store,
    streamId: options.ref.toStreamName(),
    handler,
    handle: (state) => {
      const outcome = options.dispatch.decide(state, options.command);
      if (!outcome.ok) {
        toEmmettError(outcome);
      }
      return outcome.value;
    },
    afterCommit: options.afterCommit
      ? (ctx) =>
          options.afterCommit!({
            ref: options.ref,
            newState: ctx.newState,
            newEvents: ctx.newEvents,
          })
      : undefined,
  });
}
