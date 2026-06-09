export type ParsedWeeklyTask = {
  name: string;
  description: string;
  status: string;
  category: string;
  owner: string;
};

const TASK_RE =
  /^\s*-\s*\[([ xX/])\]\s*([Ⓑ🅾️🤝])\s*(?:🔁\s*)?\*\*(.*?)\*\*:?\s*(.*)$/;

/**
 * Parses weekly planning markdown checklist tasks (line-for-line port of Python).
 *
 * @param content - Full markdown file content.
 * @returns Parsed task rows from the checklist section.
 */
export function parseWeeklyPlan(content: string): ParsedWeeklyTask[] {
  const tasks: ParsedWeeklyTask[] = [];
  const lines = content.split(/\r?\n/);

  let inChecklist = false;
  let currentCategory = "business";

  for (const line of lines) {
    const lineStripped = line.trim();

    if (lineStripped.startsWith("### Week:")) {
      inChecklist = true;
      continue;
    }

    if (
      inChecklist &&
      (lineStripped.startsWith("---") ||
        (lineStripped.startsWith("#") && !lineStripped.startsWith("####")))
    ) {
      inChecklist = false;
    }

    if (!inChecklist) {
      continue;
    }

    if (lineStripped.startsWith("####")) {
      const headerText = lineStripped.toLowerCase();
      if (
        headerText.includes("development") ||
        headerText.includes("implementation") ||
        headerText.includes("💻")
      ) {
        currentCategory = "dev";
      } else {
        currentCategory = "business";
      }
      continue;
    }

    const match = TASK_RE.exec(lineStripped);
    if (!match) {
      continue;
    }

    const statusChar = match[1].toLowerCase();
    const ownerChar = match[2];
    const title = match[3].trim();
    const desc = match[4].trim();

    let status: string;
    if (statusChar === "x") {
      status = "done";
    } else if (statusChar === "/") {
      status = "in_progress";
    } else {
      status = "backlog";
    }

    let ownerText = "Shared";
    if (ownerChar === "Ⓑ") {
      ownerText = "Alice";
    } else if (ownerChar === "🅾️") {
      ownerText = "Bob";
    }

    const fullDescription = desc
      ? `Owner: ${ownerText} | ${desc}`
      : `Owner: ${ownerText}`;

    tasks.push({
      name: title,
      description: fullDescription,
      status,
      category: currentCategory,
      owner: ownerText,
    });
  }

  return tasks;
}

/**
 * Parses weekly planning tasks from a file path.
 */
export function parseWeeklyPlanFile(content: string): ParsedWeeklyTask[] {
  return parseWeeklyPlan(content);
}
