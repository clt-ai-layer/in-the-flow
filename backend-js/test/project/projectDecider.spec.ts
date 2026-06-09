import { describe, expect, it } from "vitest";
import { Project } from "@/project/domain/Project.js";

const now = new Date("2026-01-01T00:00:00.000Z");

describe("Project Entity", () => {
  it("creates a project with defaults", () => {
    const project = new Project(Project.initialState);
    const result = project.create(
      {
        id: "proj-1",
        name: "Sample Project",
        description: "Main project",
      },
      now,
    );

    expect(result.ok).toBe(true);
    expect(project.getState()).toMatchObject({
      lifecycle: "Active",
      id: "proj-1",
      name: "Sample Project",
      description: "Main project",
      color: "#3B82F6",
      created_at: now.toISOString(),
    });

    const uncommitted = project.getUncommittedEvents();
    expect(uncommitted).toHaveLength(1);
    expect(uncommitted[0]).toMatchObject({
      type: "ProjectCreated",
      data: {
        id: "proj-1",
        name: "Sample Project",
        description: "Main project",
        color: "#3B82F6",
        created_at: now.toISOString(),
      },
    });
  });

  it("rejects create when stream already has a project", () => {
    const project = new Project(Project.initialState);
    project.create({ id: "proj-1", name: "Sample Project" }, now);

    const result = project.create(
      { id: "proj-2", name: "Duplicate attempt" },
      now,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("illegal");
      expect(result.message).toContain("already exists");
    }
  });
});
