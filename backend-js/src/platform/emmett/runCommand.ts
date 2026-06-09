import {
  CommandHandler,
  type CommandHandlerOptions,
  type Event,
  type EventStore,
} from "@event-driven-io/emmett";
import {
  executeCommandHandlerCore,
  type AfterCommitContext,
  type CommandHandlerFn,
} from "./executeCommandHandlerCore.js";

export type { AfterCommitContext };

type RunCommandBaseOptions<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
> = {
  store: Store;
  streamId: string;
  /**
   * Per-command handle function, e.g. `(state) => createTask(command, state)`.
   * Typically a single command function — not the aggregate `decide` switch.
   */
  handle: (
    state: State,
  ) => StreamEvent | StreamEvent[] | Promise<StreamEvent | StreamEvent[]>;
  /**
   * Side effects invoked after events are persisted. Routes usually delegate to
   * `dispatchXxxSideEffects(newEvents)` helpers under `integration/`.
   */
  afterCommit?: (ctx: AfterCommitContext<State, StreamEvent>) => Promise<void> | void;
};

/**
 * Runs an Emmett command against a stream and optionally wires afterCommit side effects.
 *
 * @description Minimal functional-path helper for legacy `*Decider.ts` modules. Wraps
 * {@link CommandHandler} with consistent afterCommit orchestration.
 *
 * **HTTP convention (ADR-003):** `newState` is for domain and afterCommit use. HTTP handlers
 * should re-query read-model projections before `res.json()` unless a module explicitly
 * documents that aggregate state equals the HTTP response shape.
 *
 * **afterCommit dispatch:** Pass a thin callback that delegates to module-specific helpers in
 * `integration/` (e.g. `dispatchTaskSideEffects(newEvents)`). No IntegrationRegistry in v1.
 *
 * **Failure policy (ADR-002):** Events persist before afterCommit. If afterCommit throws, this
 * function logs `{ streamId, eventTypes, err }` at error level and rethrows. The stream mutation
 * is not rolled back; Express middleware may return HTTP 500 while the stream remains updated.
 *
 * @returns Persisted command result `{ newState, newEvents }`.
 * @throws Rethrows domain errors from the handle function and afterCommit failures after logging.
 */
export async function runCommand<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
>(
  options: RunCommandBaseOptions<Store, State, StreamEvent> & {
    decider: CommandHandlerOptions<State, StreamEvent>;
  },
): Promise<{ newState: State; newEvents: StreamEvent[] }>;

export async function runCommand<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
>(
  options: RunCommandBaseOptions<Store, State, StreamEvent> & {
    decider: CommandHandlerFn<Store, State, StreamEvent>;
  },
): Promise<{ newState: State; newEvents: StreamEvent[] }>;

export async function runCommand<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
>(
  options: RunCommandBaseOptions<Store, State, StreamEvent> & {
    decider:
      | CommandHandlerOptions<State, StreamEvent>
      | CommandHandlerFn<Store, State, StreamEvent>;
  },
): Promise<{ newState: State; newEvents: StreamEvent[] }> {
  const handler =
    typeof options.decider === "function"
      ? options.decider
      : CommandHandler(options.decider);

  return executeCommandHandlerCore({
    store: options.store,
    streamId: options.streamId,
    handler,
    handle: options.handle,
    afterCommit: options.afterCommit,
  });
}
