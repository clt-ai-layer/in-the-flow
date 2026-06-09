import { mongoDBInlineProjection, type MongoDBReadEvent } from "@event-driven-io/emmett-mongodb";
import type { DatabaseViewEvent } from "../domain/events.js";

export type DatabaseViewListDocument = {
  id: string;
  database_id: string;
  name: string;
  layout_type: string;
  filters: Record<string, unknown>;
  sorts: unknown[];
  grouping: Record<string, unknown>;
  visible_properties: string[];
};

export const DATABASE_VIEW_LIST_PROJECTION_NAME = "database_view_list";

export const databaseViewListProjection = mongoDBInlineProjection<
  DatabaseViewListDocument,
  DatabaseViewEvent
>({
  name: DATABASE_VIEW_LIST_PROJECTION_NAME,
  schemaVersion: 1,
  canHandle: ["DatabaseViewCreated", "DatabaseViewConfigUpdated", "DatabaseViewDeleted"],
  initialState: (): DatabaseViewListDocument => ({
    id: "",
    database_id: "",
    name: "",
    layout_type: "table",
    filters: {},
    sorts: [],
    grouping: {},
    visible_properties: [],
  }),
  evolve: (
    document: DatabaseViewListDocument,
    event: MongoDBReadEvent<DatabaseViewEvent>,
  ): DatabaseViewListDocument | null => {
    switch (event.type) {
      case "DatabaseViewCreated":
        return {
          id: event.data.id,
          database_id: event.data.database_id,
          name: event.data.name,
          layout_type: event.data.layout_type,
          filters: event.data.filters,
          sorts: event.data.sorts,
          grouping: event.data.grouping,
          visible_properties: event.data.visible_properties,
        };
      case "DatabaseViewConfigUpdated":
        return {
          ...document,
          filters: event.data.filters ?? document.filters,
          sorts: event.data.sorts ?? document.sorts,
          grouping: event.data.grouping ?? document.grouping,
          visible_properties: event.data.visible_properties ?? document.visible_properties,
        };
      case "DatabaseViewDeleted":
        return null;
      default:
        return document;
    }
  },
});
