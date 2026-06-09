import type { Command } from "@event-driven-io/emmett";

export type CreateProject = Command<
  "CreateProject",
  {
    id?: string;
    name: string;
    description?: string | null;
    color?: string;
  }
>;

export type ProjectCommand = CreateProject;
