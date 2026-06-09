import { fromStreamName } from "@event-driven-io/emmett-mongodb";
import { describe, expect, it } from "vitest";
import { EntityRef } from "@/es-kit/domain/EntityRef.js";

describe("EntityRef", () => {
  it("newId generates a plain UUID stream id without prefix", () => {
    const ref = EntityRef.newId("dailyTask");
    expect(ref.streamType).toBe("dailyTask");
    expect(ref.prefix).toBeUndefined();
    expect(ref.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(ref.toStreamName()).toBe(`dailyTask:${ref.id}`);
  });

  it("newId accepts an explicit id", () => {
    const ref = EntityRef.newId("task", "task-123");
    expect(ref.id).toBe("task-123");
    expect(ref.toStreamName()).toBe("task:task-123");
  });

  it("singleton uses global id by default", () => {
    const ref = EntityRef.singleton("settings");
    expect(ref.id).toBe("global");
    expect(ref.toStreamName()).toBe("settings:global");
  });

  it("fromStreamName round-trips plain ids", () => {
    const original = EntityRef.newId("project", "proj-1");
    const parsed = EntityRef.fromStreamName(original.toStreamName());
    expect(parsed.streamType).toBe("project");
    expect(parsed.id).toBe("proj-1");
    expect(parsed.prefix).toBeUndefined();
  });

  it("fromStreamName parses prefixed stream ids", () => {
    const prefixed = new EntityRef("task", "abc", "pfx");
    const parsed = EntityRef.fromStreamName(prefixed.toStreamName());
    expect(parsed.prefix).toBe("pfx");
    expect(parsed.id).toBe("abc");
    expect(fromStreamName(prefixed.toStreamName()).streamId).toBe("pfx_abc");
  });
});
