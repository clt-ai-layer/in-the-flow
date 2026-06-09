import { randomUUID } from "node:crypto";
import type { Outcome } from "@/es-kit/domain/Outcome.js";
import type {
  IEntityCreateHandler,
  IEntityUpdateHandler,
  IEntityDeleteHandler,
} from "@/es-kit/handlers/IEntityCommandHandler.js";
import { DailyTask } from "../domain/DailyTask.js";
import type {
  CreateDailyTask,
  UpdateDailyTask,
  DeleteDailyTask,
} from "./commands.js";

/**
 * Creates a new DailyTask when lifecycle is Empty.
 *
 * @commandHandler
 * @implements IEntityCreateHandler
 */
export class CreateDailyTaskHandler
  implements IEntityCreateHandler<DailyTask, CreateDailyTask>
{
  readonly commandType = "CreateDailyTask";
  readonly Entity = DailyTask;

  getEntityId(command: CreateDailyTask): string {
    return command.data.id ?? randomUUID();
  }

  route(entity: DailyTask, command: CreateDailyTask): Outcome<void> {
    return entity.create(command.data, command.metadata?.now);
  }
}

/**
 * Patches an existing active DailyTask.
 *
 * @commandHandler
 * @implements IEntityUpdateHandler
 */
export class UpdateDailyTaskHandler
  implements IEntityUpdateHandler<DailyTask, UpdateDailyTask>
{
  readonly commandType = "UpdateDailyTask";
  readonly Entity = DailyTask;

  getEntityId(command: UpdateDailyTask): string {
    return command.data.id;
  }

  route(entity: DailyTask, command: UpdateDailyTask): Outcome<void> {
    return entity.update(command.data, command.metadata?.now);
  }
}

/**
 * Soft-deletes an active DailyTask.
 *
 * @commandHandler
 * @implements IEntityDeleteHandler
 */
export class DeleteDailyTaskHandler
  implements IEntityDeleteHandler<DailyTask, DeleteDailyTask>
{
  readonly commandType = "DeleteDailyTask";
  readonly Entity = DailyTask;

  getEntityId(command: DeleteDailyTask): string {
    return command.data.id;
  }

  route(entity: DailyTask, command: DeleteDailyTask): Outcome<void> {
    return entity.delete(command.data, command.metadata?.now);
  }
}
