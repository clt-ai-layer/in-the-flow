import {
  IllegalStateError,
  NotFoundError,
  ValidationError,
} from "@event-driven-io/emmett";
import type { Outcome } from "./Outcome.js";

type FailedOutcome = Extract<Outcome<never>, { ok: false }>;

/**
 * Maps a failed {@link Outcome} to the correct Emmett error class for HTTP middleware.
 *
 * @description No custom codes for concurrency (Emmett throws ConcurrencyError before mapping)
 * or authorization.
 * @throws Always throws — return type is `never`.
 */
export function toEmmettError(outcome: FailedOutcome): never {
  switch (outcome.code) {
    case "not_found":
      throw new NotFoundError({
        id: "",
        type: "Entity",
        message: outcome.message,
      });
    case "validation":
      throw new ValidationError(outcome.message);
    case "illegal":
    default:
      throw new IllegalStateError(outcome.message);
  }
}
