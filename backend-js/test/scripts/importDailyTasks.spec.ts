import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = join(
  import.meta.dirname,
  "..",
  "..",
  "scripts",
  "import-daily-tasks-from-sqlite.ts",
);

describe("import-daily-tasks-from-sqlite script", () => {
  it("uses runEntity directly (no deleted facades)", () => {
    const source = readFileSync(scriptPath, "utf-8");

    expect(source).toContain("runEntity");
    expect(source).not.toMatch(/executeDailyTaskCommand/);
    expect(source).not.toMatch(/dailyTaskDecider/);
    expect(source).not.toMatch(/dailyTaskCommandHandler/);
  });
});
