import { readFileSync } from "node:fs";
import { resolveMongoKeyPath } from "./pathUtils.js";

const SETUP_MESSAGE =
  "MongoDB connection not configured. Set MONGODB_URI (or MONGO_URI), or create " +
  "Documentation/3-Development/InTheFlow/JsBackend/.mongo-key with your connection string. " +
  "See InTheFlow/backend-js/README.md for setup instructions.";

/**
 * Resolves the MongoDB connection string from environment or `.mongo-key`.
 *
 * @returns Trimmed MongoDB URI.
 * @throws Error When no URI can be resolved.
 */
export function resolveMongoUri(): string {
  const envUri =
    process.env.MONGODB_URI?.trim() || process.env.MONGO_URI?.trim();
  if (envUri) {
    return envUri;
  }

  const keyPath = resolveMongoKeyPath();
  if (!keyPath) {
    throw new Error(SETUP_MESSAGE);
  }

  try {
    const fileUri = readFileSync(keyPath, "utf-8").trim();
    if (!fileUri) {
      throw new Error(SETUP_MESSAGE);
    }

    return fileUri;
  } catch (error) {
    if (error instanceof Error && error.message === SETUP_MESSAGE) {
      throw error;
    }

    throw new Error(SETUP_MESSAGE);
  }
}

/**
 * Returns the MongoDB database name for the current runtime context.
 *
 * @returns Database name (`intheflow_dev`, `intheflow_test`, or override).
 */
export function getDatabaseName(): string {
  const override = process.env.MONGODB_DB_NAME?.trim();
  if (override) {
    return override;
  }

  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return "intheflow_test";
  }

  return "intheflow_dev";
}

export { SETUP_MESSAGE as MONGO_SETUP_MESSAGE };
