import { ValidationError } from "@event-driven-io/emmett";

const THEME_VALUES = new Set(["light", "dark"]);

/**
 * Validates a setting key/value pair before upsert.
 *
 * @throws ValidationError when a known key fails validation.
 */
export function validateSettingValue(key: string, value: string): void {
  switch (key) {
    case "theme":
      if (!THEME_VALUES.has(value)) {
        throw new ValidationError(`Invalid theme '${value}'. Must be 'light' or 'dark'.`);
      }
      break;

    case "grouping_colors":
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new ValidationError("grouping_colors must be a valid JSON object.");
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError("grouping_colors must be valid JSON.");
      }
      break;

    case "planning_folder_path":
      if (value.trim().length === 0) {
        throw new ValidationError("planning_folder_path must be a non-empty string.");
      }
      break;

    case "sync_active_file_hash":
      try {
        const parsed = JSON.parse(value) as { file_name?: unknown; hash?: unknown };
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          typeof parsed.file_name !== "string" ||
          typeof parsed.hash !== "string"
        ) {
          throw new ValidationError(
            "sync_active_file_hash must be valid JSON with file_name and hash strings.",
          );
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError("sync_active_file_hash must be valid JSON.");
      }
      break;

    case "gemini_api_key":
    case "GEMINI_API_KEY":
    case "kimi_api_key":
      if (value.trim().length === 0) {
        throw new ValidationError(`${key} must be a non-empty string when provided.`);
      }
      break;

    default:
      break;
  }
}
