/** Curated defaults for task grouping color assignments */
export const DEFAULT_GROUPING_COLORS = {
  AI: '#8B5CF6',
  Backend: '#3B82F6',
  'Access Control': '#10B981',
  'Project Management': '#06B6D4',
  ZodValidator: '#6366F1',
  API: '#06B6D4',
  Auth: '#10B981',
  Catalog: '#F59E0B',
  Orders: '#EF4444',
  Framework: '#EC4899',
  DDD: '#6366F1',
  InTheFlow: '#14B8A6',
  TenantApi: '#F97316',
  UserExperience: '#A855F7',
  DemoStrategy: '#F97316',
  Distribution: '#0EA5E9',
  IcpDefinition: '#E879F9',
  Workflows: '#84CC16',
  ChatWidget: '#FB923C',
  SocialMedia: '#EC4899',
  ProductivityAgents: '#2DD4BF',
  General: '#64748B',
};

/** Distinct from curated defaults — used for unknown grouping names */
export const OVERFLOW_PALETTE = [
  '#0EA5E9',
  '#84CC16',
  '#E879F9',
  '#FB923C',
  '#2DD4BF',
  '#F472B6',
  '#A3E635',
  '#38BDF8',
  '#C084FC',
  '#FB7185',
  '#4ADE80',
  '#FBBF24',
];

export const NEUTRAL_GROUPING_COLOR = '#64748B';
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/** Status column colors for calendar accent fallback (mirrors KanbanBoard STATUS_COLUMNS) */
export const STATUS_COLOR_MAP = {
  backlog: 'hsl(220, 10%, 60%)',
  ready_to_start: '#22d3ee',
  in_progress: '#a855f7',
  on_hold: '#eab308',
  done: '#22c55e',
};

/**
 * Merge user-stored JSON map over defaults.
 * @param {string|undefined|null} storedJson
 * @returns {Record<string, string>}
 */
export function resolveGroupingColors(storedJson) {
  let userMap = {};
  if (storedJson) {
    try {
      const parsed = JSON.parse(storedJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        userMap = parsed;
      }
    } catch {
      // ignore malformed JSON — fall back to defaults
    }
  }
  return { ...DEFAULT_GROUPING_COLORS, ...userMap };
}

/**
 * Simple string hash for deterministic overflow palette index.
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic color for unknown grouping names.
 * @param {string} name
 * @returns {string}
 */
export function hashGroupingColor(name) {
  const idx = hashString(name) % OVERFLOW_PALETTE.length;
  return OVERFLOW_PALETTE[idx];
}

/**
 * Resolve grouping color from settings map, with neutral + hash fallbacks.
 * @param {string|null|undefined} grouping
 * @param {Record<string, string>} [settingsMap]
 * @returns {string}
 */
export function getGroupingColor(grouping, settingsMap = DEFAULT_GROUPING_COLORS) {
  if (!grouping || grouping === '' || grouping === 'None' || grouping === 'General') {
    return settingsMap.General ?? NEUTRAL_GROUPING_COLOR;
  }
  if (settingsMap[grouping]) {
    return settingsMap[grouping];
  }
  return hashGroupingColor(grouping);
}

/**
 * Normalize task grouping from REST or EAV record shapes.
 * @param {object} taskOrRecord
 * @returns {string}
 */
export function getTaskGrouping(taskOrRecord) {
  if (!taskOrRecord) return 'General';
  const raw =
    taskOrRecord.task_grouping ??
    taskOrRecord.TaskGrouping ??
    taskOrRecord['Task Grouping'] ??
    '';
  if (!raw || raw === 'None') return 'General';
  return raw;
}

/**
 * Calendar block accent color — grouping → project → status → neutral.
 * @param {object} dailyTask
 * @param {Array<{id: string, color?: string}>} projects
 * @param {Record<string, string>} groupingColors
 * @returns {string}
 */
export function getDailyBlockAccentColor(dailyTask, projects, groupingColors) {
  const grouping = dailyTask?.parent_task_grouping;
  if (grouping) {
    return getGroupingColor(grouping, groupingColors);
  }

  const projectId = dailyTask?.parent_project_id;
  if (projectId && projects?.length) {
    const project = projects.find((p) => p.id === projectId);
    if (project?.color) return project.color;
  }

  const status = dailyTask?.parent_status;
  if (status && STATUS_COLOR_MAP[status]) {
    return STATUS_COLOR_MAP[status];
  }

  return NEUTRAL_GROUPING_COLOR;
}

/**
 * Convert #RRGGBB to rgba string.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function hexToRgba(hex, alpha) {
  if (!hex || !HEX_COLOR_REGEX.test(hex)) {
    return `rgba(100, 116, 139, ${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Full-card surface tint from grouping color — very light so text stays readable.
 * @param {string|null|undefined} grouping
 * @param {Record<string, string>} [settingsMap]
 * @returns {{ backgroundColor: string, borderColor: string }}
 */
export function getGroupingCardSurfaceStyle(grouping, settingsMap = DEFAULT_GROUPING_COLORS) {
  const hex = getGroupingColor(grouping, settingsMap);
  const isLightTheme =
    typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'light';
  const bgAlpha = isLightTheme ? 0.12 : 0.14;
  const borderAlpha = isLightTheme ? 0.28 : 0.32;
  return {
    backgroundColor: hexToRgba(hex, bgAlpha),
    borderColor: hexToRgba(hex, borderAlpha),
  };
}

/**
 * Kanban card chrome — surface tint plus 4px left stripe (matches Calendar block accent).
 * @param {string|null|undefined} grouping
 * @param {Record<string, string>} [settingsMap]
 * @returns {import('react').CSSProperties}
 */
export function getGroupingCardChromeStyle(grouping, settingsMap = DEFAULT_GROUPING_COLORS) {
  const hex = getGroupingColor(grouping, settingsMap);
  return {
    ...getGroupingCardSurfaceStyle(grouping, settingsMap),
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: hex,
  };
}

/**
 * Relative luminance for WCAG contrast calculations.
 * @param {number} channel 0–255
 * @returns {number}
 */
function channelLuminance(channel) {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * WCAG contrast ratio between two hex colors.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
export function getContrastRatio(hex1, hex2) {
  const parse = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
  };
  const l1 = parse(hex1);
  const l2 = parse(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick black or white text for readability on a background hex.
 * @param {string} bgHex
 * @returns {'#0f172a'|'#ffffff'}
 */
export function getContrastTextColor(bgHex) {
  const ratioWhite = getContrastRatio(bgHex, '#ffffff');
  const ratioDark = getContrastRatio(bgHex, '#0f172a');
  return ratioWhite >= ratioDark ? '#ffffff' : '#0f172a';
}

/**
 * Validate a grouping color map — returns invalid entries or null if valid.
 * @param {Record<string, string>} map
 * @returns {string[]|null}
 */
export function validateGroupingColorMap(map) {
  const invalid = [];
  for (const [key, value] of Object.entries(map)) {
    if (!HEX_COLOR_REGEX.test(value)) {
      invalid.push(key);
    }
  }
  return invalid.length > 0 ? invalid : null;
}

/**
 * Derive distinct grouping names from tasks + defaults.
 * @param {Array<object>} tasks
 * @returns {string[]}
 */
export function deriveGroupingList(tasks = []) {
  const names = new Set(Object.keys(DEFAULT_GROUPING_COLORS));
  for (const task of tasks) {
    const g = getTaskGrouping(task);
    if (g && g !== 'General') {
      names.add(g);
    } else {
      names.add('General');
    }
  }
  return Array.from(names).sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return a.localeCompare(b);
  });
}
