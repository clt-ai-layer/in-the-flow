import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiLogDocument } from "@/ai/AiLogRepository.js";
import { tryGetMongoClient } from "@/platform/mongoConfig.js";
import { findBackendJsRoot } from "@/platform/pathUtils.js";
import { getDatabaseName } from "@/platform/mongoUri.js";

const AI_LOGS_COLLECTION = "ai_logs";

const KIMI_KEY_FILENAME = ".kimi-api-key";

/**
 * Resolves `backend-js/.kimi-api-key` (first non-empty line).
 */
export function resolveKimiKeyPath(): string | null {
  const root = findBackendJsRoot();
  if (!root) {
    return null;
  }

  const path = join(root, KIMI_KEY_FILENAME);
  return existsSync(path) ? path : null;
}

/**
 * True when `KIMI_API_KEY`, `GEMINI_API_KEY`, or `.kimi-api-key` is available.
 */
export function hasApiKey(): boolean {
  const envKey =
    process.env.KIMI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (envKey) {
    return true;
  }

  const path = resolveKimiKeyPath();
  if (!path) {
    return false;
  }

  const line = readFileSync(path, "utf-8").split("\n")[0]?.trim();
  return !!line;
}

/**
 * Live Kimi integration tests run only when explicitly gated.
 */
export function shouldRunAiIntegration(): boolean {
  return process.env.RUN_INTHEFLOW_AI_TESTS === "true" && hasApiKey();
}

/**
 * Reads ai_logs entries for a given action (newest first).
 */
export async function getAiLogsForAction(action: string): Promise<AiLogDocument[]> {
  const client = await tryGetMongoClient();
  if (!client) {
    return [];
  }

  return client
    .db(getDatabaseName())
    .collection<AiLogDocument>(AI_LOGS_COLLECTION)
    .find({ action })
    .sort({ created_at: -1 })
    .toArray();
}

/** Clears all ai_logs documents (test isolation). */
export async function clearAiLogs(): Promise<void> {
  const client = await tryGetMongoClient();
  if (!client) {
    return;
  }

  await client.db(getDatabaseName()).collection(AI_LOGS_COLLECTION).deleteMany({});
}
