import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const backendRoot = join(import.meta.dirname, "..", "..");
const dailyTaskSrcRoot = join(backendRoot, "src", "dailyTask");
const dailyTaskTestRoot = join(backendRoot, "test", "dailyTask");

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("DailyTask decider removal regression", () => {
  it("does not include dailyTaskDecider source or spec files", () => {
    expect(existsSync(join(dailyTaskSrcRoot, "domain", "dailyTaskDecider.ts"))).toBe(false);
    expect(existsSync(join(dailyTaskTestRoot, "dailyTaskDecider.spec.ts"))).toBe(false);
  });

  it("does not import dailyTaskDecider under src/dailyTask", () => {
    const forbidden = /dailyTaskDecider/;
    const offenders = collectSourceFiles(dailyTaskSrcRoot).filter((filePath) =>
      forbidden.test(readFileSync(filePath, "utf-8")),
    );

    expect(offenders).toEqual([]);
  });
});
