/**
 * JSON-Lines file logger for command executions.
 *
 * @description Writes per-command log files to a configurable directory
 * (default: `InTheFlow/_logs/`). Each command execution produces one
 * `.jsonl` file containing structured log entries.
 *
 * Inspired by execution-scoped logging patterns (e.g. Grafana Loki) — execution-scoped files
 * with buffered, async writes.
 *
 * **Activation**: Set `ENTITY_LOG_FILE_ENABLED=true` environment variable.
 * **Directory**: Set `ENTITY_LOG_DIR` to override the default `_logs/` path.
 *
 * @example File: `_logs/cmd-CreateDailyTask-2026-05-31T19-16-00-abc123.jsonl`
 * ```json
 * {"timestamp":"...","level":"info","message":"Command started","commandId":"abc123","commandType":"CreateDailyTask","entityType":"dailyTask","entityId":"xyz"}
 * {"timestamp":"...","level":"info","message":"Handler routed successfully","eventsEmitted":1}
 * {"timestamp":"...","level":"info","message":"Command completed","durationMs":12.34,"status":"success"}
 * ```
 */
import { mkdir, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CommandContextData } from "./CommandContext.js";

// ── Configuration ───────────────────────────────────────────────

/** Returns `true` if file logging is enabled via env var. */
export function isFileLoggingEnabled(): boolean {
  return process.env.ENTITY_LOG_FILE_ENABLED === "true";
}

/** Resolves the log directory path. Defaults to `_logs/` relative to CWD. */
function getLogDir(): string {
  return process.env.ENTITY_LOG_DIR
    ? resolve(process.env.ENTITY_LOG_DIR)
    : resolve(process.cwd(), "_logs");
}

// ── File naming ─────────────────────────────────────────────────

/**
 * Builds a log filename from context data.
 *
 * @returns e.g. `cmd-CreateDailyTask-2026-05-31T19-16-00-abc123.jsonl`
 */
function buildFileName(ctx: CommandContextData): string {
  const safeTimestamp = ctx.startedAt
    .replace(/:/g, "-")
    .replace(/\.\d+Z$/, "");

  const shortId = ctx.commandId.slice(0, 8);
  return `cmd-${ctx.commandType}-${safeTimestamp}-${shortId}.jsonl`;
}

// ── Writer ──────────────────────────────────────────────────────

let dirEnsured = false;

/**
 * Writes the full command execution context to a JSON-Lines log file.
 *
 * @description Called at the end of command execution (success or failure).
 * Creates the log directory on first write. Writes are async and fire-and-forget
 * — logging failures are caught and printed to stderr.
 *
 * @param ctx - The completed command context with all log entries.
 */
export async function writeCommandLog(ctx: CommandContextData): Promise<void> {
  if (!isFileLoggingEnabled()) return;

  try {
    const dir = getLogDir();

    // Ensure directory exists (once per process)
    if (!dirEnsured) {
      await mkdir(dir, { recursive: true });
      dirEnsured = true;
    }

    const filePath = join(dir, buildFileName(ctx));

    // Build lines: header + log entries + footer
    const lines: string[] = [];

    // Header: command metadata
    lines.push(JSON.stringify({
      timestamp: ctx.startedAt,
      level: "info",
      message: "Command execution started",
      commandId: ctx.commandId,
      commandType: ctx.commandType,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      ...(ctx.enrichment && { enrichment: ctx.enrichment }),
    }));

    // Body: collected log entries
    for (const entry of ctx.logEntries) {
      lines.push(JSON.stringify({
        ...entry,
        commandId: ctx.commandId,
      }));
    }

    // Footer: execution result
    lines.push(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: ctx.status === "failure" ? "error" : "info",
      message: ctx.status === "failure" ? "Command execution failed" : "Command execution completed",
      commandId: ctx.commandId,
      commandType: ctx.commandType,
      status: ctx.status,
      durationMs: ctx.durationMs,
      eventsEmitted: ctx.eventsEmitted,
      ...(ctx.error && { error: ctx.error }),
      ...(ctx.errorStack && { errorStack: ctx.errorStack }),
    }));

    // Write all lines at once (atomic-ish for small payloads)
    await appendFile(filePath, lines.join("\n") + "\n", "utf-8");
  } catch (err) {
    // Never let logging failures crash the command pipeline
    console.error(
      "[CommandFileLogger] Failed to write log file:",
      err instanceof Error ? err.message : err,
    );
  }
}
