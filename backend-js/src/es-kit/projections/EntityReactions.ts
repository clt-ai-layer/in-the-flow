import type { Event } from "@event-driven-io/emmett";
import type { EntityRef } from "../domain/EntityRef.js";

/**
 * Entity Kit cross-stream reaction types (v1 — types only).
 *
 * @description Future modules live under per-entity `EntityReactions/` folders
 * (e.g. `OnDailyTaskUpdated.ts`). No runtime registry in v1.
 */
export type EntityReactionContext = {
  ref: EntityRef;
  newEvents: Event[];
};

export type EntityReactionHandler<TEvt extends Event = Event> = (
  event: TEvt,
  ctx: EntityReactionContext,
) => Promise<void> | void;
