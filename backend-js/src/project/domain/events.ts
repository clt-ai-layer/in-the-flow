import type { Event } from "@event-driven-io/emmett";

export type ProjectCreated = Event<
  "ProjectCreated",
  {
    id: string;
    name: string;
    description: string | null;
    color: string;
    created_at: string;
  }
>;

export type ProjectEvent = ProjectCreated;
