import {
  MongoDBInlineProjectionSpec,
  expectInlineReadModel,
} from "@event-driven-io/emmett-mongodb";
import type { MongoDBReadEvent } from "@event-driven-io/emmett-mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import type { DailyTaskEvent } from "@/dailyTask/domain/events.js";
import { DailyTask } from "@/dailyTask/domain/DailyTask.js";
import { toStreamName } from "@event-driven-io/emmett-mongodb";
import {
  dailyTaskProjection,
  projectReadModel,
  type DailyTaskDocument,
} from "@/dailyTask/projections/dailyTaskProjection.js";
import { inlineProjections } from "@/platform/projections.js";
import { getTestMongoEventStore } from "../helpers/testEventStore.js";

function projectionNamesFromRegistry(
  registry: typeof inlineProjections,
): string[] {
  const entries = registry as unknown as Array<{
    projection?: { name: string };
    name?: string;
  }>;

  return entries.map(
    (entry) => entry.projection?.name ?? entry.name ?? "",
  );
}

const emptyDoc = (): DailyTaskDocument => ({
  id: "",
  task_id: null,
  date: "",
  start_time: "",
  end_time: "",
  title: null,
  owner: "Alice",
  parent_task_name: null,
  parent_task_grouping: null,
  parent_project_id: null,
  parent_status: null,
  parent_archived: null,
  created_at: "",
  updated_at: "",
});

describe("dailyTaskProjection", () => {
  describe("projectReadModel (direct fold)", () => {
    it("folds DailyTaskCreated into a document", () => {
      const doc = projectReadModel(
        emptyDoc(),
        {
          type: "DailyTaskCreated",
          data: {
            id: "dt-1",
            task_id: "task-1",
            date: "2026-05-25",
            start_time: "09:00",
            end_time: "09:30",
            title: "Focus",
            owner: "Alice",
            parent_task_name: "Parent",
            parent_task_grouping: "group-a",
            parent_project_id: "proj-1",
            parent_status: "active",
            parent_archived: false,
            created_at: "2026-05-25T09:00:00.000Z",
            updated_at: "2026-05-25T09:00:00.000Z",
          },
        } as MongoDBReadEvent<DailyTaskEvent>,
      );

      expect(doc).toEqual({
        id: "dt-1",
        task_id: "task-1",
        date: "2026-05-25",
        start_time: "09:00",
        end_time: "09:30",
        title: "Focus",
        owner: "Alice",
        parent_task_name: "Parent",
        parent_task_grouping: "group-a",
        parent_project_id: "proj-1",
        parent_status: "active",
        parent_archived: false,
        created_at: "2026-05-25T09:00:00.000Z",
        updated_at: "2026-05-25T09:00:00.000Z",
      });
    });

    it("folds DailyTaskUpdated by merging patch", () => {
      const existing = {
        ...emptyDoc(),
        id: "dt-1",
        title: "Old title",
        updated_at: "2026-05-25T09:00:00.000Z",
      };

      const doc = projectReadModel(
        existing,
        {
          type: "DailyTaskUpdated",
          data: {
            id: "dt-1",
            patch: { title: "New title" },
            updated_at: "2026-05-25T10:00:00.000Z",
          },
        } as MongoDBReadEvent<DailyTaskEvent>,
      );

      expect(doc).toEqual({
        ...existing,
        title: "New title",
        updated_at: "2026-05-25T10:00:00.000Z",
      });
    });

    it("returns null on DailyTaskDeleted", () => {
      const doc = projectReadModel(
        { ...emptyDoc(), id: "dt-1" },
        {
          type: "DailyTaskDeleted",
          data: { id: "dt-1", deleted_at: "2026-05-25T11:00:00.000Z" },
        } as MongoDBReadEvent<DailyTaskEvent>,
      );

      expect(doc).toBeNull();
    });
  });

  describe("defineEntityReadModel wrapper", () => {
    let given: ReturnType<typeof MongoDBInlineProjectionSpec.for>;

    beforeAll(async () => {
      await getTestMongoEventStore();
      given = MongoDBInlineProjectionSpec.for({
        projection: dailyTaskProjection,
        connectionString: process.env.MONGODB_URI!,
      });
    });

    it("registers projection metadata on wrapper", () => {
      expect(dailyTaskProjection.name).toBe("daily_task");
      expect(dailyTaskProjection.canHandle).toEqual([
        "DailyTaskCreated",
        "DailyTaskUpdated",
        "DailyTaskDeleted",
      ]);
    });

    it("registers exactly one daily_task inline projection", () => {
      const names = projectionNamesFromRegistry(inlineProjections);
      expect(names.filter((name) => name === "daily_task")).toHaveLength(1);
    });

    it("evolves read model through mongoDBInlineProjection wrapper", async () => {
      const streamName = toStreamName(DailyTask.streamType, "dt-2");

      await given({ streamName, events: [] })
        .when([
          {
            type: "DailyTaskCreated",
            data: {
              id: "dt-2",
              task_id: null,
              date: "2026-05-26",
              start_time: "10:00",
              end_time: "10:30",
              title: null,
              owner: "Alice",
              parent_task_name: null,
              parent_task_grouping: null,
              parent_project_id: null,
              parent_status: null,
              parent_archived: null,
              created_at: "2026-05-26T10:00:00.000Z",
              updated_at: "2026-05-26T10:00:00.000Z",
            },
          },
        ])
        .then(
          expectInlineReadModel.withName("daily_task").toHave({
            id: "dt-2",
            date: "2026-05-26",
            start_time: "10:00",
            end_time: "10:30",
          }),
        );
    });

    it("removes read model on DailyTaskDeleted", async () => {
      const streamName = toStreamName(DailyTask.streamType, "dt-3");

      await given({
        streamName,
        events: [
          {
            type: "DailyTaskCreated",
            data: {
              id: "dt-3",
              task_id: null,
              date: "2026-05-26",
              start_time: "11:00",
              end_time: "11:30",
              title: null,
              owner: "Alice",
              parent_task_name: null,
              parent_task_grouping: null,
              parent_project_id: null,
              parent_status: null,
              parent_archived: null,
              created_at: "2026-05-26T11:00:00.000Z",
              updated_at: "2026-05-26T11:00:00.000Z",
            },
          },
        ],
      })
        .when([
          {
            type: "DailyTaskDeleted",
            data: {
              id: "dt-3",
              deleted_at: "2026-05-26T12:00:00.000Z",
            },
          },
        ])
        .then(expectInlineReadModel.withName("daily_task").notToExist());
    });
  });
});
