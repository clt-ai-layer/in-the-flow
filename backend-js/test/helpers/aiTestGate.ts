import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiLogDocument } from "@/ai/AiLogRepository.js";
import { getAiProvider, getApiKey } from "@/ai/aiConfig.js";
import { tryGetMongoClient } from "@/platform/mongoConfig.js";
import { findBackendJsRoot } from "@/platform/pathUtils.js";
import { getDatabaseName } from "@/platform/mongoUri.js";

const AI_LOGS_COLLECTION = "ai_logs";

const KIMI_KEY_FILENAME = ".kimi-api-key";
const GEMINI_KEY_FILENAME = ".gemini-api-key";

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

function readKeyFile(filename: string): string | undefined {
  const root = findBackendJsRoot();
  if (!root) {
    return undefined;
  }

  const path = join(root, filename);
  if (!existsSync(path)) {
    return undefined;
  }

  const line = readFileSync(path, "utf-8").split("\n")[0]?.trim();
  return line || undefined;
}

/**
 * True when the active provider has an API key from env or key file.
 */
export function hasApiKey(): boolean {
  const provider = getAiProvider();
  if (getApiKey(provider)) {
    return true;
  }

  if (provider === "kimi") {
    return !!readKeyFile(KIMI_KEY_FILENAME);
  }

  return !!readKeyFile(GEMINI_KEY_FILENAME);
}

/**
 * Live AI integration tests run only when explicitly gated.
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
