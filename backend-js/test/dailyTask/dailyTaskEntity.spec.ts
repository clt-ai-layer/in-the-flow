import { describe, expect, it } from "vitest";
import { DailyTask, type DailyTaskState, type ActiveDailyTask } from "@/dailyTask/domain/DailyTask.js";

const now = new Date("2026-05-25T09:00:00.000Z");

const emptyState = DailyTask.initialState;

function createAndGetState(data: Parameters<DailyTask["create"]>[0]): DailyTaskState {
  const entity = DailyTask.fromState(emptyState);
  const outcome = entity.create(data, now);
  expect(outcome.ok).toBe(true);
  return entity.getState();
}

describe("DailyTask entity", () => {
  it("create applies DailyTaskCreated on empty stream", () => {
    const entity = DailyTask.fromState(emptyState);

    const outcome = entity.create(
      {
        id: "dt-1",
        date: "2026-05-25",
        start_time: "09:00",
        end_time: "09:30",
        title: "Focus",
        owner: "Alice",
        task_id: null,
        parent_task_name: null,
        parent_task_grouping: null,
        parent_project_id: null,
        parent_status: null,
        parent_archived: null,
      },
      now,
    );

    expect(outcome.ok).toBe(true);

    const events = entity.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("DailyTaskCreated");

    // State is mutated immediately by apply()
    expect(entity.getState().lifecycle).toBe("Active");
  });

  it("create fails with illegal when stream is not empty", () => {
    const activeState = createAndGetState({
      id: "dt-1",
      date: "2026-05-25",
      start_time: "09:00",
      end_time: "09:30",
      title: null,
      owner: "Alice",
      task_id: null,
      parent_task_name: null,
      parent_task_grouping: null,
      parent_project_id: null,
      parent_status: null,
      parent_archived: null,
    });

    const entity = DailyTask.fromState(activeState);
    const outcome = entity.create(
      {
        id: "dt-2",
        date: "2026-05-25",
        start_time: "09:00",
        end_time: "09:30",
        title: null,
        owner: "Alice",
        task_id: null,
        parent_task_name: null,
        parent_task_grouping: null,
        parent_project_id: null,
        parent_status: null,
        parent_archived: null,
      },
      now,
    );
    expect(outcome).toEqual({
      ok: false,
      code: "illegal",
      message: "Daily task already exists.",
    });
  });

  it("create fails with validation on invalid schedule", () => {
    const entity = DailyTask.fromState(emptyState);
    const outcome = entity.create(
      {
        date: "2026-05-25",
        start_time: "09:07",
        end_time: "09:30",
        title: null,
        owner: "Alice",
        task_id: null,
        parent_task_name: null,
        parent_task_grouping: null,
        parent_project_id: null,
        parent_status: null,
        parent_archived: null,
      },
      now,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("validation");
      expect(outcome.message).toContain("15-minute boundaries");
    }
  });

  it("update fails with not_found on empty stream", () => {
    const entity = DailyTask.fromState(emptyState);
    const outcome = entity.update(
      { id: "missing", patch: { title: "Nope" } },
      now,
    );
    expect(outcome).toEqual({
      ok: false,
      code: "not_found",
      message: "Daily task with ID 'missing' not found.",
    });
  });

  it("update applies DailyTaskUpdated on active entity", () => {
    const activeState = createAndGetState({
      id: "dt-1",
      date: "2026-05-25",
      start_time: "09:00",
      end_time: "09:30",
      title: "Before",
      owner: "Alice",
      task_id: null,
      parent_task_name: null,
      parent_task_grouping: null,
      parent_project_id: null,
      parent_status: null,
      parent_archived: null,
    });

    const entity = DailyTask.fromState(activeState);
    const outcome = entity.update(
      { id: "dt-1", patch: { title: "After" } },
      now,
    );
    expect(outcome.ok).toBe(true);

    const events = entity.getUncommittedEvents();
    expect(events[0]).toMatchObject({
      type: "DailyTaskUpdated",
      data: { id: "dt-1", patch: { title: "After" } },
    });

    // State updated immediately
    expect((entity.getState() as ActiveDailyTask).title).toBe("After");
  });

  it("delete fails with not_found on empty stream", () => {
    const entity = DailyTask.fromState(emptyState);
    const outcome = entity.delete(
      { id: "missing" },
      now,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("not_found");
    }
  });

  it("replayState folds created then deleted lifecycle", () => {
    // Create
    const entity = DailyTask.fromState(emptyState);
    entity.create(
      {
        id: "dt-1",
        date: "2026-05-25",
        start_time: "09:00",
        end_time: "09:30",
        title: null,
        owner: "Alice",
        task_id: null,
        parent_task_name: null,
        parent_task_grouping: null,
        parent_project_id: null,
        parent_status: null,
        parent_archived: null,
      },
      now,
    );

    // Replay the created event via static replayState
    const createdEvent = entity.getUncommittedEvents()[0]!;
    let state = DailyTask.replayState(emptyState, createdEvent);
    expect(state.lifecycle).toBe("Active");

    // Delete
    const entity2 = DailyTask.fromState(state);
    entity2.delete({ id: "dt-1" }, now);

    const deletedEvent = entity2.getUncommittedEvents()[0]!;
    state = DailyTask.replayState(state, deletedEvent);
    expect(state).toEqual({ lifecycle: "Deleted", id: "dt-1" });
  });
});
