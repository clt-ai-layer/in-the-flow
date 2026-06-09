import { describe, expect, it } from "vitest";
import { Outcome } from "@/es-kit/domain/Outcome.js";

describe("Outcome", () => {
  it("Outcome.ok wraps a value", () => {
    const outcome = Outcome.ok(42);
    expect(outcome).toEqual({ ok: true, value: 42 });
  });

  it("Outcome.fail carries code and message", () => {
    const outcome = Outcome.fail("validation", "Invalid cron expression");
    expect(outcome).toEqual({
      ok: false,
      code: "validation",
      message: "Invalid cron expression",
    });
  });
});
