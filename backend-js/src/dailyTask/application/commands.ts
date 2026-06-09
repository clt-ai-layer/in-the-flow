import type { Command } from "@event-driven-io/emmett";
import type { DailyTaskFields } from "../domain/events.js";

export type CreateDailyTask = Command<
  "CreateDailyTask",
  Partial<DailyTaskFields> & {
    id?: string;
    date: string;
    start_time: string;
    end_time: string;
  }
>;

export type UpdateDailyTask = Command<
  "UpdateDailyTask",
  {
    id: string;
    patch: Partial<DailyTaskFields>;
  }
>;

export type DeleteDailyTask = Command<
  "DeleteDailyTask",
  {
    id: string;
  }
>;

export type DailyTaskCommand = CreateDailyTask | UpdateDailyTask | DeleteDailyTask;
