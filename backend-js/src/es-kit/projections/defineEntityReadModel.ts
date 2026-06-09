import type { Event } from "@event-driven-io/emmett";
import {
  mongoDBInlineProjection,
  type MongoDBReadEvent,
} from "@event-driven-io/emmett-mongodb";
import type { Document } from "mongodb";

/** Read-model fold callback — test directly without MongoDB when needed. */
export type projectReadModel<Doc, Evt extends Event> = (
  doc: Doc,
  event: MongoDBReadEvent<Evt>,
) => Doc | null;

/**
 * Registers an inline read model using Entity Kit vocabulary.
 *
 * @description Maps `projectReadModel` → Emmett `evolve` internally.
 * Bump `schemaVersion` only on breaking persisted document shape changes.
 */
export function defineEntityReadModel<Doc extends Document, Evt extends Event>(config: {
  name: string;
  schemaVersion: number;
  canHandle: Evt["type"][] | string[];
  initialReadModel: () => Doc;
  projectReadModel: projectReadModel<Doc, Evt>;
}) {
  return mongoDBInlineProjection<Doc, Evt>({
    name: config.name,
    schemaVersion: config.schemaVersion,
    canHandle: config.canHandle,
    initialState: config.initialReadModel,
    evolve: config.projectReadModel,
  });
}
