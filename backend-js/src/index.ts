import { loadAppEnv } from "./platform/loadEnv.js";
import { createApp } from "./platform/app.js";
import { closeMongoResources, getEventStore } from "./platform/mongoConfig.js";
import { runSeed } from "./platform/seedService.js";

const HOST = "127.0.0.1";
const PORT = 8000;

loadAppEnv();

/**
 * Boots the InTheFlow backend-js HTTP server.
 */
async function main(): Promise<void> {
  const eventStore = await getEventStore();
  const app = createApp(eventStore);

  await runSeed(eventStore);

  const server = app.listen(PORT, HOST, () => {
    console.log(`InTheFlow backend-js listening on http://${HOST}:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await closeMongoResources();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
