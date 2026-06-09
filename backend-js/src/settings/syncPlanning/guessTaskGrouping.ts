/**
 * Infers task_grouping from title, description, and category (Python parity).
 */
export function guessTaskGrouping(
  title: string,
  description: string,
  category: string,
): string {
  const text = `${title} ${description}`.toLowerCase();

  if (category === "dev") {
    if (
      text.includes("chat") ||
      text.includes("sse") ||
      text.includes("pipeline") ||
      text.includes("middleware")
    ) {
      return "AI";
    }
    if (
      text.includes("access") ||
      text.includes("auth") ||
      text.includes("orguser") ||
      text.includes("invitation")
    ) {
      return "Infrastructure";
    }
    if (text.includes("dsm") || text.includes("enrich")) {
      return "Backend";
    }
    if (text.includes("zod") || text.includes("validator")) {
      return "ZodValidator";
    }
    return "AI";
  }

  if (text.includes("workflow")) {
    return "Workflows";
  }
  if (text.includes("distribution")) {
    return "Distribution";
  }
  if (text.includes("widget")) {
    return "ChatWidget";
  }
  if (text.includes("demo")) {
    return "DemoStrategy";
  }
  if (text.includes("icp")) {
    return "IcpDefinition";
  }
  if (text.includes("linkedin") || text.includes("comment") || text.includes("post")) {
    return "SocialMedia";
  }
  if (text.includes("agent") || text.includes("productivity")) {
    return "ProductivityAgents";
  }
  return "General";
}

/**
 * Resolves project id for a parsed task — maps to the default project.
 */
export function guessProjectId(
  _title: string,
  _description: string,
  _category: string,
  projectMap: Map<string, string>,
): string | null {
  const firstKey = projectMap.keys().next().value;
  return firstKey ? (projectMap.get(firstKey) ?? null) : null;
}

/**
 * Builds a lowercase project name → id map from projection documents.
 */
export function buildProjectMap(
  projects: { name: string; id: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const project of projects) {
    map.set(project.name.toLowerCase(), project.id);
  }
  return map;
}
