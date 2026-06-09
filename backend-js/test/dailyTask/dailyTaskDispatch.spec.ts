import { DeciderSpecification } from "@event-driven-io/emmett";
import { describe, expect, it } from "vitest";
import { toEmmettError } from "@/es-kit/domain/toEmmettError.js";
import type { CreateDailyTask, DailyTaskCommand } from "@/dailyTask/application/commands.js";
import { DailyTask, type DailyTaskState } from "@/dailyTask/domain/DailyTask.js";
import type { DailyTaskEvent } from "@/dailyTask/domain/events.js";

const now = new Date("2026-05-25T09:00:00.000Z");

/**
 * Adapts Apply-pattern entity to Emmett DeciderSpecification (command-first decide).
 * Entity.create/update/delete now return Outcome<void> and apply events internally.
 */
function decide(command: DailyTaskCommand, state: DailyTaskState): DailyTaskEvent {
  const entity = DailyTask.fromState(state);
  let outcome: ReturnType<typeof entity.create>;

  switch (command.type) {
    case "CreateDailyTask":
      outcome = entity.create(command.data, command.metadata?.now);
      break;
    case "UpdateDailyTask":
      outcome = entity.update(command.data, command.metadata?.now);
      break;
    case "DeleteDailyTask":
      outcome = entity.delete(command.data, command.metadata?.now);
      break;
  }

  if (!outcome.ok) {
    toEmmettError(outcome);
  }
  // Events are now inside the entity, not in the outcome
  return entity.getUncommittedEvents()[0]! as DailyTaskEvent;
}

const initialState = (): DailyTaskState => DailyTask.initialState;
const evolve = DailyTask.replayState;

const given = DeciderSpecification.for({ decide, evolve, initialState });

describe("DailyTaskDispatch", () => {
  it("creates a daily task with valid schedule", () => {
    const entity = DailyTask.fromState(DailyTask.initialState);

    const outcome = entity.create(
      {
        id: "dt-1",
        date: "2026-05-25",
        start_time: "09:00",
        end_time: "09:30",
        title: "Focus block",
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
    const event = events[0]!;
    expect(event.type).toBe("DailyTaskCreated");
    expect(event.data).toMatchObject({
      id: "dt-1",
      date: "2026-05-25",
      start_time: "09:00",
      end_time: "09:30",
      title: "Focus block",
      owner: "Alice",
      task_id: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  });

  it("rejects schedule with 09:07 start_time", () => {
    const command: CreateDailyTask = {
      type: "CreateDailyTask",
      data: {
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
      metadata: { now },
    };

    given([])
      .when(command)
      .thenThrows((error: Error) =>
        error.message.includes("start_time '09:07' must align to 15-minute boundaries."),
      );
  });
});
