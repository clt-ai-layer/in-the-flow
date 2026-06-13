import type { ParsedWeeklyTask } from "@/settings/syncPlanning/parseWeeklyPlan.js";

export type AiProvider = "kimi" | "gemini";

export class AiInvalidJsonError extends Error {
  readonly status = 500;
  readonly detail = "Invalid JSON from AI model";

  constructor() {
    super("Invalid JSON from AI model");
    this.name = "AiInvalidJsonError";
  }
}

export type FlowTaskInput = {
  name: string;
  status: string;
  category?: string;
  estimated_duration?: number | null;
  current_duration?: number | null;
};

export type JsonCallResult = {
  data: Record<string, unknown>;
  tokensUsed: number;
  model: string;
  prompt: string;
  rawResponse: string;
};

export interface AiService {
  readonly provider: AiProvider;
  readonly model: string;
  readonly isConfigured: boolean;
  getLastTokensUsed(): number;
  classifyTask(
    name: string,
    description: string,
    projectNames: string[],
  ): Promise<Record<string, unknown>>;
  compileWeeklyPlan(planningContents: string): Promise<Record<string, unknown>>;
  analyzeTasks(tasks: FlowTaskInput[]): Promise<Record<string, unknown>>;
  enhanceTask(
    name: string,
    descriptionStub: string,
    context?: string,
  ): Promise<Record<string, unknown>>;
  parseWeeklyPlanAi(planningContents: string): Promise<{ tasks: ParsedWeeklyTask[] }>;
}
