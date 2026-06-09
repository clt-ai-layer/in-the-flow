import type { EventStore } from "@event-driven-io/emmett";

/**
 * A single idempotent startup seed step registered by domain modules.
 */
export type SeedPhase = {
  /** Human-readable phase name for logs. */
  name: string;
  /** Returns true when this phase should run. */
  isNeeded: (eventStore: EventStore) => Promise<boolean>;
  /** Executes domain commands via `handle()` — never direct Mongo inserts. */
  run: (eventStore: EventStore) => Promise<void>;
};

const seedPhases: SeedPhase[] = [];

/**
 * Registers an idempotent seed phase (called from domain modules in plans 03/07).
 *
 * @param phase - Seed phase definition.
 */
export function registerSeedPhase(phase: SeedPhase): void {
  seedPhases.push(phase);
}

/**
 * Clears registered seed phases — intended for unit tests only.
 */
export function clearSeedPhases(): void {
  seedPhases.length = 0;
}

/**
 * Returns a snapshot of registered seed phases.
 */
export function getRegisteredSeedPhases(): readonly SeedPhase[] {
  return [...seedPhases];
}

/**
 * Runs all registered seed phases whose {@link SeedPhase.isNeeded} check passes.
 *
 * When no phases are registered (foundation-only bootstrap), this is a no-op.
 *
 * @param eventStore - Emmett event store.
 */
export async function runSeed(eventStore: EventStore): Promise<void> {
  if (seedPhases.length === 0) {
    console.log("Startup seed: no phases registered yet (awaiting domain modules).");
    return;
  }

  for (const phase of seedPhases) {
    const needed = await phase.isNeeded(eventStore);
    if (!needed) {
      console.log(`Startup seed: skipping '${phase.name}' (already seeded).`);
      continue;
    }

    console.log(`Startup seed: running '${phase.name}'...`);
    await phase.run(eventStore);
    console.log(`Startup seed: completed '${phase.name}'.`);
  }
}
