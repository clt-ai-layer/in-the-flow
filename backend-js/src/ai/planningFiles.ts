import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads all non-archive markdown files from the planning directory (Python weekly-plan parity).
 */
export function loadAllPlanningMarkdown(planningPath: string): string {
  if (!existsSync(planningPath)) {
    return "No planning markdown files found.";
  }

  const mdFiles = readdirSync(planningPath).filter((f) => f.endsWith(".md"));
  let context = "";

  for (const fileName of mdFiles) {
    const filePath = join(planningPath, fileName);
    if (filePath.toLowerCase().includes("archive")) {
      continue;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      context += `\n\n--- File: ${fileName} ---\n${content}`;
    } catch (error) {
      console.error(
        `Error reading file ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return context.length > 0 ? context : "No planning markdown files found.";
}

/**
 * Loads MVP/week/planning markdown files for enhance-ticket context (Python parity).
 */
export function loadEnhanceTicketContext(planningPath: string): string {
  if (!existsSync(planningPath)) {
    return "";
  }

  const mdFiles = readdirSync(planningPath).filter((f) => f.endsWith(".md"));
  let context = "";

  for (const fileName of mdFiles) {
    const filePath = join(planningPath, fileName);
    if (filePath.toLowerCase().includes("archive")) {
      continue;
    }

    const lowerName = fileName.toLowerCase();
    if (
      !lowerName.includes("mvp") &&
      !lowerName.includes("week") &&
      !lowerName.includes("planning")
    ) {
      continue;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      context += `\n\n--- Context File: ${fileName} ---\n${content}`;
    } catch (error) {
      console.error(
        `Error reading context file ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return context;
}
