export type DatabaseProperty = {
  name: string;
  type: string;
  options?: string[];
  formula_expression?: string;
  relation_property?: string;
  target_property?: string;
  aggregation?: string;
  database_id?: string;
};

export type DatabaseSchema = {
  id: string;
  name: string;
  icon?: string;
  properties: DatabaseProperty[];
};

export type RawDatabaseRecord = {
  id: string;
  database_id: string;
  property_values: string | Record<string, unknown>;
};

export type FilterRule = {
  property: string;
  condition: string;
  value?: unknown;
};

export type FilterGroup = {
  operator?: string;
  rules?: Array<FilterRule | FilterGroup>;
};

export type SortRule = {
  property: string;
  direction?: string;
};

export type GroupingRules = {
  group_by?: string | null;
  subgroup_by?: string | null;
};

export type DatabaseViewConfig = {
  id: string;
  database_id: string;
  name: string;
  layout_type: string;
  filters: FilterGroup;
  sorts: SortRule[];
  grouping: GroupingRules;
  visible_properties: string[];
};

export type ExecuteViewResult = {
  grouped: boolean;
  group_by?: string;
  subgroup_by?: string | null;
  groups?: Record<string, unknown>;
  records: Record<string, unknown>[];
  view_name: string;
  layout_type: string;
  visible_properties: string[];
};
