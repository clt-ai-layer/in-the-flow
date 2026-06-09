import { randomUUID } from "node:crypto";
import type {
  IEntityCreateHandler,
  IEntityUpdateHandler,
  IEntityDeleteHandler,
} from "@/es-kit/handlers/IEntityCommandHandler.js";
import type { Outcome } from "@/es-kit/domain/Outcome.js";
import { Task } from "../domain/Task.js";
import type { CreateTask, UpdateTask, DeleteTask } from "./commands.js";

/**
 * Creates a new Task when lifecycle is Empty.
 *
 * @commandHandler
 * @implements IEntityCreateHandler
 */
export class CreateTaskHandler
  implements IEntityCreateHandler<Task, CreateTask>
{
  readonly commandType = "CreateTask";
  readonly Entity = Task;

  getEntityId(command: CreateTask): string {
    return command.data.id ?? randomUUID();
  }

  route(entity: Task, command: CreateTask): Outcome<void> {
    return entity.create(command.data, command.metadata?.now);
  }
}

/**
 * Patches an existing active Task.
 *
 * @commandHandler
 * @implements IEntityUpdateHandler
 */
export class UpdateTaskHandler
  implements IEntityUpdateHandler<Task, UpdateTask>
{
  readonly commandType = "UpdateTask";
  readonly Entity = Task;

  getEntityId(command: UpdateTask): string {
    return command.data.id;
  }

  route(entity: Task, command: UpdateTask): Outcome<void> {
    return entity.update(command.data, command.metadata?.now);
  }
}

/**
 * Soft-deletes an active Task.
 *
 * @commandHandler
 * @implements IEntityDeleteHandler
 */
export class DeleteTaskHandler
  implements IEntityDeleteHandler<Task, DeleteTask>
{
  readonly commandType = "DeleteTask";
  readonly Entity = Task;

  getEntityId(command: DeleteTask): string {
    return command.data.id;
  }

  route(entity: Task, command: DeleteTask): Outcome<void> {
    return entity.delete(command.data, command.metadata?.now);
  }
}
