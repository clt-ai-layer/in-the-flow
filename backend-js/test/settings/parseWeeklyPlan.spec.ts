import { describe, expect, it } from "vitest";
import { parseWeeklyPlan } from "@/settings/syncPlanning/parseWeeklyPlan.js";

const CHECKLIST_HEADER = `### Week: 2026-W21

#### Business
`;

describe("parseWeeklyPlan", () => {
  it("extracts_checkbox_rows_with_status", () => {
    const content = `${CHECKLIST_HEADER}
- [ ] Ⓑ **Todo**: Work item description
- [x] Ⓑ **Done**: Completed item
`;

    const tasks = parseWeeklyPlan(content);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      name: "Todo",
      status: "backlog",
      category: "business",
      owner: "Alice",
      description: "Owner: Alice | Work item description",
    });
    expect(tasks[1]).toMatchObject({
      name: "Done",
      status: "done",
      category: "business",
      owner: "Alice",
      description: "Owner: Alice | Completed item",
    });
  });

  it("ignores_non_task_lines", () => {
    const content = `# Planning Document

This is prose with no checklist section.

## Notes

More text without checkbox tasks.
`;

    expect(parseWeeklyPlan(content)).toEqual([]);
  });

  it("parses_estimated_duration_when_present", () => {
    const content = `${CHECKLIST_HEADER}
- [ ] Ⓑ **Timed task**: estimate (30m) for review
`;

    const tasks = parseWeeklyPlan(content);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toContain("(30m)");
    expect(tasks[0].name).toBe("Timed task");
  });

  it("handles_empty_file", () => {
    expect(parseWeeklyPlan("")).toEqual([]);
  });
});
