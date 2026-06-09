import { mongoDBInlineProjection, type MongoDBReadEvent } from "@event-driven-io/emmett-mongodb";
import type { ProjectEvent } from "../domain/events.js";

export type ProjectListDocument = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

export const PROJECT_LIST_PROJECTION_NAME = "project_list";

export const projectListProjection = mongoDBInlineProjection<
  ProjectListDocument,
  ProjectEvent
>({
  name: PROJECT_LIST_PROJECTION_NAME,
  schemaVersion: 1,
  canHandle: ["ProjectCreated"],
  initialState: (): ProjectListDocument => ({
    id: "",
    name: "",
    description: null,
    color: "#3B82F6",
    created_at: "",
  }),
  evolve: (
    document: ProjectListDocument,
    event: MongoDBReadEvent<ProjectEvent>,
  ): ProjectListDocument | null => {
    switch (event.type) {
      case "ProjectCreated":
        return {
          id: event.data.id,
          name: event.data.name,
          description: event.data.description,
          color: event.data.color,
          created_at: event.data.created_at,
        };
      default:
        return document;
    }
  },
});
