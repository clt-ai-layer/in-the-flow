import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAiService,
  getAiModel,
  getAiProvider,
  getApiKey,
  isAiConfigured,
} from "@/ai/aiConfig.js";
import { GeminiService } from "@/ai/GeminiService.js";
import { KimiService } from "@/ai/KimiService.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("aiConfig", () => {
  it("defaults to kimi provider", () => {
    delete process.env.AI_PROVIDER;
    expect(getAiProvider()).toBe("kimi");
  });

  it("resolves gemini provider from env", () => {
    process.env.AI_PROVIDER = "gemini";
    expect(getAiProvider()).toBe("gemini");
  });

  it("uses provider-specific default models", () => {
    delete process.env.AI_MODEL;
    delete process.env.KIMI_MODEL;
    delete process.env.GEMINI_MODEL;
    expect(getAiModel("kimi")).toBe("kimi-k2.6");
    expect(getAiModel("gemini")).toBe("gemini-2.0-flash");
  });

  it("prefers AI_MODEL over provider defaults", () => {
    process.env.AI_MODEL = "custom-model";
    expect(getAiModel("kimi")).toBe("custom-model");
    expect(getAiModel("gemini")).toBe("custom-model");
  });

  it("resolves kimi key from KIMI_API_KEY", () => {
    process.env.KIMI_API_KEY = "kimi-key";
    expect(getApiKey("kimi")).toBe("kimi-key");
  });

  it("resolves gemini key from GEMINI_API_KEY", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    expect(getApiKey("gemini")).toBe("gemini-key");
  });

  it("reports configured when active provider has a resolvable key", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.KIMI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(isAiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = "legacy-key";
    expect(isAiConfigured()).toBe(true);

    delete process.env.GEMINI_API_KEY;
    process.env.KIMI_API_KEY = "kimi-key";
    expect(isAiConfigured()).toBe(true);

    process.env.AI_PROVIDER = "gemini";
    delete process.env.KIMI_API_KEY;
    expect(isAiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = "gemini-key";
    expect(isAiConfigured()).toBe(true);
  });

  it("creates KimiService by default", () => {
    delete process.env.AI_PROVIDER;
    const service = createAiService();
    expect(service).toBeInstanceOf(KimiService);
    expect(service.provider).toBe("kimi");
  });

  it("creates GeminiService when provider is gemini", () => {
    process.env.AI_PROVIDER = "gemini";
    const service = createAiService();
    expect(service).toBeInstanceOf(GeminiService);
    expect(service.provider).toBe("gemini");
  });
});
