export type DatabaseViewCreated = {
  type: "DatabaseViewCreated";
  data: {
    id: string;
    database_id: string;
    name: string;
    layout_type: string;
    filters: Record<string, unknown>;
    sorts: unknown[];
    grouping: Record<string, unknown>;
    visible_properties: string[];
  };
};

export type DatabaseViewConfigUpdated = {
  type: "DatabaseViewConfigUpdated";
  data: {
    id: string;
    filters?: Record<string, unknown>;
    sorts?: unknown[];
    grouping?: Record<string, unknown>;
    visible_properties?: string[];
  };
};

export type DatabaseViewDeleted = {
  type: "DatabaseViewDeleted";
  data: {
    id: string;
  };
};

export type DatabaseViewEvent =
  | DatabaseViewCreated
  | DatabaseViewConfigUpdated
  | DatabaseViewDeleted;
