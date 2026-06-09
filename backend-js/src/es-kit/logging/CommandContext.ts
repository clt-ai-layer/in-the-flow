/**
 * Per-command async context — propagated via AsyncLocalStorage.
 *
 * @description Wraps each command execution in a scoped context that
 * carries metadata through all async operations. Inspired by DDD
 * `LogContext` + `LogExecutionContext` patterns.
 *
 * Any code in the call chain can read `CommandContext.get()` to access
 * command metadata (commandId, commandType, entityId, timing, etc.)
 * without explicit parameter passing.
 *
 * @example
 * ```typescript
 * // In a middleware:
 * CommandContext.run({ commandId: uuid(), ... }, async () => {
 *   const ctx = CommandContext.get();
 *   console.log(`Executing ${ctx?.commandType}`);
 *   return next();
 * });
 * ```
 */
import { AsyncLocalStorage } from "node:async_hooks";

// ── Context data ────────────────────────────────────────────────

/**
 * Per-command execution context data.
 *
 * @description Set at the start of command execution, enriched during
 * pipeline traversal, and read by loggers/middlewares downstream.
 */
export interface CommandContextData {
  /** Unique ID for this command execution (randomUUID). */
  readonly commandId: string;
  /** The command type string, e.g. `"CreateDailyTask"`. */
  readonly commandType: string;
  /** The entity stream type, e.g. `"dailyTask"`. */
  readonly entityType: string;
  /** The resolved entity/stream ID. */
  readonly entityId: string;
  /** High-res start time via `performance.now()`. */
  readonly startTime: number;
  /** ISO timestamp of execution start. */
  readonly startedAt: string;

  // ── Mutable enrichment (set during execution) ─────────────
  /** Number of events emitted by the handler. */
  eventsEmitted?: number;
  /** Execution duration in milliseconds. */
  durationMs?: number;
  /** Execution outcome. */
  status?: "success" | "failure";
  /** Error message if status is "failure". */
  error?: string;
  /** Stack trace if status is "failure". */
  errorStack?: string;
  /** Handler-specific enrichment (e.g., SKU, projectId). */
  enrichment?: Record<string, string>;

  /** Structured log entries collected during execution. */
  logEntries: LogEntry[];
}

/**
 * A single structured log entry captured within a command execution.
 */
export interface LogEntry {
  /** ISO timestamp. */
  readonly timestamp: string;
  /** Log level. */
  readonly level: "info" | "warn" | "error" | "debug";
  /** Log message. */
  readonly message: string;
  /** Optional structured metadata. */
  readonly meta?: Record<string, unknown>;
}

// ── AsyncLocalStorage singleton ─────────────────────────────────

const storage = new AsyncLocalStorage<CommandContextData>();

/**
 * Per-command execution context using `AsyncLocalStorage`.
 *
 * @description Provides scoped context propagation for command executions.
 * - `run()` — wraps a callback in a new context scope
 * - `get()` — reads the current context from any point in the async chain
 * - `enrich()` — mutates the current context with additional data
 * - `log()` — appends a structured log entry to the context
 *
 * @throws Never throws — `get()` returns `undefined` outside a context.
 */
export class CommandContext {
  /**
   * Runs a callback within a new command context scope.
   *
   * @description All async operations within `fn` will have access to
   * the provided context via `CommandContext.get()`.
   */
  static run<T>(data: CommandContextData, fn: () => T | Promise<T>): T | Promise<T> {
    return storage.run(data, fn);
  }

  /** Returns the current context, or `undefined` if called outside a context scope. */
  static get(): CommandContextData | undefined {
    return storage.getStore();
  }

  /** Returns `true` if currently within a command context scope. */
  static hasContext(): boolean {
    return storage.getStore() !== undefined;
  }

  /**
   * Enriches the current context with additional data.
   *
   * @description Mutates the existing context in-place. No-op if called
   * outside a context scope.
   */
  static enrich(updates: Partial<Omit<CommandContextData, "commandId" | "commandType" | "entityType" | "entityId" | "startTime" | "startedAt" | "logEntries">>): void {
    const ctx = storage.getStore();
    if (!ctx) return;
    Object.assign(ctx, updates);
  }

  /**
   * Appends a structured log entry to the current context.
   *
   * @description Log entries are collected in-memory and flushed to disk
   * (if file logging is enabled) at the end of command execution.
   */
  static log(level: LogEntry["level"], message: string, meta?: Record<string, unknown>): void {
    const ctx = storage.getStore();
    if (!ctx) return;
    ctx.logEntries.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    });
  }

  /**
   * Creates a fresh `CommandContextData` for a new command execution.
   *
   * @description Convenience factory that initializes all required fields.
   */
  static create(params: {
    commandId: string;
    commandType: string;
    entityType: string;
    entityId: string;
  }): CommandContextData {
    return {
      ...params,
      startTime: performance.now(),
      startedAt: new Date().toISOString(),
      logEntries: [],
    };
  }
}
