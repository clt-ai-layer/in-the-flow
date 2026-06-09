import { getInMemoryEventStore } from "@event-driven-io/emmett";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runEntity } from "@/es-kit/bus/EntityExecutor.js";
import { EntityRef } from "@/es-kit/domain/EntityRef.js";
import { Outcome } from "@/es-kit/domain/Outcome.js";
import { Task, type TaskState } from "@/task/domain/Task.js";
import type { TaskEvent } from "@/task/domain/events.js";

const now = new Date("2026-01-01T00:00:00.000Z");

type CreateTaskCommand = {
  type: "CreateTask";
  data: { id: string; name: string; status: string; category?: string; source?: string };
};

type UpdateTaskCommand = {
  type: "UpdateTask";
  data: { id: string; patch: Record<string, unknown> };
};

type TestCommand = CreateTaskCommand | UpdateTaskCommand;

function buildCreateCommand(taskId = "task-1"): CreateTaskCommand {
  return {
    type: "CreateTask",
    data: {
      id: taskId,
      name: "Test task",
      status: "backlog",
      category: "business",
      source: "user_created",
    },
  };
}

function taskDecide(state: TaskState, command: TestCommand): Outcome<TaskEvent[]> {
  const task = new Task(state);
  let result: Outcome<void>;

  switch (command.type) {
    case "CreateTask":
      result = task.create(command.data, now);
      break;
    case "UpdateTask":
      result = task.update(command.data as { id: string; patch: Record<string, unknown> }, now);
      break;
    default:
      return Outcome.fail("illegal", "Unknown command");
  }

  if (!result.ok) return result as Outcome<never>;
  return Outcome.ok([...task.getUncommittedEvents()]);
}

describe("runEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs with evolve/initialState dispatch", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId(Task.streamType, "task-1");
    const command = buildCreateCommand();

    const result = await runEntity({
      store,
      ref,
      dispatch: {
        decide: (state, cmd) => taskDecide(state, cmd),
        evolve: Task.replayState,
        initialState: Task.initialState,
      },
      command,
    });

    expect(result.newEvents).toHaveLength(1);
    expect(result.newEvents[0]?.type).toBe("TaskCreated");
    expect(result.newState).toMatchObject({
      lifecycle: "Active",
      id: "task-1",
      name: "Test task",
    });
  });

  it("invokes afterCommit with newState, newEvents, and ref", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId(Task.streamType, "task-3");
    const command = buildCreateCommand("task-3");
    const afterCommit = vi.fn();

    await runEntity({
      store,
      ref,
      dispatch: {
        decide: (state, cmd) => taskDecide(state, cmd),
        evolve: Task.replayState,
        initialState: Task.initialState,
      },
      command,
      afterCommit,
    });

    expect(afterCommit).toHaveBeenCalledOnce();
    const ctx = afterCommit.mock.calls[0]?.[0];
    expect(ctx?.ref).toBe(ref);
    expect(ctx?.newEvents[0]?.type).toBe("TaskCreated");
    expect(ctx?.newState).toMatchObject({ lifecycle: "Active", id: "task-3" });
  });

  it("persists events before propagating afterCommit failure", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId(Task.streamType, "task-4");
    const command = buildCreateCommand("task-4");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runEntity({
        store,
        ref,
        dispatch: {
          decide: (state, cmd) => taskDecide(state, cmd),
          evolve: Task.replayState,
          initialState: Task.initialState,
        },
        command,
        afterCommit: async () => {
          throw new Error("side effect failed");
        },
      }),
    ).rejects.toThrow("side effect failed");

    expect(consoleError).toHaveBeenCalledWith(
      "afterCommit failed after events persisted",
      expect.objectContaining({
        streamId: ref.toStreamName(),
        eventTypes: ["TaskCreated"],
      }),
    );

    const updateCommand: UpdateTaskCommand = {
      type: "UpdateTask",
      data: { id: "task-4", patch: { name: "Renamed" } },
    };

    const updateResult = await runEntity({
      store,
      ref,
      dispatch: {
        decide: (state, cmd) => taskDecide(state, cmd),
        evolve: Task.replayState,
        initialState: Task.initialState,
      },
      command: updateCommand,
    });

    expect(updateResult.newEvents[0]?.type).toBe("TaskUpdated");
  });

  it("succeeds without afterCommit", async () => {
    const store = getInMemoryEventStore();
    const ref = EntityRef.newId(Task.streamType, "task-5");
    const command = buildCreateCommand("task-5");

    const result = await runEntity({
      store,
      ref,
      dispatch: {
        decide: (state, cmd) => taskDecide(state, cmd),
        evolve: Task.replayState,
        initialState: Task.initialState,
      },
      command,
    });

    expect(result.newEvents).toHaveLength(1);
    expect(result.newState).toMatchObject({ lifecycle: "Active", id: "task-5" });
  });
});
