import type { ParsedWeeklyTask } from "@/settings/syncPlanning/parseWeeklyPlan.js";

export const KIMI_API_BASE = "https://api.moonshot.ai/v1";
export const DEFAULT_KIMI_MODEL = "kimi-k2.6";
export const KIMI_REQUEST_TIMEOUT_MS = 60_000;

const DEV_KEYWORDS = [
  "code",
  "test",
  "api",
  "database",
  "zod",
  "middleware",
  "dev",
];

export class KimiInvalidJsonError extends Error {
  readonly status = 500;
  readonly detail = "Invalid JSON from AI model";

  constructor() {
    super("Invalid JSON from AI model");
    this.name = "KimiInvalidJsonError";
  }
}

type KimiCallResult = {
  data: Record<string, unknown>;
  tokensUsed: number;
  model: string;
  prompt: string;
  rawResponse: string;
};

type FlowTaskInput = {
  name: string;
  status: string;
  category?: string;
  estimated_duration?: number | null;
  current_duration?: number | null;
};

/**
 * Moonshot Kimi provider — ports Python GeminiService stub/live contracts.
 */
export class KimiService {
  private readonly apiKey: string | undefined;
  readonly model: string;
  private lastTokensUsed = 0;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey?.trim() || undefined;
    this.model = model?.trim() || process.env.KIMI_MODEL?.trim() || DEFAULT_KIMI_MODEL;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  /** Token count from the most recent live API call (0 for stubs). */
  getLastTokensUsed(): number {
    return this.lastTokensUsed;
  }

  /**
   * Classifies a task into business/dev with project and duration estimates.
   */
  async classifyTask(
    name: string,
    description: string,
    projectNames: string[],
  ): Promise<Record<string, unknown>> {
    const systemInstruction = `
        You are an expert project manager. Analyze the provided task name and description. 
        Determine if the task is a Business task (Marketing, Legal, Strategy, Product design) or a Dev task (Coding, Testing, DevOps, Database, Schema validation).
        Classify the task into one of the known project names.
        Estimate the task completion duration in minutes.
        
        Known Projects:
        ${JSON.stringify(projectNames, null, 2)}
        
        You must output a JSON object matching this schema:
        {
          "category": "business" | "dev",
          "project_name": "Match one of the known project names exactly, or output null",
          "estimated_duration": integer,
          "confidence": float,
          "rationale": "Brief reasoning description"
        }
        `;

    const prompt = JSON.stringify({ name, description: description || "" });

    if (!this.isConfigured) {
      this.lastTokensUsed = 0;
      return this.classifyTaskStub(name, description, projectNames);
    }

    const { data, tokensUsed } = await this.callKimiJson(systemInstruction, prompt);
    this.lastTokensUsed = tokensUsed;
    return data;
  }

  /**
   * Compiles a structured weekly plan summary from planning markdown.
   */
  async compileWeeklyPlan(planningContents: string): Promise<Record<string, unknown>> {
    const systemInstruction = `
        You are an executive project assistant. Read the provided markdown files summarizing the current week planning and MVP backlog. 
        Extract all active business and technical tasks. Compile a structured summary of priorities.
        Output a JSON object matching this schema:
        {
          "week_summary": "High-level summary of the week's strategic focus",
          "priorities": [
             {"name": "Task name", "category": "business" | "dev", "project": "Project name"}
          ],
          "suggested_calendar": [
             {
               "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Weekend",
               "tasks": ["Task name 1", "Task name 2"]
             }
          ]
        }
        `;

    if (!this.isConfigured) {
      this.lastTokensUsed = 0;
      return {
        week_summary: "Weekly plan overview (Stub - Gemini key not configured).",
        priorities: [
          { name: "Complete AI integration", category: "dev", project: "My Project" },
        ],
        suggested_calendar: [
          { day: "Monday", tasks: ["Review task backlog"] },
          { day: "Wednesday", tasks: ["Perform business validation checks"] },
        ],
      };
    }

    const { data, tokensUsed } = await this.callKimiJson(systemInstruction, planningContents);
    this.lastTokensUsed = tokensUsed;
    return data;
  }

  /**
   * Analyzes active tasks for flow friction and blockers.
   */
  async analyzeTasks(tasks: FlowTaskInput[]): Promise<Record<string, unknown>> {
    const systemInstruction = `
        You are a developer coach specializing in flow state optimization. 
        Analyze the log of active and stalled tasks. Identify tasks that are "On Hold", tasks whose "current_duration" exceeds "estimated_duration", and tasks with frequent status revisions.
        Provide a friction score (0 to 100), identify specific blockers, and suggest remediation (e.g. recommend splitting a large task, taking a break, or seeking specification reviews).
        
        Output a JSON object matching this schema:
        {
          "friction_score": integer,
          "identified_blockers": [
             {
               "task_name": "Task Name",
               "blocker_type": "estimation_exceeded" | "on_hold" | "unclear_spec",
               "description": "Brief description of the blocker"
             }
          ],
          "remediation_actions": ["Actionable step 1", "Actionable step 2"],
          "split_recommendations": [
             {
               "original_task": "Task Name",
               "sub_tasks": ["Sub-task 1", "Sub-task 2", "Sub-task 3"]
             }
          ]
        }
        `;

    if (!this.isConfigured) {
      this.lastTokensUsed = 0;
      return this.diagnoseFlowStub(tasks);
    }

    const { data, tokensUsed } = await this.callKimiJson(systemInstruction, JSON.stringify(tasks));
    this.lastTokensUsed = tokensUsed;
    return data;
  }

  /**
   * Enhances a ticket description with professional markdown formatting.
   */
  async enhanceTask(
    name: string,
    descriptionStub: string,
    context?: string,
  ): Promise<Record<string, unknown>> {
    const systemInstruction = `
        You are an expert product analyst. Take the short task name, optional brief outline, and project planning context. 
        Auto-generate a professional, markdown-formatted ticket description matching Notion / Jira standards.
        Ensure the generated requirements, preconditions, and description align with the business context and technical architecture defined in the project description and context.
        Include sections: Description, Requirements, Preconditions, and Verification/Testing Steps.
        
        Output a JSON object matching this schema:
        {
          "enhanced_description_markdown": "Complete markdown string"
        }
        `;

    const promptData: Record<string, string> = {
      name,
      outline: descriptionStub || "",
    };
    if (context) {
      promptData.project_context = context;
    }

    if (!this.isConfigured) {
      this.lastTokensUsed = 0;
      return {
        enhanced_description_markdown: `### Description
${descriptionStub || "No description provided."}

### Requirements
- Complete implementations for: ${name}
- Secure verification parameters

### Preconditions
- Setup API endpoints or configurations

### Verification Steps
1. Verify feature matches core requirements
2. Run visual validation checks
`,
      };
    }

    const { data, tokensUsed } = await this.callKimiJson(systemInstruction, JSON.stringify(promptData));
    this.lastTokensUsed = tokensUsed;
    return data;
  }

  /**
   * Parses weekly planning markdown into structured tasks (sync AI fallback).
   */
  async parseWeeklyPlanAi(
    planningContents: string,
  ): Promise<{ tasks: ParsedWeeklyTask[] }> {
    const systemInstruction = `
        You are a project manager. Read the provided markdown weekly plan.
        Locate the weekly priorities or task checklists (usually under the "### Week: ..." header).
        Extract all individual tasks and format them as a JSON list.
        
        For each task, extract:
        1. "name": The short, descriptive title of the task.
        2. "description": Detailed description, prepended with the owner name (e.g. "Owner: Alice | details").
        3. "status": Determine the status: "done" (if completed/marked checked like [x] or [X] or ✅), "in_progress" (if marked in progress like [/]), or "backlog" (if unchecked [ ]).
        4. "category": Either "dev" (for coding, testing, backend/frontend engineering) or "business" (for marketing, strategy, comment campaigns, operations, etc.).
        5. "owner": Either "Alice", "Bob", or "Shared" based on markers Ⓑ, 🅾️, 🤝.
        
        Output a JSON object matching this schema:
        {
          "tasks": [
             {
               "name": "string",
               "description": "string",
               "status": "backlog" | "in_progress" | "done",
               "category": "dev" | "business",
               "owner": "Alice" | "Bob" | "Shared"
             }
          ]
        }
        `;

    if (!this.isConfigured) {
      this.lastTokensUsed = 0;
      return { tasks: [] };
    }

    const { data, tokensUsed } = await this.callKimiJson(systemInstruction, planningContents);
    this.lastTokensUsed = tokensUsed;
    const tasks = Array.isArray(data.tasks) ? (data.tasks as ParsedWeeklyTask[]) : [];
    return { tasks };
  }

  private classifyTaskStub(
    name: string,
    description: string,
    projectNames: string[],
  ): Record<string, unknown> {
    const haystack = `${name} ${description || ""}`.toLowerCase();
    const isDev = DEV_KEYWORDS.some((keyword) => haystack.includes(keyword));

    return {
      category: isDev ? "dev" : "business",
      project_name: projectNames[0] ?? "My Project",
      estimated_duration: 60,
      confidence: 0.5,
      rationale: "Stub auto-classification (Gemini API key not configured).",
    };
  }

  private diagnoseFlowStub(tasks: FlowTaskInput[]): Record<string, unknown> {
    const blockers: Array<{
      task_name: string;
      blocker_type: string;
      description: string;
    }> = [];

    for (const task of tasks) {
      const est = task.estimated_duration ?? 0;
      const cur = task.current_duration ?? 0;

      if (task.status === "on_hold") {
        blockers.push({
          task_name: task.name,
          blocker_type: "on_hold",
          description: "Task is on hold.",
        });
      } else if (cur > est && est > 0) {
        blockers.push({
          task_name: task.name,
          blocker_type: "estimation_exceeded",
          description: `Spent ${cur}m, estimated ${est}m.`,
        });
      }
    }

    const remediations: string[] = [];
    let friction: number;

    if (blockers.length > 0) {
      remediations.push("Consider breaking down overdue tasks into smaller sub-tasks.");
      friction = Math.min(30 + 15 * blockers.length, 100);
    } else {
      remediations.push("All tasks running smoothly. Keep up the flow!");
      friction = 10;
    }

    return {
      friction_score: friction,
      identified_blockers: blockers,
      remediation_actions: remediations,
      split_recommendations: blockers
        .filter((blocker) => blocker.blocker_type === "estimation_exceeded")
        .map((blocker) => ({
          original_task: blocker.task_name,
          sub_tasks: [
            `Part 1: Research ${blocker.task_name}`,
            `Part 2: Implement ${blocker.task_name}`,
          ],
        })),
    };
  }

  private async callKimiJson(
    systemInstruction: string,
    prompt: string,
  ): Promise<KimiCallResult> {
    if (!this.apiKey) {
      throw new Error("Kimi API key is not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KIMI_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${KIMI_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemInstruction.trim() },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Kimi API error ${response.status}: ${body}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new KimiInvalidJsonError();
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(content) as Record<string, unknown>;
      } catch {
        throw new KimiInvalidJsonError();
      }

      const promptTokens = payload.usage?.prompt_tokens ?? 0;
      const completionTokens = payload.usage?.completion_tokens ?? 0;

      return {
        data,
        tokensUsed: promptTokens + completionTokens,
        model: this.model,
        prompt,
        rawResponse: content,
      };
    } catch (error) {
      if (error instanceof KimiInvalidJsonError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Kimi API request timed out after 60 seconds.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
