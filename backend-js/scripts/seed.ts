/**
 * InTheFlow Seed Script — seeds the app via REST API.
 *
 * Usage:
 *   pnpm seed                              # Uses default starter-pack.json
 *   pnpm seed -- --file seed/custom.json   # Custom seed file
 *   pnpm seed -- --reset                   # Wipe DB before seeding (dev only)
 *   pnpm seed -- --dry-run                 # Show what would be seeded, don't execute
 *
 * Requires the backend to be running on http://127.0.0.1:8000.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/* ─── Config ─────────────────────────────────────────────────── */

const BASE_URL = process.env.SEED_API_URL ?? "http://127.0.0.1:8000";
const DEFAULT_SEED = "seed/starter-pack.json";

/* ─── Types ──────────────────────────────────────────────────── */

type SeedProject = { name: string; description?: string; color?: string };
type SeedTask = {
  name: string;
  status?: string;
  category?: string;
  source?: string;
  task_grouping?: string;
  owner?: string;
  estimated_duration?: number;
  current_duration?: number;
  project?: string; // resolved to project_id at runtime
  description?: string;
};
type SeedDailyBlock = {
  start_time: string;
  end_time: string;
  task_name?: string; // resolved to task_id at runtime
  title?: string;
  owner?: string;
};
type SeedDailyDay = {
  date_offset: number; // 0 = today, 1 = tomorrow, -1 = yesterday
  blocks: SeedDailyBlock[];
};
type SeedData = {
  projects?: SeedProject[];
  tasks?: SeedTask[];
  daily_tasks?: SeedDailyDay[];
  settings?: Record<string, string>;
};

/* ─── Helpers ────────────────────────────────────────────────── */

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return (await res.json().catch(() => ({}))) as T;
}

function formatDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function log(emoji: string, msg: string): void {
  console.log(`  ${emoji}  ${msg}`);
}

/* ─── Seed Steps ─────────────────────────────────────────────── */

async function checkHealth(): Promise<boolean> {
  try {
    const data = await api<{ status: string }>("GET", "/");
    return data.status === "online";
  } catch {
    return false;
  }
}

async function seedProjects(
  projects: SeedProject[],
  dryRun: boolean,
): Promise<Map<string, string>> {
  const projectMap = new Map<string, string>();
  const existing = await api<Array<{ id: string; name: string }>>("GET", "/api/projects");

  for (const p of existing) {
    projectMap.set(p.name, p.id);
  }

  for (const p of projects) {
    if (projectMap.has(p.name)) {
      log("⏭️", `Project "${p.name}" already exists, skipping`);
      continue;
    }
    if (dryRun) {
      log("🔍", `[DRY RUN] Would create project: ${p.name}`);
      continue;
    }
    const created = await api<{ id: string }>("POST", "/api/projects", p);
    projectMap.set(p.name, created.id);
    log("📁", `Created project: ${p.name}`);
  }

  return projectMap;
}

async function seedTasks(
  tasks: SeedTask[],
  projectMap: Map<string, string>,
  dryRun: boolean,
): Promise<Map<string, string>> {
  const taskMap = new Map<string, string>();
  const existing = await api<Array<{ id: string; name: string }>>(
    "GET",
    "/api/tasks?include_archived=true",
  );

  const existingNames = new Set(existing.map((t) => t.name));
  for (const t of existing) {
    taskMap.set(t.name, t.id);
  }

  const creations: Array<Record<string, unknown>> = [];

  for (const task of tasks) {
    if (existingNames.has(task.name)) {
      log("⏭️", `Task "${task.name}" already exists, skipping`);
      continue;
    }
    const { project, ...taskData } = task;
    const payload: Record<string, unknown> = { ...taskData };
    if (project && projectMap.has(project)) {
      payload.project_id = projectMap.get(project);
    }
    creations.push(payload);
  }

  if (creations.length === 0) {
    log("✅", "All tasks already exist");
    return taskMap;
  }

  if (dryRun) {
    for (const c of creations) {
      log("🔍", `[DRY RUN] Would create task: ${c.name}`);
    }
    return taskMap;
  }

  // Use bulk-sync for efficiency
  await api("POST", "/api/tasks/bulk-sync", { creations });
  log("📋", `Created ${creations.length} tasks via bulk-sync`);

  // Refresh task map for daily-task linking
  const refreshed = await api<Array<{ id: string; name: string }>>(
    "GET",
    "/api/tasks?include_archived=true",
  );
  for (const t of refreshed) {
    taskMap.set(t.name, t.id);
  }

  return taskMap;
}

async function seedDailyTasks(
  days: SeedDailyDay[],
  taskMap: Map<string, string>,
  dryRun: boolean,
): Promise<void> {
  const creations: Array<Record<string, unknown>> = [];

  for (const day of days) {
    const date = formatDate(day.date_offset);

    // Check if blocks already exist for this date
    const existing = await api<Array<{ id: string }>>(
      "GET",
      `/api/daily-tasks?start_date=${date}&end_date=${date}`,
    );

    if (existing.length > 0) {
      log("⏭️", `Calendar ${date}: ${existing.length} blocks already exist, skipping`);
      continue;
    }

    for (const block of day.blocks) {
      const payload: Record<string, unknown> = {
        date,
        start_time: block.start_time,
        end_time: block.end_time,
        owner: block.owner ?? "Alice",
      };

      if (block.task_name && taskMap.has(block.task_name)) {
        payload.task_id = taskMap.get(block.task_name);
      } else if (block.title) {
        payload.title = block.title;
      } else if (block.task_name) {
        payload.title = block.task_name; // fallback: use task_name as title
      }

      creations.push(payload);
    }
  }

  if (creations.length === 0) {
    log("✅", "All calendar blocks already exist");
    return;
  }

  if (dryRun) {
    for (const c of creations) {
      log("🔍", `[DRY RUN] Would create block: ${c.date} ${c.start_time}-${c.end_time}`);
    }
    return;
  }

  await api("POST", "/api/daily-tasks/bulk-sync", { creations });
  log("📅", `Created ${creations.length} calendar blocks via bulk-sync`);
}

async function seedSettings(
  settings: Record<string, string>,
  dryRun: boolean,
): Promise<void> {
  if (Object.keys(settings).length === 0) return;

  if (dryRun) {
    for (const [k, v] of Object.entries(settings)) {
      log("🔍", `[DRY RUN] Would set: ${k} = ${v}`);
    }
    return;
  }

  await api("POST", "/api/settings", settings);
  log("⚙️", `Upserted ${Object.keys(settings).length} settings`);
}

/* ─── CLI ────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.find((_, i) => args[i - 1] === "--file") ?? DEFAULT_SEED;

  const seedPath = resolve(fileArg);
  if (!existsSync(seedPath)) {
    console.error(`❌ Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const data: SeedData = JSON.parse(readFileSync(seedPath, "utf-8"));

  console.log(`\n🌱 InTheFlow Seed Script`);
  console.log(`   File: ${seedPath}`);
  console.log(`   API:  ${BASE_URL}`);
  if (dryRun) console.log(`   Mode: DRY RUN (no changes)`);
  console.log();

  // Health check
  const online = await checkHealth();
  if (!online) {
    console.error(`❌ Backend is not reachable at ${BASE_URL}`);
    console.error(`   Start it first: cd backend-js && pnpm dev`);
    process.exit(1);
  }
  log("🟢", "Backend is online\n");

  // 1. Projects
  let projectMap = new Map<string, string>();
  if (data.projects?.length) {
    console.log("─── Projects ───");
    projectMap = await seedProjects(data.projects, dryRun);
    console.log();
  }

  // 2. Tasks
  let taskMap = new Map<string, string>();
  if (data.tasks?.length) {
    console.log("─── Tasks ───");
    taskMap = await seedTasks(data.tasks, projectMap, dryRun);
    console.log();
  }

  // 3. Daily Tasks (Calendar)
  if (data.daily_tasks?.length) {
    console.log("─── Calendar Blocks ───");
    await seedDailyTasks(data.daily_tasks, taskMap, dryRun);
    console.log();
  }

  // 4. Settings
  if (data.settings && Object.keys(data.settings).length > 0) {
    console.log("─── Settings ───");
    await seedSettings(data.settings, dryRun);
    console.log();
  }

  console.log(dryRun ? "🔍 Dry run complete.\n" : "✅ Seeding complete!\n");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
