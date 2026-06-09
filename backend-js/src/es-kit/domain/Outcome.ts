/**
 * Domain success/failure result for Entity Kit methods.
 *
 * Maps to Emmett errors at the executor boundary via {@link toEmmettError}.
 *
 * @description Three-code table (ADR-005):
 *
 * | Code | Use when | DailyTask examples |
 * | ---- | -------- | ------------------ |
 * | `"not_found"` | Target entity or referenced aggregate missing | Daily task id not in stream; parent task_id missing |
 * | `"validation"` | Input/command field invalid | Invalid cron; empty name |
 * | `"illegal"` | State machine / lifecycle violation | Create when lifecycle ≠ Empty; Update on deleted |
 *
 * Default to `"illegal"` when unsure. Never encode HTTP status in message strings.
 */
export type OutcomeErrorCode = "not_found" | "validation" | "illegal";

export type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; code: OutcomeErrorCode; message: string };

export const Outcome = {
  ok: <T>(value: T): Outcome<T> => ({ ok: true, value }),

  fail: (code: OutcomeErrorCode, message: string): Outcome<never> => ({
    ok: false,
    code,
    message,
  }),

  /** Success with no value — used by Apply-pattern domain methods. */
  unit: (): Outcome<void> => ({ ok: true, value: undefined }),
};
