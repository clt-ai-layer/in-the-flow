import type { Event } from "@event-driven-io/emmett";

// ── Field types (absorbed from fields.ts) ──────────────────────

export type DailyTaskParentFields = {
  parent_task_name: string | null;
  parent_task_grouping: string | null;
  parent_project_id: string | null;
  parent_status: string | null;
  parent_archived: boolean | null;
};

export type DailyTaskScheduleFields = {
  date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  owner: string;
  task_id: string | null;
};

export type DailyTaskFields = DailyTaskScheduleFields & DailyTaskParentFields;

// ── Parent field mapper (used by routes + taskSideEffects) ─────

export const EMPTY_PARENT_FIELDS: DailyTaskParentFields = {
  parent_task_name: null,
  parent_task_grouping: null,
  parent_project_id: null,
  parent_status: null,
  parent_archived: null,
};

/**
 * Maps a task-shaped object to DailyTask parent fields.
 *
 * @description Uses a structural type (not TaskListDocument) so the domain
 * layer has no dependency on the Task module's projection types.
 */
export function parentFieldsFromTask(task: {
  name: string;
  task_grouping: string | null;
  project_id: string | null;
  status: string;
  archived: boolean;
}): DailyTaskParentFields {
  return {
    parent_task_name: task.name,
    parent_task_grouping: task.task_grouping,
    parent_project_id: task.project_id,
    parent_status: task.status,
    parent_archived: task.archived,
  };
}

// ── Event types ────────────────────────────────────────────────

export type DailyTaskCreated = Event<
  "DailyTaskCreated",
  DailyTaskFields & {
    id: string;
    created_at: string;
    updated_at: string;
  }
>;

export type DailyTaskUpdated = Event<
  "DailyTaskUpdated",
  {
    id: string;
    patch: Partial<DailyTaskFields>;
    updated_at: string;
  }
>;

export type DailyTaskDeleted = Event<
  "DailyTaskDeleted",
  {
    id: string;
    deleted_at: string;
  }
>;

export type DailyTaskEvent = DailyTaskCreated | DailyTaskUpdated | DailyTaskDeleted;
