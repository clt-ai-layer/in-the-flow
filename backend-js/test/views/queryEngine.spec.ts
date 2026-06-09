import { describe, expect, it } from "vitest";
import { evaluateFormula } from "@/views/queryEngine/formulaEvaluator.js";
import {
  evaluateComputedFields,
  evaluateRollupStub,
  executeView,
  groupRecords,
  matchesFilter,
  sortRecords,
} from "@/views/queryEngine/QueryEngine.js";
import type {
  DatabaseProperty,
  DatabaseSchema,
  DatabaseViewConfig,
  RawDatabaseRecord,
} from "@/views/queryEngine/types.js";
import { TASKS_DATABASE_ID } from "@/views/eavIds.js";

const TASKS_SCHEMA: DatabaseSchema = {
  id: TASKS_DATABASE_ID,
  name: "Tasks Workspace",
  properties: [
    { name: "Name", type: "title" },
    { name: "Estimated Duration", type: "number" },
    { name: "Current Duration", type: "number" },
    {
      name: "Remaining Duration",
      type: "formula",
      formula_expression: "prop('Estimated Duration') - prop('Current Duration')",
    },
    {
      name: "Project Rollup",
      type: "rollup",
      relation_property: "Project",
      target_property: "Name",
      aggregation: "sum",
    },
  ],
};

describe("matchesFilter", () => {
  it("matches equals with case insensitivity", () => {
    const record = { Status: "Backlog", Archived: false };
    const filter = {
      operator: "and",
      rules: [{ property: "Status", condition: "equals", value: "backlog" }],
    };
    expect(matchesFilter(record, filter)).toBe(true);
  });

  it("matches nested or groups", () => {
    const record = { Category: "dev" };
    const filter = {
      operator: "or",
      rules: [
        { property: "Category", condition: "equals", value: "business" },
        { property: "Category", condition: "equals", value: "dev" },
      ],
    };
    expect(matchesFilter(record, filter)).toBe(true);
  });
});

describe("sortRecords", () => {
  it("sorts ascending then descending by priority", () => {
    const records = [
      { Name: "B", Priority: 2 },
      { Name: "A", Priority: 1 },
      { Name: "C", Priority: 2 },
    ];

    const asc = sortRecords(records, [{ property: "Priority", direction: "asc" }, { property: "Name", direction: "asc" }]);
    expect(asc.map((r) => r.Name)).toEqual(["A", "B", "C"]);

    const desc = sortRecords(records, [{ property: "Name", direction: "desc" }]);
    expect(desc.map((r) => r.Name)).toEqual(["C", "B", "A"]);
  });
});

describe("groupRecords", () => {
  it("groups by status and subgroups by task grouping", () => {
    const records = [
      { Status: "backlog", TaskGrouping: "General" },
      { Status: "backlog", TaskGrouping: "AI" },
      { Status: "done", TaskGrouping: "General" },
    ];

    const result = groupRecords(records, { group_by: "Status", subgroup_by: "TaskGrouping" });
    expect(result.grouped).toBe(true);
    expect(result.groups).toBeDefined();
    expect((result.groups!.backlog as Record<string, unknown[]>).General).toHaveLength(1);
  });
});

describe("evaluateFormula", () => {
  it("computes Remaining Duration from seeded formula", () => {
    const values = { "Estimated Duration": 60, "Current Duration": 15 };
    const result = evaluateFormula(
      "prop('Estimated Duration') - prop('Current Duration')",
      values,
    );
    expect(result).toBe(45);
  });
});

describe("evaluateRollupStub", () => {
  it("returns safe empty values without throwing", () => {
    const prop: DatabaseProperty = {
      name: "Rollup",
      type: "rollup",
      relation_property: "Project",
      target_property: "Name",
      aggregation: "sum",
    };

    expect(evaluateRollupStub({ Project: [] }, prop)).toBe(0);
    expect(evaluateRollupStub({ Project: ["p1"] }, prop)).toBe("");
  });
});

describe("executeView", () => {
  it("returns grouped board result with formula columns", () => {
    const viewConfig: DatabaseViewConfig = {
      id: "view-1",
      database_id: TASKS_DATABASE_ID,
      name: "Sprint Board",
      layout_type: "board",
      filters: {
        operator: "and",
        rules: [{ property: "Archived", condition: "equals", value: "false" }],
      },
      sorts: [],
      grouping: { group_by: "Status", subgroup_by: null },
      visible_properties: ["Name", "Remaining Duration"],
    };

    const records: RawDatabaseRecord[] = [
      {
        id: "task-1",
        database_id: TASKS_DATABASE_ID,
        property_values: {
          Name: "Task A",
          Status: "backlog",
          "Estimated Duration": 60,
          "Current Duration": 10,
          Archived: false,
        },
      },
      {
        id: "task-2",
        database_id: TASKS_DATABASE_ID,
        property_values: {
          Name: "Task B",
          Status: "done",
          "Estimated Duration": 30,
          "Current Duration": 30,
          Archived: false,
        },
      },
    ];

    const result = executeView(viewConfig, records, [TASKS_SCHEMA]);

    expect(result.grouped).toBe(true);
    expect(result.view_name).toBe("Sprint Board");
    expect(result.visible_properties).toEqual(["Name", "Remaining Duration"]);
    expect(result.groups).toBeDefined();

    const backlogGroup = result.groups!.backlog as Record<string, unknown>[];
    expect(backlogGroup[0]["Remaining Duration"]).toBe(50);
  });

  it("evaluates computed fields including rollup stub", () => {
    const computed = evaluateComputedFields(
      { Project: [], "Estimated Duration": 10, "Current Duration": 3 },
      TASKS_SCHEMA.properties,
    );
    expect(computed["Remaining Duration"]).toBe(7);
    expect(computed["Project Rollup"]).toBe(0);
  });
});
