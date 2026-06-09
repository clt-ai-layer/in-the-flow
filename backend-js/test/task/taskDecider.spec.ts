import { describe, expect, it } from "vitest";
import { Task } from "@/task/domain/Task.js";

const now = new Date("2026-01-01T00:00:00.000Z");

/** Helper: creates a Task entity in Active state for update/delete tests. */
function givenActiveTask(
  id = "task-1",
  name = "Original",
  status = "backlog",
): Task {
  const task = new Task(Task.initialState);
  const result = task.create({ id, name, status }, now);
  expect(result.ok).toBe(true);
  return task;
}

describe("Task Entity", () => {
  it("creates a task with server-assigned id", () => {
    const task = new Task(Task.initialState);
    const result = task.create(
      {
        id: "task-1",
        name: "Test task",
        status: "backlog",
        category: "business",
        source: "user_created",
      },
      now,
    );

    expect(result.ok).toBe(true);
    expect(task.getState()).toMatchObject({
      lifecycle: "Active",
      id: "task-1",
      name: "Test task",
      description: null,
      status: "backlog",
      category: "business",
      source: "user_created",
      owner: "Alice",
      task_grouping: "General",
      archived: false,
      estimated_duration: null,
      current_duration: 0,
      project_id: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    expect(task.getUncommittedEvents()).toHaveLength(1);
    expect(task.getUncommittedEvents()[0]?.type).toBe("TaskCreated");
  });

  it("rejects invalid status on create", () => {
    const task = new Task(Task.initialState);
    const result = task.create(
      {
        name: "Bad status task",
        status: "invalid_status",
      },
      now,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.message).toContain("Invalid task status");
    }
  });

  it("updates task with partial merge", () => {
    const task = givenActiveTask();
    const updateNow = new Date("2026-01-02T00:00:00.000Z");

    const result = task.update(
      { id: "task-1", patch: { name: "Renamed" } },
      updateNow,
    );

    expect(result.ok).toBe(true);
    expect(task.getState()).toMatchObject({
      lifecycle: "Active",
      name: "Renamed",
    });

    const uncommitted = task.getUncommittedEvents();
    // 1 from create + 1 from update
    expect(uncommitted).toHaveLength(2);
    expect(uncommitted[1]).toMatchObject({
      type: "TaskUpdated",
      data: {
        id: "task-1",
        patch: { name: "Renamed" },
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("deletes an existing task", () => {
    const task = givenActiveTask("task-1", "To delete");
    const deleteNow = new Date("2026-01-03T00:00:00.000Z");

    const result = task.delete({ id: "task-1" }, deleteNow);

    expect(result.ok).toBe(true);
    expect(task.getState()).toMatchObject({
      lifecycle: "Deleted",
      id: "task-1",
    });

    const uncommitted = task.getUncommittedEvents();
    // 1 from create + 1 from delete
    expect(uncommitted).toHaveLength(2);
    expect(uncommitted[1]).toMatchObject({
      type: "TaskDeleted",
      data: {
        id: "task-1",
        deleted_at: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("rejects update on non-existent task", () => {
    const task = new Task(Task.initialState);

    const result = task.update(
      { id: "missing", patch: { name: "Nope" } },
      now,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_found");
      expect(result.message).toContain("not found");
    }
  });
});
