import { IllegalStateError, NotFoundError, ValidationError } from "@event-driven-io/emmett";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  mapErrorToFastApiResponse,
  mapIllegalStateStatus,
} from "@/platform/fastApiErrorMiddleware.js";

describe("mapIllegalStateStatus", () => {
  it("maps not-found messages to 404", () => {
    expect(mapIllegalStateStatus("Task not found")).toBe(404);
  });

  it("maps invalid status messages to 422", () => {
    expect(mapIllegalStateStatus("Invalid task status 'x'")).toBe(422);
  });

  it("defaults other illegal states to 400", () => {
    expect(mapIllegalStateStatus("Operation not allowed")).toBe(400);
  });
});

describe("mapErrorToFastApiResponse", () => {
  it("maps Zod validation errors to 422 with detail", () => {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse({ name: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const result = mapErrorToFastApiResponse(parsed.error);
      expect(result.status).toBe(422);
      expect(result.body.detail).toContain("name");
    }
  });

  it("maps NotFoundError to 404", () => {
    const result = mapErrorToFastApiResponse(
      new NotFoundError({ id: "p1", type: "Project", message: "Project not found" }),
    );
    expect(result).toEqual({ status: 404, body: { detail: "Project not found" } });
  });

  it("maps ValidationError to 422", () => {
    const result = mapErrorToFastApiResponse(new ValidationError("Bad request"));
    expect(result).toEqual({ status: 422, body: { detail: "Bad request" } });
  });

  it("maps IllegalStateError using heuristics", () => {
    const result = mapErrorToFastApiResponse(
      new IllegalStateError("Invalid task status 'wip'"),
    );
    expect(result.status).toBe(422);
    expect(result.body.detail).toBe("Invalid task status 'wip'");
  });

  it("maps unknown errors to 500", () => {
    const result = mapErrorToFastApiResponse(new Error("boom"));
    expect(result.status).toBe(500);
    expect(result.body.detail).toBe("boom");
  });
});
