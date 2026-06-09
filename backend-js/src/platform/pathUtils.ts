import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const DEFAULT_MONGO_KEY_RELATIVE =
  "Documentation/3-Development/InTheFlow/JsBackend/.mongo-key";

/**
 * Walks up from {@link startDir} to locate the project repository root.
 *
 * @param startDir - Directory to begin the search from (defaults to `process.cwd()`).
 * @returns Absolute path to the repo root, or `null` when not found.
 */
export function findRepoRoot(startDir: string = process.cwd()): string | null {
  let current = startDir;

  while (true) {
    if (existsSync(join(current, DEFAULT_MONGO_KEY_RELATIVE))) {
      return current;
    }

    if (existsSync(join(current, ".git"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

/**
 * Resolves the absolute path to the MongoDB credentials file.
 *
 * @returns Absolute `.mongo-key` path, or `null` when it cannot be resolved.
 */
export function resolveMongoKeyPath(): string | null {
  if (process.env.MONGO_KEY_PATH) {
    const configuredPath = process.env.MONGO_KEY_PATH.trim();
    return configuredPath.length > 0 ? configuredPath : null;
  }

  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    return null;
  }

  return join(repoRoot, DEFAULT_MONGO_KEY_RELATIVE);
}

/**
 * Resolves the backend-js package root (directory containing `package.json`).
 *
 * @param startDir - Directory to begin the search from.
 * @returns Absolute package root path, or `null` when not found.
 */
export function findBackendJsRoot(startDir: string = process.cwd()): string | null {
  let current = startDir;

  while (true) {
    if (existsSync(join(current, "package.json")) && existsSync(join(current, "seed"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}
