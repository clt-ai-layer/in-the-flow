import type { Event } from "@event-driven-io/emmett";
import type { MongoDBReadEvent } from "@event-driven-io/emmett-mongodb";
import type { Document } from "mongodb";
import { describe, expect, it } from "vitest";
import { defineEntityReadModel } from "@/es-kit/projections/defineEntityReadModel.js";

type CounterDoc = Document & { id: string; value: number };
type CounterCreated = Event<"CounterCreated", { id: string; value: number }>;
type CounterEvent = CounterCreated;

const projectReadModel = (
  doc: CounterDoc,
  event: MongoDBReadEvent<CounterEvent>,
): CounterDoc | null => {
  switch (event.type) {
    case "CounterCreated":
      return { id: event.data.id, value: event.data.value };
    default:
      return doc;
  }
};

describe("defineEntityReadModel", () => {
  it("wraps mongoDBInlineProjection with Entity Kit config names", () => {
    const projection = defineEntityReadModel<CounterDoc, CounterEvent>({
      name: "counter_read_model",
      schemaVersion: 1,
      canHandle: ["CounterCreated"],
      initialReadModel: () => ({ id: "", value: 0 }),
      projectReadModel,
    });

    expect(projection.name).toBe("counter_read_model");
    expect(projection.canHandle).toEqual(["CounterCreated"]);
  });

  it("projectReadModel folds events into documents", () => {
    const doc = projectReadModel(
      { id: "", value: 0 },
      {
        type: "CounterCreated",
        data: { id: "c1", value: 7 },
      } as MongoDBReadEvent<CounterCreated>,
    );

    expect(doc).toEqual({ id: "c1", value: 7 });
  });
});
