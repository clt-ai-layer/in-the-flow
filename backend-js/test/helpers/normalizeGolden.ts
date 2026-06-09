import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_IGNORE_KEYS = new Set([
  "updated_at",
  "created_at",
  "tokens_used",
  "_id",
]);

const FLOAT_TOLERANCE = 1e-6;

/**
 * Deep-sorts object keys for stable golden comparison.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Removes volatile fields and normalizes numbers for fixture comparison.
 */
export function normalizeForGolden(
  value: unknown,
  options?: { ignoreKeys?: Iterable<string> },
): unknown {
  const ignore = new Set([...DEFAULT_IGNORE_KEYS, ...(options?.ignoreKeys ?? [])]);

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForGolden(item, options));
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      if (ignore.has(key)) {
        continue;
      }
      out[key] = normalizeForGolden(record[key], options);
    }

    return out;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.abs(value - Math.round(value)) < FLOAT_TOLERANCE
      ? Math.round(value)
      : Number(value.toFixed(6));
  }

  return value;
}

/**
 * Loads a golden fixture JSON file relative to `test/fixtures/`.
 */
export function loadGoldenFixture(relativePath: string): unknown {
  const helpersDir = dirname(fileURLToPath(import.meta.url));
  const fixturesRoot = join(helpersDir, "..", "fixtures");
  const raw = readFileSync(join(fixturesRoot, relativePath), "utf-8");
  return JSON.parse(raw) as unknown;
}

/**
 * Asserts structural golden: required keys, optional exact values for stable fields.
 */
export function assertMatchesGoldenShape(
  actual: Record<string, unknown>,
  golden: {
    requiredTopLevelKeys?: string[];
    exact?: Record<string, unknown>;
  },
): void {
  for (const key of golden.requiredTopLevelKeys ?? []) {
    if (!(key in actual)) {
      throw new Error(`Golden mismatch: missing key "${key}"`);
    }
  }

  if (golden.exact) {
    for (const [key, expected] of Object.entries(golden.exact)) {
      if (JSON.stringify(actual[key]) !== JSON.stringify(expected)) {
        throw new Error(
          `Golden mismatch for "${key}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual[key])}`,
        );
      }
    }
  }
}
