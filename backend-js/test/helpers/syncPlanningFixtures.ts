import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Active planning file name written by {@link writePlanningFixture}. */
export const CURRENT_PLANNING_FILE_NAME = "Current_Planning_Test-Fixture.md";

/** Checklist line with done status — used by archive specs (Scenario 19). */
export const FIXTURE_DONE_CHECKBOX =
  "- [x] Ⓑ **Completed fixture task**: Done row for archive test.";

const helpersDir = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(helpersDir, "..", "fixtures", "sync-planning");

export type SyncPlanningFixtureName =
  | "baseline-week"
  | "modified-week"
  | "done-checkbox-week";

/**
 * Loads committed sync-planning markdown from `test/fixtures/sync-planning/`.
 */
export function loadSyncPlanningFixture(name: SyncPlanningFixtureName): string {
  return readFileSync(join(FIXTURES_ROOT, `${name}.md`), "utf-8");
}

/** Baseline markdown — stable content for hash-skip tests (acceptance #13). */
export const FIXTURE_BASELINE_MARKDOWN = loadSyncPlanningFixture("baseline-week");

/** Modified markdown — adds/changes rows for success tests (acceptance #14). */
export const FIXTURE_CHANGED_MARKDOWN = loadSyncPlanningFixture("modified-week");

/** Markdown with done checkbox rows for archive tests (Scenario 19). */
export const FIXTURE_DONE_MARKDOWN = loadSyncPlanningFixture("done-checkbox-week");

/**
 * SHA-256 hex digest of file content — matches `syncService.ts` hash logic.
 */
export function computeFileHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/** Deterministic hash of {@link FIXTURE_BASELINE_MARKDOWN} for skip-path seeding. */
export const FIXTURE_UNCHANGED_HASH = computeFileHash(FIXTURE_BASELINE_MARKDOWN);

/**
 * Writes planning markdown into `dir` as the active `Current_Planning_*.md` file.
 *
 * @returns Absolute path to the written file.
 */
export function writePlanningFixture(dir: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, CURRENT_PLANNING_FILE_NAME);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/** Path to committed sync-planning fixture directory. */
export function getSyncPlanningFixturesDir(): string {
  return FIXTURES_ROOT;
}
