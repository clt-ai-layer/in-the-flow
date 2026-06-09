import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.spec.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      VITEST: "true",
      NODE_ENV: "test",
    },
    globalTeardown: ["./test/globalTeardown.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@event-driven-io/emmett": path.resolve(
        __dirname,
        "node_modules/@event-driven-io/emmett",
      ),
      "@event-driven-io/emmett-mongodb": path.resolve(
        __dirname,
        "node_modules/@event-driven-io/emmett-mongodb",
      ),
    },
  },
});
