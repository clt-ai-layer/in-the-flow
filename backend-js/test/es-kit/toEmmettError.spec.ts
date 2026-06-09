import {
  IllegalStateError,
  NotFoundError,
  ValidationError,
} from "@event-driven-io/emmett";
import { describe, expect, it } from "vitest";
import { Outcome } from "@/es-kit/domain/Outcome.js";
import { toEmmettError } from "@/es-kit/domain/toEmmettError.js";

function fail(code: "not_found" | "validation" | "illegal", message: string) {
  const outcome = Outcome.fail(code, message);
  if (outcome.ok) {
    throw new Error("expected failure outcome");
  }
  return outcome;
}

describe("toEmmettError", () => {
  it("maps not_found to NotFoundError", () => {
    expect(() => toEmmettError(fail("not_found", "Entity missing"))).toThrow(
      NotFoundError,
    );
    try {
      toEmmettError(fail("not_found", "Entity missing"));
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).message).toBe("Entity missing");
    }
  });

  it("maps validation to ValidationError", () => {
    expect(() => toEmmettError(fail("validation", "Bad field"))).toThrow(
      ValidationError,
    );
  });

  it("maps illegal to IllegalStateError", () => {
    expect(() => toEmmettError(fail("illegal", "Already exists"))).toThrow(
      IllegalStateError,
    );
  });
});
