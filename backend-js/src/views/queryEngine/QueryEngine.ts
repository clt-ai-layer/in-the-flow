import { evaluateFormula } from "./formulaEvaluator.js";
import type {
  DatabaseProperty,
  DatabaseSchema,
  DatabaseViewConfig,
  ExecuteViewResult,
  FilterGroup,
  FilterRule,
  GroupingRules,
  RawDatabaseRecord,
  SortRule,
} from "./types.js";

function parsePropertyValues(record: RawDatabaseRecord): Record<string, unknown> {
  if (typeof record.property_values === "string") {
    return JSON.parse(record.property_values) as Record<string, unknown>;
  }
  return { ...record.property_values };
}

function isFilterGroup(rule: FilterRule | FilterGroup): rule is FilterGroup {
  return "operator" in rule && Array.isArray((rule as FilterGroup).rules);
}

/**
 * Recursively checks if a record matches nested filter groups.
 */
export function matchesFilter(
  record: Record<string, unknown>,
  filterGroup: FilterGroup,
): boolean {
  if (!filterGroup || !("operator" in filterGroup)) {
    return true;
  }

  const operator = (filterGroup.operator ?? "and").toLowerCase();
  const rules = filterGroup.rules ?? [];

  if (rules.length === 0) {
    return true;
  }

  const results: boolean[] = [];

  for (const rule of rules) {
    if (isFilterGroup(rule)) {
      results.push(matchesFilter(record, rule));
      continue;
    }

    const propName = rule.property;
    const cond = rule.condition ?? "equals";
    const targetVal = rule.value;
    const val = record[propName];

    switch (cond) {
      case "equals":
        results.push(String(val).toLowerCase() === String(targetVal).toLowerCase());
        break;
      case "contains":
        results.push(String(val).toLowerCase().includes(String(targetVal).toLowerCase()));
        break;
      case "starts_with":
        results.push(String(val).toLowerCase().startsWith(String(targetVal).toLowerCase()));
        break;
      case "is_empty":
        results.push(val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0));
        break;
      case "is_not_empty":
        results.push(!(val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)));
        break;
      case "greater_than":
        try {
          results.push(Number(val) > Number(targetVal));
        } catch {
          results.push(false);
        }
        break;
      case "less_than":
        try {
          results.push(Number(val) < Number(targetVal));
        } catch {
          results.push(false);
        }
        break;
      default:
        results.push(true);
    }
  }

  if (operator === "or") {
    return results.some(Boolean);
  }
  return results.every(Boolean);
}

/**
 * Sorts record dicts according to priority list of sort rules.
 */
export function sortRecords(
  records: Record<string, unknown>[],
  sortRules: SortRule[],
): Record<string, unknown>[] {
  if (!sortRules || sortRules.length === 0) {
    return records;
  }

  return [...records].sort((r1, r2) => {
    for (const rule of sortRules) {
      const propName = rule.property;
      const direction = (rule.direction ?? "asc").toLowerCase();

      let v1: unknown = r1[propName];
      let v2: unknown = r2[propName];

      if (v1 === null || v1 === undefined) v1 = "";
      if (v2 === null || v2 === undefined) v2 = "";

      if (v1 !== v2) {
        const cmp = String(v1).localeCompare(String(v2));
        if (direction === "desc") {
          return -cmp;
        }
        return cmp;
      }
    }
    return 0;
  });
}

/**
 * Arranges flat records into structured subgroups based on primary/sub keys.
 */
export function groupRecords(
  records: Record<string, unknown>[],
  groupingRules: GroupingRules,
): Pick<ExecuteViewResult, "grouped" | "group_by" | "subgroup_by" | "groups" | "records"> {
  const groupBy = groupingRules.group_by;
  const subgroupBy = groupingRules.subgroup_by;

  if (!groupBy) {
    return { grouped: false, records };
  }

  const grouped: Record<string, unknown> = {};

  for (const record of records) {
    let gVal: unknown = record[groupBy];
    if (Array.isArray(gVal)) {
      gVal = gVal.length > 0 ? gVal[0] : "None";
    }
    const groupKey = gVal != null ? String(gVal) : "None";

    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }
    (grouped[groupKey] as Record<string, unknown>[]).push(record);
  }

  if (subgroupBy) {
    for (const [gVal, gRecs] of Object.entries(grouped)) {
      const subgrouped: Record<string, unknown> = {};
      for (const record of gRecs as Record<string, unknown>[]) {
        let sgVal: unknown = record[subgroupBy];
        if (Array.isArray(sgVal)) {
          sgVal = sgVal.length > 0 ? sgVal[0] : "None";
        }
        const subKey = sgVal != null ? String(sgVal) : "None";

        if (!subgrouped[subKey]) {
          subgrouped[subKey] = [];
        }
        (subgrouped[subKey] as Record<string, unknown>[]).push(record);
      }
      grouped[gVal] = subgrouped;
    }
  }

  return {
    grouped: true,
    group_by: groupBy,
    subgroup_by: subgroupBy ?? null,
    groups: grouped,
    records: [],
  };
}

/**
 * Rollup stub — returns safe empty values without throwing.
 * Full rollup aggregation deferred to v2.
 */
export function evaluateRollupStub(
  recordValues: Record<string, unknown>,
  prop: DatabaseProperty,
): unknown {
  const aggFunc = prop.aggregation ?? "show_original";
  const relationField = prop.relation_property ?? "";
  const relatedIds = recordValues[relationField];

  const ids = Array.isArray(relatedIds)
    ? relatedIds
    : relatedIds
      ? [relatedIds]
      : [];

  if (ids.length === 0) {
    return aggFunc === "sum" || aggFunc === "average" || aggFunc === "count" ? 0 : "";
  }

  return aggFunc === "count" ? 0 : "";
}

/**
 * Computes formula and rollup properties for a record.
 */
export function evaluateComputedFields(
  recordValues: Record<string, unknown>,
  properties: DatabaseProperty[],
): Record<string, unknown> {
  const computed = { ...recordValues };

  for (const prop of properties) {
    const propName = prop.name;
    const propType = prop.type;

    if (propType === "rollup") {
      computed[propName] = evaluateRollupStub(recordValues, prop);
    } else if (propType === "formula") {
      const formulaExpr = prop.formula_expression ?? "";
      computed[propName] = evaluateFormula(formulaExpr, computed);
    }
  }

  return computed;
}

/**
 * Executes the query engine pipeline for a view configuration.
 *
 * Pure function — no HTTP or database I/O.
 */
export function executeView(
  viewConfig: DatabaseViewConfig,
  records: RawDatabaseRecord[],
  databases: DatabaseSchema[],
): ExecuteViewResult {
  const db = databases.find((d) => d.id === viewConfig.database_id);
  const properties = db?.properties ?? [];

  const computedRecords: Record<string, unknown>[] = [];

  for (const record of records) {
    const vals = parsePropertyValues(record);
    vals.id = record.id;
    computedRecords.push(evaluateComputedFields(vals, properties));
  }

  const filteredRecords = computedRecords.filter((r) => matchesFilter(r, viewConfig.filters));
  const sortedRecords = sortRecords(filteredRecords, viewConfig.sorts);
  const groupedResult = groupRecords(sortedRecords, viewConfig.grouping);

  return {
    ...groupedResult,
    records: groupedResult.grouped ? [] : groupedResult.records,
    view_name: viewConfig.name,
    layout_type: viewConfig.layout_type,
    visible_properties: viewConfig.visible_properties,
  };
}
