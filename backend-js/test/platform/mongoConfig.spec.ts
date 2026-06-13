import { describe, expect, it, afterEach } from "vitest";
import { resolveMongoUri, getDatabaseName, MONGO_SETUP_MESSAGE } from "@/platform/mongoUri.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("resolveMongoUri", () => {
  it("throws actionable message when no URI or key file", () => {
    delete process.env.MONGODB_URI;
    process.env.MONGO_KEY_PATH = "C:\\nonexistent\\intheflow-test-mongo-key";

    expect(() => resolveMongoUri()).toThrow(MONGO_SETUP_MESSAGE);
  });

  it("uses MONGO_URI when MONGODB_URI is unset", () => {
    delete process.env.MONGODB_URI;
    process.env.MONGO_URI = "mongodb://localhost:27018";
    expect(resolveMongoUri()).toBe("mongodb://localhost:27018");
  });

  it("uses MONGODB_URI when set", () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    expect(resolveMongoUri()).toBe("mongodb://localhost:27017");
  });
});

describe("getDatabaseName", () => {
  it("returns intheflow_test under Vitest", () => {
    process.env.VITEST = "true";
    delete process.env.MONGODB_DB_NAME;
    expect(getDatabaseName()).toBe("intheflow_test");
  });

  it("never returns intheflow_dev in test mode", () => {
    process.env.VITEST = "true";
    expect(getDatabaseName()).not.toBe("intheflow_dev");
  });
});
