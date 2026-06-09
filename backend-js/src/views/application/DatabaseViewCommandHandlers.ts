import { randomUUID } from "node:crypto";
import type {
  IEntityCreateHandler,
  IEntityUpdateHandler,
  IEntityDeleteHandler,
} from "@/es-kit/handlers/IEntityCommandHandler.js";
import type { Outcome } from "@/es-kit/domain/Outcome.js";
import { DatabaseView } from "../domain/DatabaseView.js";
import type {
  CreateDatabaseView,
  UpdateDatabaseViewConfig,
  DeleteDatabaseView,
} from "./commands.js";

/**
 * Handles creation of a new database view.
 *
 * @commandHandler
 * @implements IEntityCreateHandler<DatabaseView, CreateDatabaseView>
 * @workflow Extracts or generates view ID → delegates to entity.create()
 */
export class CreateDatabaseViewHandler
  implements IEntityCreateHandler<DatabaseView, CreateDatabaseView>
{
  readonly commandType = "CreateDatabaseView";
  readonly Entity = DatabaseView;

  getEntityId(command: CreateDatabaseView): string {
    return command.data.id ?? randomUUID();
  }

  route(entity: DatabaseView, command: CreateDatabaseView): Outcome<void> {
    return entity.create(command.data);
  }
}

/**
 * Handles updating the configuration of an existing database view.
 *
 * @commandHandler
 * @implements IEntityUpdateHandler<DatabaseView, UpdateDatabaseViewConfig>
 * @workflow Extracts view ID → delegates to entity.updateConfig()
 */
export class UpdateDatabaseViewConfigHandler
  implements IEntityUpdateHandler<DatabaseView, UpdateDatabaseViewConfig>
{
  readonly commandType = "UpdateDatabaseViewConfig";
  readonly Entity = DatabaseView;

  getEntityId(command: UpdateDatabaseViewConfig): string {
    return command.data.id;
  }

  route(entity: DatabaseView, command: UpdateDatabaseViewConfig): Outcome<void> {
    return entity.updateConfig(command.data);
  }
}

/**
 * Handles deletion of a database view.
 *
 * @commandHandler
 * @implements IEntityDeleteHandler<DatabaseView, DeleteDatabaseView>
 * @workflow Extracts view ID → delegates to entity.delete()
 */
export class DeleteDatabaseViewHandler
  implements IEntityDeleteHandler<DatabaseView, DeleteDatabaseView>
{
  readonly commandType = "DeleteDatabaseView";
  readonly Entity = DatabaseView;

  getEntityId(command: DeleteDatabaseView): string {
    return command.data.id;
  }

  route(entity: DatabaseView, command: DeleteDatabaseView): Outcome<void> {
    return entity.delete(command.data);
  }
}
