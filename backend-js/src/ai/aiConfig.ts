import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GeminiService } from "@/ai/GeminiService.js";
import { KimiService } from "@/ai/KimiService.js";
import type { AiProvider, AiService } from "@/ai/aiTypes.js";
import { findBackendJsRoot } from "@/platform/pathUtils.js";
import type { SettingsDocument } from "@/settings/projections/settingsProjection.js";

export const DEFAULT_KIMI_MODEL = "kimi-k2.6";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const AI_REQUEST_TIMEOUT_MS = 60_000;

const KIMI_KEY_FILENAME = ".kimi-api-key";
const GEMINI_KEY_FILENAME = ".gemini-api-key";

function readKeyFile(filename: string): string | undefined {
  const packageRoot = findBackendJsRoot();
  if (!packageRoot) {
    return undefined;
  }

  const keyPath = join(packageRoot, filename);
  if (!existsSync(keyPath)) {
    return undefined;
  }

  const line = readFileSync(keyPath, "utf-8").trim().split("\n")[0]?.trim();
  return line && line.length > 0 ? line : undefined;
}

function normalizeProvider(value: string | undefined): AiProvider | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "kimi" || normalized === "gemini") {
    return normalized;
  }
  return undefined;
}

/**
 * Resolves the active AI provider from env (`AI_PROVIDER`) or settings (`ai_provider`).
 * Defaults to Kimi.
 */
export function getAiProvider(settings: SettingsDocument = {}): AiProvider {
  return (
    normalizeProvider(process.env.AI_PROVIDER) ??
    normalizeProvider(settings.ai_provider) ??
    "kimi"
  );
}

/**
 * Resolves the model name for the given provider.
 *
 * Order: `AI_MODEL` → provider-specific env (`KIMI_MODEL` / `GEMINI_MODEL`) → default.
 */
export function getAiModel(provider: AiProvider): string {
  const universal = process.env.AI_MODEL?.trim();
  if (universal) {
    return universal;
  }

  if (provider === "gemini") {
    return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  }

  return process.env.KIMI_MODEL?.trim() || DEFAULT_KIMI_MODEL;
}

/**
 * Resolves the API key for the given provider using settings, env, then file fallback.
 */
export function getApiKey(provider: AiProvider, settings: SettingsDocument = {}): string | undefined {
  if (provider === "gemini") {
    const fromSettings =
      settings.gemini_api_key?.trim() || settings.GEMINI_API_KEY?.trim();
    if (fromSettings) {
      return fromSettings;
    }

    const fromEnv = process.env.GEMINI_API_KEY?.trim();
    if (fromEnv) {
      return fromEnv;
    }

    return readKeyFile(GEMINI_KEY_FILENAME);
  }

  const fromSettings =
    settings.kimi_api_key?.trim() ||
    settings.gemini_api_key?.trim() ||
    settings.GEMINI_API_KEY?.trim();
  if (fromSettings) {
    return fromSettings;
  }

  const fromEnv =
    process.env.KIMI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return readKeyFile(KIMI_KEY_FILENAME);
}

/**
 * Returns true when the active provider has a non-empty API key configured.
 */
export function isAiConfigured(settings: SettingsDocument = {}): boolean {
  const provider = getAiProvider(settings);
  return !!getApiKey(provider, settings);
}

/**
 * Creates the AI service for the resolved provider and model.
 */
export function createAiService(settings: SettingsDocument = {}): AiService {
  const provider = getAiProvider(settings);
  const apiKey = getApiKey(provider, settings);
  const model = getAiModel(provider);

  if (provider === "gemini") {
    return new GeminiService(apiKey, model);
  }

  return new KimiService(apiKey, model);
}

/** @deprecated Use {@link getApiKey} with provider from {@link getAiProvider}. */
export function getKimiApiKey(settings: SettingsDocument = {}): string | undefined {
  return getApiKey(getAiProvider(settings), settings);
}
