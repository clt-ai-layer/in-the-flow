import { stopTestMongoEventStore } from "./helpers/testEventStore.js";

export default async function globalTeardown(): Promise<void> {
  await stopTestMongoEventStore();
}
