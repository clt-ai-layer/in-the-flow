import { randomUUID } from "node:crypto";
import type { IEntityCreateHandler } from "@/es-kit/handlers/IEntityCommandHandler.js";
import type { Outcome } from "@/es-kit/domain/Outcome.js";
import { Project } from "../domain/Project.js";
import type { CreateProject } from "./commands.js";

/**
 * Creates a new Project when lifecycle is Empty.
 *
 * @commandHandler
 * @implements IEntityCreateHandler — entity ID defaults to a new UUID if not provided.
 * @workflow Extracts id from command data (or generates), delegates to entity.create().
 */
export class CreateProjectHandler implements IEntityCreateHandler<Project, CreateProject> {
  readonly commandType = "CreateProject";
  readonly Entity = Project;

  getEntityId(command: CreateProject): string {
    return command.data.id ?? randomUUID();
  }

  route(entity: Project, command: CreateProject): Outcome<void> {
    return entity.create(command.data, command.metadata?.now);
  }
}
