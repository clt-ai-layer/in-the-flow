import { describe, expect, it } from "vitest";
import { DailyTask } from "@/dailyTask/domain/DailyTask.js";
import { DAILY_TASK_PROJECTION_NAME } from "@/dailyTask/projections/dailyTaskProjection.js";
import { Project } from "@/project/domain/Project.js";
import { PROJECT_LIST_PROJECTION_NAME } from "@/project/projections/projectListProjection.js";
import { Settings } from "@/settings/domain/Settings.js";
import { SETTINGS_PROJECTION_NAME } from "@/settings/projections/settingsProjection.js";
import { Task } from "@/task/domain/Task.js";
import { TASK_LIST_PROJECTION_NAME } from "@/task/projections/taskListProjection.js";
import { DATABASE_VIEW_LIST_PROJECTION_NAME } from "@/views/projections/databaseViewListProjection.js";
import { DatabaseView } from "@/views/domain/DatabaseView.js";



/**
 * Central guard for persisted stream types, event types, and projection names.
 * Pilot migration must not alter non-pilot constants.
 */
describe("persistedStrings", () => {
  it("matches locked stream types, event types, and projection names", () => {
    expect({
      streamTypes: {
        task: Task.streamType,
        dailyTask: DailyTask.streamType,
        project: Project.streamType,
        settings: Settings.streamType,
        databaseView: DatabaseView.streamType,
      },
      settingsGlobalStreamId: Settings.GLOBAL_ID,
      eventTypes: {
        task: ["TaskCreated", "TaskUpdated", "TaskDeleted"],
        dailyTask: ["DailyTaskCreated", "DailyTaskUpdated", "DailyTaskDeleted"],
        project: ["ProjectCreated"],
        settings: ["SettingUpserted"],
        databaseView: [
          "DatabaseViewCreated",
          "DatabaseViewConfigUpdated",
          "DatabaseViewDeleted",
        ],
      },
      projectionNames: {
        task: TASK_LIST_PROJECTION_NAME,
        dailyTask: DAILY_TASK_PROJECTION_NAME,
        project: PROJECT_LIST_PROJECTION_NAME,
        settings: SETTINGS_PROJECTION_NAME,
        databaseView: DATABASE_VIEW_LIST_PROJECTION_NAME,
      },
    }).toMatchInlineSnapshot(`
      {
        "eventTypes": {
          "dailyTask": [
            "DailyTaskCreated",
            "DailyTaskUpdated",
            "DailyTaskDeleted",
          ],
          "databaseView": [
            "DatabaseViewCreated",
            "DatabaseViewConfigUpdated",
            "DatabaseViewDeleted",
          ],
          "project": [
            "ProjectCreated",
          ],
          "settings": [
            "SettingUpserted",
          ],
          "task": [
            "TaskCreated",
            "TaskUpdated",
            "TaskDeleted",
          ],
        },
        "projectionNames": {
          "dailyTask": "daily_task",
          "databaseView": "database_view_list",
          "project": "project_list",
          "settings": "settings_map",
          "task": "task_list",
        },
        "settingsGlobalStreamId": "global",
        "streamTypes": {
          "dailyTask": "dailyTask",
          "databaseView": "databaseView",
          "project": "project",
          "settings": "settings",
          "task": "task",
        },
      }
    `);
  });
});
