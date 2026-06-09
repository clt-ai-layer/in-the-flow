import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findBackendJsRoot } from "@/platform/pathUtils.js";
import type { SettingsDocument } from "@/settings/projections/settingsProjection.js";

const KIMI_KEY_FILENAME = ".kimi-api-key";

/**
 * Reads the Kimi API key from the gitignored fallback file in backend-js root.
 */
function readKeyFile(): string | undefined {
  const packageRoot = findBackendJsRoot();
  if (!packageRoot) {
    return undefined;
  }

  const keyPath = join(packageRoot, KIMI_KEY_FILENAME);
  if (!existsSync(keyPath)) {
    return undefined;
  }

  const line = readFileSync(keyPath, "utf-8").trim().split("\n")[0]?.trim();
  return line && line.length > 0 ? line : undefined;
}

/**
 * Resolves the Kimi API key using settings-first, then env, then file fallback.
 *
 * Order: `gemini_api_key` → `kimi_api_key` → `KIMI_API_KEY` → `GEMINI_API_KEY` → `.kimi-api-key`.
 */
export function getKimiApiKey(settings: SettingsDocument = {}): string | undefined {
  const fromSettings =
    settings.gemini_api_key?.trim() ||
    settings.kimi_api_key?.trim() ||
    settings.GEMINI_API_KEY?.trim();

  if (fromSettings) {
    return fromSettings;
  }

  const fromEnv =
    process.env.KIMI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  return readKeyFile();
}

/**
 * Returns true when any key resolution source yields a non-empty API key.
 */
export function isAiConfigured(settings: SettingsDocument = {}): boolean {
  return !!getKimiApiKey(settings);
}
