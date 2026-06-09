import type { EventStore } from "@event-driven-io/emmett";
import type { MongoDBEventStore } from "@event-driven-io/emmett-mongodb";
import { toStreamName } from "@event-driven-io/emmett-mongodb";
import { getMongoClient } from "@/platform/mongoConfig.js";
import { registerSeedPhase } from "@/platform/seedService.js";
import { EntityCommandBus } from "@/es-kit/bus/EntityCommandBus.js";
import { Project } from "@/project/domain/Project.js";
import { PROJECT_LIST_PROJECTION_NAME } from "@/project/projections/projectListProjection.js";
import type { ProjectListDocument } from "@/project/projections/projectListProjection.js";
import { Task } from "@/task/domain/Task.js";
import { TASK_LIST_PROJECTION_NAME } from "@/task/projections/taskListProjection.js";
import type { TaskListDocument } from "@/task/projections/taskListProjection.js";
import { TASKS_DATABASE_ID, VIEW_IDS } from "@/views/eavIds.js";
import { DatabaseView } from "@/views/domain/DatabaseView.js";
import type { CreateDatabaseView, UpdateDatabaseViewConfig } from "@/views/application/commands.js";
import {
  CreateDatabaseViewHandler,
  UpdateDatabaseViewConfigHandler,
} from "@/views/application/DatabaseViewCommandHandlers.js";
import type { DatabaseViewListDocument } from "@/views/projections/databaseViewListProjection.js";
import { DATABASE_VIEW_LIST_PROJECTION_NAME } from "@/views/projections/databaseViewListProjection.js";
import { upsertProjectRecord } from "@/views/projections/projectRecordProjection.js";
import { upsertTaskRecord } from "@/views/projections/taskRecordProjection.js";

const VISIBLE_PROPERTIES = [
  "Name",
  "Status",
  "Category",
  "Owner",
  "TaskGrouping",
  "Project",
  "Remaining Duration",
];

const AI_FLOW_VISIBLE = [
  "Name",
  "Status",
  "Category",
  "Owner",
  "TaskGrouping",
  "Remaining Duration",
];

const ARCHIVED_FALSE_FILTER = {
  operator: "and",
  rules: [{ property: "Archived", condition: "equals", value: "false" }],
};

const ARCHIVED_TRUE_FILTER = {
  operator: "and",
  rules: [{ property: "Archived", condition: "equals", value: "true" }],
};

const SPRINT_BOARD_GROUPING = {
  group_by: "Status",
  subgroup_by: "TaskGrouping",
};

const SEEDED_VIEWS: CreateDatabaseView["data"][] = [
  {
    id: VIEW_IDS.sprintBoard,
    database_id: TASKS_DATABASE_ID,
    name: "Sprint Board",
    layout_type: "board",
    grouping: SPRINT_BOARD_GROUPING,
    filters: ARCHIVED_FALSE_FILTER,
    sorts: [],
    visible_properties: VISIBLE_PROPERTIES,
  },
  {
    id: VIEW_IDS.backlogTable,
    database_id: TASKS_DATABASE_ID,
    name: "Backlog Table",
    layout_type: "table",
    grouping: {},
    filters: ARCHIVED_FALSE_FILTER,
    sorts: [],
    visible_properties: VISIBLE_PROPERTIES,
  },
  {
    id: VIEW_IDS.aiFlowHubList,
    database_id: TASKS_DATABASE_ID,
    name: "AI Flow Hub List",
    layout_type: "list",
    grouping: {},
    filters: ARCHIVED_FALSE_FILTER,
    sorts: [],
    visible_properties: AI_FLOW_VISIBLE,
  },
  {
    id: VIEW_IDS.archivedTasksHistory,
    database_id: TASKS_DATABASE_ID,
    name: "Archived Tasks History",
    layout_type: "table",
    grouping: {},
    filters: ARCHIVED_TRUE_FILTER,
    sorts: [],
    visible_properties: VISIBLE_PROPERTIES,
  },
];

async function backfillEavRecords(store: MongoDBEventStore): Promise<void> {
  const client = await getMongoClient();

  const projects = await store.projections.inline.find<ProjectListDocument>(
    { streamType: Project.streamType, projectionName: PROJECT_LIST_PROJECTION_NAME },
  );

  for (const project of projects) {
    await upsertProjectRecord(client, project);
  }

  const tasks = await store.projections.inline.find<TaskListDocument>(
    { streamType: Task.streamType, projectionName: TASK_LIST_PROJECTION_NAME },
  );

  for (const task of tasks) {
    await upsertTaskRecord(client, task);
  }
}

function createViewsBus(store: MongoDBEventStore): EntityCommandBus {
  const bus = new EntityCommandBus(store);
  bus.register(new CreateDatabaseViewHandler());
  bus.register(new UpdateDatabaseViewConfigHandler());
  return bus;
}

/**
 * Registers the idempotent seeded views + EAV record backfill phase.
 */
export function registerViewsSeedPhase(): void {
  registerSeedPhase({
    name: "seed-database-views",
    isNeeded: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const count = await store.projections.inline.count({
        streamType: DatabaseView.streamType,
        projectionName: DATABASE_VIEW_LIST_PROJECTION_NAME,
      });
      return count === 0;
    },
    run: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const bus = createViewsBus(store);
      const now = new Date();

      for (const viewData of SEEDED_VIEWS) {
        const command: CreateDatabaseView = {
          type: "CreateDatabaseView",
          data: viewData,
          metadata: { now },
        };

        await bus.send(command);
      }

      await backfillEavRecords(store);
    },
  });
}

registerViewsSeedPhase();

/**
 * Patches existing Sprint Board installs to subgroup by TaskGrouping (swimlanes).
 */
export function registerSprintBoardSubgroupPatchPhase(): void {
  registerSeedPhase({
    name: "patch-sprint-board-task-grouping-subgroups",
    isNeeded: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const doc = await store.projections.inline.findOne<DatabaseViewListDocument>({
        streamName: toStreamName(DatabaseView.streamType, VIEW_IDS.sprintBoard),
        projectionName: DATABASE_VIEW_LIST_PROJECTION_NAME,
      });
      if (!doc) {
        return false;
      }
      const grouping = doc.grouping as { subgroup_by?: string | null };
      return grouping.subgroup_by !== "TaskGrouping";
    },
    run: async (eventStore: EventStore) => {
      const store = eventStore as MongoDBEventStore;
      const doc = await store.projections.inline.findOne<DatabaseViewListDocument>({
        streamName: toStreamName(DatabaseView.streamType, VIEW_IDS.sprintBoard),
        projectionName: DATABASE_VIEW_LIST_PROJECTION_NAME,
      });
      if (!doc) {
        return;
      }

      const bus = createViewsBus(store);

      const command: UpdateDatabaseViewConfig = {
        type: "UpdateDatabaseViewConfig",
        data: {
          id: VIEW_IDS.sprintBoard,
          grouping: {
            ...(doc.grouping as Record<string, unknown>),
            ...SPRINT_BOARD_GROUPING,
          },
        },
        metadata: { now: new Date() },
      };

      await bus.send(command);
    },
  });
}

registerSprintBoardSubgroupPatchPhase();
