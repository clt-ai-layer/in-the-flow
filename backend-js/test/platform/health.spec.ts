import { getInMemoryEventStore } from "@event-driven-io/emmett";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, HEALTH_RESPONSE } from "@/platform/app.js";

describe("GET / health endpoint", () => {
  it("returns version 2.0.0 and online status", async () => {
    const app = createApp(getInMemoryEventStore());
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(HEALTH_RESPONSE);
    expect(response.body.version).toBe("2.0.0");
  });
});
