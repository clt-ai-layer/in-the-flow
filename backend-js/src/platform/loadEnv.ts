import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadEnvFile } from "node:process";

/**
 * Loads `.env` files walking up from {@link startDir} (repo root first, nearest last).
 */
export function loadAppEnv(startDir: string = process.cwd()): void {
  const envPaths: string[] = [];
  let current = startDir;

  while (true) {
    const envPath = join(current, ".env");
    if (existsSync(envPath)) {
      envPaths.push(envPath);
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  for (const envPath of envPaths.reverse()) {
    try {
      loadEnvFile(envPath);
    } catch {
      // Skip unreadable or malformed env files.
    }
  }
}
