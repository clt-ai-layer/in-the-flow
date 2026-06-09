/**
 * Safely evaluates formula expressions with `prop('Field Name')` lookups.
 * Supports +, -, *, /, parentheses — no raw eval().
 */

const PROP_PATTERN = /prop\(['"](.*?)['"]\)/g;
const ALLOWED_CHARS = /^[\d+\-*/().\s'"]*$/;

function substituteProps(expression: string, values: Record<string, unknown>): string {
  return expression.replace(PROP_PATTERN, (_match, propName: string) => {
    const val = values[propName] ?? 0;
    if (val === null || val === undefined) {
      return "0";
    }
    if (typeof val === "number") {
      return String(val);
    }
    return JSON.stringify(String(val));
  });
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }

    if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < expr.length && expr[j] !== quote) {
        j += 1;
      }
      tokens.push(expr.slice(i, j + 1));
      i = j + 1;
      continue;
    }

    if (/[\d.]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[\d.]/.test(expr[j])) {
        j += 1;
      }
      tokens.push(expr.slice(i, j));
      i = j;
      continue;
    }

    throw new Error(`Unexpected character in formula: ${ch}`);
  }

  return tokens;
}

function parseExpression(tokens: string[], pos: { index: number }): number | string {
  let left = parseTerm(tokens, pos);

  while (pos.index < tokens.length && (tokens[pos.index] === "+" || tokens[pos.index] === "-")) {
    const op = tokens[pos.index];
    pos.index += 1;
    const right = parseTerm(tokens, pos);

    if (typeof left === "string" || typeof right === "string") {
      left = String(left) + String(right);
      continue;
    }

    left = op === "+" ? left + right : left - right;
  }

  return left;
}

function parseTerm(tokens: string[], pos: { index: number }): number | string {
  let left = parseFactor(tokens, pos);

  while (pos.index < tokens.length && (tokens[pos.index] === "*" || tokens[pos.index] === "/")) {
    const op = tokens[pos.index];
    pos.index += 1;
    const right = parseFactor(tokens, pos);

    if (typeof left === "number" && typeof right === "number") {
      left = op === "*" ? left * right : left / right;
    } else {
      left = String(left) + String(right);
    }
  }

  return left;
}

function parseFactor(tokens: string[], pos: { index: number }): number | string {
  if (pos.index >= tokens.length) {
    return 0;
  }

  const token = tokens[pos.index];

  if (token === "(") {
    pos.index += 1;
    const value = parseExpression(tokens, pos);
    if (tokens[pos.index] === ")") {
      pos.index += 1;
    }
    return value;
  }

  if (token === "-") {
    pos.index += 1;
    const value = parseFactor(tokens, pos);
    return typeof value === "number" ? -value : value;
  }

  if (token === "+" ) {
    pos.index += 1;
    return parseFactor(tokens, pos);
  }

  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    pos.index += 1;
    return token.slice(1, -1);
  }

  pos.index += 1;
  const num = Number(token);
  return Number.isNaN(num) ? token : num;
}

/**
 * Evaluates a formula expression against record property values.
 *
 * @param expression - Formula with optional `prop('Name')` references.
 * @param values - Current property value map for the record.
 * @returns Computed value; returns 0 on parse/eval failure.
 */
export function evaluateFormula(
  expression: string,
  values: Record<string, unknown>,
): unknown {
  if (!expression) {
    return 0;
  }

  try {
    const substituted = substituteProps(expression, values);
    const stripped = substituted.replace(/[0-9+\-*/().\s'"]/g, "");

    if (stripped !== "") {
      return substituted;
    }

    const tokens = tokenize(substituted);
    const pos = { index: 0 };
    const result = parseExpression(tokens, pos);
    return result;
  } catch {
    return 0;
  }
}

/**
 * Validates that substituted expression contains only safe arithmetic characters.
 */
export function isSafeArithmeticExpression(expression: string): boolean {
  const substituted = expression.replace(PROP_PATTERN, "0");
  return ALLOWED_CHARS.test(substituted.replace(/[0-9+\-*/().\s'"]/g, ""));
}
