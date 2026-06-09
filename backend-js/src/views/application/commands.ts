import type { Command } from "@event-driven-io/emmett";

export type CreateDatabaseView = Command<
  "CreateDatabaseView",
  {
    id?: string;
    database_id: string;
    name: string;
    layout_type: string;
    filters?: Record<string, unknown>;
    sorts?: unknown[];
    grouping?: Record<string, unknown>;
    visible_properties?: string[];
  }
>;

export type UpdateDatabaseViewConfig = Command<
  "UpdateDatabaseViewConfig",
  {
    id: string;
    filters?: Record<string, unknown>;
    sorts?: unknown[];
    grouping?: Record<string, unknown>;
    visible_properties?: string[];
  }
>;

export type DeleteDatabaseView = Command<
  "DeleteDatabaseView",
  {
    id: string;
  }
>;

export type DatabaseViewCommand =
  | CreateDatabaseView
  | UpdateDatabaseViewConfig
  | DeleteDatabaseView;
