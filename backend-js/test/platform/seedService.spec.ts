import { getInMemoryEventStore } from "@event-driven-io/emmett";
import { describe, expect, it } from "vitest";
import {
  clearSeedPhases,
  getRegisteredSeedPhases,
  registerSeedPhase,
  runSeed,
} from "@/platform/seedService.js";

describe("runSeed", () => {
  it("is a no-op when no phases are registered", async () => {
    clearSeedPhases();
    const eventStore = getInMemoryEventStore();

    await expect(runSeed(eventStore)).resolves.toBeUndefined();
    expect(getRegisteredSeedPhases()).toHaveLength(0);
  });

  it("runs only phases whose isNeeded returns true", async () => {
    clearSeedPhases();
    const eventStore = getInMemoryEventStore();
    const executed: string[] = [];

    registerSeedPhase({
      name: "skip-me",
      isNeeded: async () => false,
      run: async () => {
        executed.push("skip-me");
      },
    });

    registerSeedPhase({
      name: "run-me",
      isNeeded: async () => true,
      run: async () => {
        executed.push("run-me");
      },
    });

    await runSeed(eventStore);

    expect(executed).toEqual(["run-me"]);
  });
});
