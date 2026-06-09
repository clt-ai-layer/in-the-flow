import type { Event, EventStore } from "@event-driven-io/emmett";

/**
 * Context passed to {@link runCommand} after events are persisted.
 */
export type AfterCommitContext<State, StreamEvent extends Event> = {
  /** Aggregate state after the command handle function ran. */
  newState: State;
  /** Events appended to the stream during this command. */
  newEvents: StreamEvent[];
  /** Stream identifier the command targeted. */
  streamId: string;
};

/**
 * Callable returned by Emmett {@link CommandHandler} or passed pre-built to {@link runCommand}.
 */
export type CommandHandlerFn<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
> = (
  store: Store,
  streamId: string,
  handle: (
    state: State,
  ) => StreamEvent | StreamEvent[] | Promise<StreamEvent | StreamEvent[]>,
) => Promise<{ newState: State; newEvents: StreamEvent[] }>;

/**
 * Options for the shared command execution core used by {@link runCommand} and future {@code runEntity}.
 */
export type ExecuteCommandHandlerCoreOptions<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
> = {
  store: Store;
  streamId: string;
  handler: CommandHandlerFn<Store, State, StreamEvent>;
  handle: (
    state: State,
  ) => StreamEvent | StreamEvent[] | Promise<StreamEvent | StreamEvent[]>;
  afterCommit?: (ctx: AfterCommitContext<State, StreamEvent>) => Promise<void> | void;
};

/**
 * Shared execution core: invoke Emmett CommandHandler, optionally run afterCommit side effects.
 *
 * @description Events are persisted before afterCommit runs. If afterCommit throws, the mutation
 * remains on the stream (ADR-002).
 * @throws Rethrows afterCommit errors after structured error logging.
 */
export async function executeCommandHandlerCore<
  Store extends EventStore,
  State,
  StreamEvent extends Event,
>(
  options: ExecuteCommandHandlerCoreOptions<Store, State, StreamEvent>,
): Promise<{ newState: State; newEvents: StreamEvent[] }> {
  const result = await options.handler(
    options.store,
    options.streamId,
    options.handle,
  );

  if (options.afterCommit) {
    try {
      await options.afterCommit({
        newState: result.newState,
        newEvents: result.newEvents,
        streamId: options.streamId,
      });
    } catch (err) {
      const eventTypes = result.newEvents.map((event) => event.type);
      console.error("afterCommit failed after events persisted", {
        streamId: options.streamId,
        eventTypes,
        err,
      });
      throw err;
    }
  }

  return { newState: result.newState, newEvents: result.newEvents };
}
