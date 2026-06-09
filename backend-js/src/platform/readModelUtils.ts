import type { MongoDBReadModel } from "@event-driven-io/emmett-mongodb";

/**
 * Strips MongoDB inline projection metadata before API serialization.
 *
 * @param doc - Read model document from inline projection query.
 * @returns Plain document matching Python REST shape.
 */
export function stripReadModelMetadata<T extends Record<string, unknown>>(
  doc: MongoDBReadModel<T>,
): T {
  const { _metadata: _removed, ...rest } = doc;
  void _removed;
  return rest as unknown as T;
}

/**
 * Maps a list of read models to API-safe documents.
 */
export function stripReadModelListMetadata<T extends Record<string, unknown>>(
  docs: MongoDBReadModel<T>[],
): T[] {
  return docs.map(stripReadModelMetadata);
}

function matchesFieldQuery(
  value: unknown,
  expected: unknown,
): boolean {
  if (
    expected !== null &&
    typeof expected === "object" &&
    !Array.isArray(expected) &&
    ("$gte" in (expected as Record<string, unknown>) ||
      "$lte" in (expected as Record<string, unknown>))
  ) {
    const range = expected as { $gte?: string; $lte?: string };
    const comparable = String(value ?? "");
    if (range.$gte && comparable < range.$gte) {
      return false;
    }
    if (range.$lte && comparable > range.$lte) {
      return false;
    }
    return true;
  }

  return value === expected;
}

/**
 * Applies Mongo-style filter objects to in-memory read models (Vitest / Emmett memory store).
 */
export function filterReadModels<T extends Record<string, unknown>>(
  docs: T[],
  query: Record<string, unknown>,
): T[] {
  if (Object.keys(query).length === 0) {
    return docs;
  }

  return docs.filter((doc) =>
    Object.entries(query).every(([key, expected]) =>
      matchesFieldQuery(doc[key], expected),
    ),
  );
}
