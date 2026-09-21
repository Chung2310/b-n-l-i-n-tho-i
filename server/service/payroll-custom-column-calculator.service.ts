import type {
  IPayrollCustomVariable,
  PayrollCustomColumnOperator,
  PayrollCustomColumnRoundingMode,
} from "../interface/payroll-period-input.interface";

const VIETNAMESE_SOURCE_MAP: Record<string, string> = {
  "lương cơ bản": "monthlySalary",
  "lương cơ bản / thỏa thuận": "monthlySalary",
  "lương thỏa thuận": "monthlySalary",
  "lương cb": "monthlySalary",
  "số ngày công thực tế": "workedDays",
  "ngày công thực tế": "workedDays",
  "ngày công": "workedDays",
  "công thực tế": "workedDays",
  "số ngày công chuẩn": "standardDays",
  "ngày công chuẩn": "standardDays",
  "công chuẩn": "standardDays",
  "số giờ tăng ca": "overtimeHours",
  "giờ tăng ca": "overtimeHours",
  "tăng ca": "overtimeHours",
  "hoa hồng doanh số": "commission",
  "hoa hồng": "commission",
  "số giờ làm thực tế": "workedHours",
  "giờ làm thực tế": "workedHours",
  "giờ làm": "workedHours",
  "số giờ làm chuẩn": "standardHours",
  "giờ làm chuẩn": "standardHours",
  "phụ cấp": "allowance",
  "thưởng": "bonus",
  "khấu trừ": "deduction",
};

/**
 * Resolves a numeric value from employee calculation context by source key.
 * Supports aliases (e.g. workedDays <-> reconciledDays <-> actualWorkDays),
 * custom variables, and friendly Vietnamese labels.
 */
export function resolveSourceValue(sourceKey: string, context: Record<string, any>): number {
  if (!sourceKey || !context) return 0;

  const trimmed = sourceKey.trim();
  const lower = trimmed.toLowerCase();

  // Map from friendly Vietnamese label if applicable
  const resolvedKey = VIETNAMESE_SOURCE_MAP[lower] || trimmed;

  // Exact match
  if (context[resolvedKey] !== undefined) {
    const val = Number(context[resolvedKey]);
    return Number.isFinite(val) ? val : 0;
  }

  // Strip or add "custom." prefix if looking up a custom variable
  const stripped = resolvedKey.startsWith("custom.") ? resolvedKey.slice("custom.".length) : resolvedKey;
  if (context[stripped] !== undefined) {
    const val = Number(context[stripped]);
    return Number.isFinite(val) ? val : 0;
  }

  const prefixed = `custom.${resolvedKey}`;
  if (context[prefixed] !== undefined) {
    const val = Number(context[prefixed]);
    return Number.isFinite(val) ? val : 0;
  }

  // Nested custom or customValues dictionary
  if (context.custom && typeof context.custom === "object") {
    if (context.custom[stripped] !== undefined) {
      const val = Number(context.custom[stripped]);
      return Number.isFinite(val) ? val : 0;
    }
  }
  if (context.customValues && typeof context.customValues === "object") {
    if (context.customValues[stripped] !== undefined) {
      const val = Number(context.customValues[stripped]);
      return Number.isFinite(val) ? val : 0;
    }
  }

  // Known HR context aliases
  if (resolvedKey === "workedDays") {
    const val = context.reconciledDays ?? context.actualWorkDays ?? context.workedDays;
    if (val !== undefined) return Number(val) || 0;
  }
  if (resolvedKey === "standardDays") {
    const val = context.standardWorkDays ?? context.standardDays;
    if (val !== undefined) return Number(val) || 0;
  }
  if (resolvedKey === "workedHours") {
    const val = context.reconciledHours ?? context.actualWorkHours ?? context.workedHours;
    if (val !== undefined) return Number(val) || 0;
  }
  if (resolvedKey === "monthlySalary") {
    const val = context.agreedSalary ?? context.monthlySalary ?? context.baseSalary;
    if (val !== undefined) return Number(val) || 0;
  }
  if (resolvedKey === "overtimeHours") {
    const val = context.overtimeHours ?? context.otHours ?? 0;
    return Number(val) || 0;
  }
  if (resolvedKey === "commission") {
    const val = context.commission ?? context.salesCommission ?? 0;
    return Number(val) || 0;
  }

  return 0;
}

/**
 * Applies rounding according to mode and unit.
 */
export function applyRounding(
  value: number,
  mode?: PayrollCustomColumnRoundingMode,
  unit: number = 1
): number {
  if (!Number.isFinite(value)) return 0;
  if (!mode || mode === "none" || unit <= 0) return value;
  const factor = unit;
  if (mode === "nearest") return Math.round(value / factor) * factor;
  if (mode === "up") return Math.ceil(value / factor) * factor;
  if (mode === "down") return Math.floor(value / factor) * factor;
  return value;
}

export type TokenType = "NUMBER" | "IDENT" | "OP" | "LPAREN" | "RPAREN";

export interface FormulaToken {
  type: TokenType;
  value: string;
}

/**
 * Tokenizes an arithmetic expression string with support for brackets, numbers,
 * operators (+, -, *, /, %), parentheses, and variable names.
 */
export function tokenizeFormula(expr: string): FormulaToken[] {
  if (!expr || !expr.trim()) return [];

  // Normalize unicode operators: ÷ -> /, × -> *, · -> *
  const normalized = expr
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/·/g, "*");

  const tokens: FormulaToken[] = [];
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%") {
      // Unary minus detection: if '-' is preceded by nothing, an OP, or LPAREN
      if (ch === "-") {
        const prev = tokens[tokens.length - 1];
        if (!prev || prev.type === "OP" || prev.type === "LPAREN") {
          tokens.push({ type: "NUMBER", value: "0" });
          tokens.push({ type: "OP", value: "-" });
          i++;
          continue;
        }
      }
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }

    // Bracketed identifier: [Lương cơ bản] or [custom.sales]
    if (ch === "[") {
      const closeIdx = normalized.indexOf("]", i);
      if (closeIdx !== -1) {
        const ident = normalized.slice(i + 1, closeIdx).trim();
        tokens.push({ type: "IDENT", value: ident });
        i = closeIdx + 1;
        continue;
      }
    }

    // Numbers: integer or decimal, e.g. 100, 26.5, 0.05, 5%
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(normalized[i + 1] || ""))) {
      let numStr = "";
      while (i < normalized.length && /[0-9._]/.test(normalized[i])) {
        if (normalized[i] !== "_") numStr += normalized[i];
        i++;
      }
      // Trailing percent sign (e.g. 10% -> 0.1)
      if (i < normalized.length && normalized[i] === "%") {
        const val = Number(numStr) / 100;
        tokens.push({ type: "NUMBER", value: String(val) });
        i++;
      } else {
        tokens.push({ type: "NUMBER", value: numStr });
      }
      continue;
    }

    // Identifiers: letters, digits, underscores, dots (e.g. monthlySalary, custom.sales, kpi_bonus)
    if (/[a-zA-Z_À-ỹ]/.test(ch)) {
      let ident = "";
      while (i < normalized.length && /[a-zA-Z0-9_À-ỹ.]/.test(normalized[i])) {
        ident += normalized[i];
        i++;
      }
      tokens.push({ type: "IDENT", value: ident });
      continue;
    }

    // Skip any unrecognized characters
    i++;
  }

  return tokens;
}

/**
 * Validates a formula expression string and checks for syntax errors or unmatched parentheses.
 */
export function validateFormulaExpression(expr: string): { valid: boolean; error?: string } {
  if (!expr || !expr.trim()) {
    return { valid: false, error: "Công thức không được để trống" };
  }

  const tokens = tokenizeFormula(expr);
  if (tokens.length === 0) {
    return { valid: false, error: "Công thức không chứa giá trị tính toán hợp lệ" };
  }

  let parenDepth = 0;
  let lastType: TokenType | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === "LPAREN") {
      parenDepth++;
    } else if (tok.type === "RPAREN") {
      parenDepth--;
      if (parenDepth < 0) {
        return { valid: false, error: "Dư dấu đóng ngoặc ')'" };
      }
      if (lastType === "OP") {
        return { valid: false, error: `Thiếu giá trị trước dấu đóng ngoặc` };
      }
    } else if (tok.type === "OP") {
      if (lastType === "OP") {
        return { valid: false, error: `Hai phép tính đứng liền nhau: '${tokens[i - 1].value} ${tok.value}'` };
      }
      if (i === tokens.length - 1) {
        return { valid: false, error: `Chưa có giá trị sau phép tính '${tok.value}'` };
      }
    }

    lastType = tok.type;
  }

  if (parenDepth !== 0) {
    return { valid: false, error: "Dấu ngoặc đơn chưa đóng đầy đủ" };
  }

  if (lastType === "OP") {
    return { valid: false, error: "Công thức không thể kết thúc bằng một phép tính" };
  }

  return { valid: true };
}

/**
 * Safely evaluates tokens using the Shunting-Yard algorithm.
 * Division by zero returns 0 safely.
 */
export function evaluateFormulaTokens(tokens: FormulaToken[], context: Record<string, any>): number {
  if (!tokens || tokens.length === 0) return 0;

  const values: number[] = [];
  const ops: string[] = [];

  const precedence = (op: string) => {
    if (op === "+" || op === "-") return 1;
    if (op === "*" || op === "/" || op === "%") return 2;
    return 0;
  };

  const applyOp = (op: string, b: number, a: number): number => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? 0 : a / b;
      case "%": return b === 0 ? 0 : (a * b) / 100;
      default: return 0;
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === "NUMBER") {
      values.push(Number(tok.value) || 0);
    } else if (tok.type === "IDENT") {
      values.push(resolveSourceValue(tok.value, context));
    } else if (tok.type === "LPAREN") {
      ops.push("(");
    } else if (tok.type === "RPAREN") {
      while (ops.length && ops[ops.length - 1] !== "(") {
        const op = ops.pop()!;
        const b = values.pop() ?? 0;
        const a = values.pop() ?? 0;
        values.push(applyOp(op, b, a));
      }
      if (ops.length && ops[ops.length - 1] === "(") {
        ops.pop(); // discard '('
      }
    } else if (tok.type === "OP") {
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        precedence(ops[ops.length - 1]) >= precedence(tok.value)
      ) {
        const op = ops.pop()!;
        const b = values.pop() ?? 0;
        const a = values.pop() ?? 0;
        values.push(applyOp(op, b, a));
      }
      ops.push(tok.value);
    }
  }

  while (ops.length) {
    const op = ops.pop()!;
    if (op === "(" || op === ")") continue;
    const b = values.pop() ?? 0;
    const a = values.pop() ?? 0;
    values.push(applyOp(op, b, a));
  }

  const result = values.pop() ?? 0;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Evaluates an expression string with source substitution and zero-division protection.
 */
export function evaluateFormulaExpression(expression: string, context: Record<string, any>): number {
  const tokens = tokenizeFormula(expression);
  return evaluateFormulaTokens(tokens, context);
}

/**
 * Evaluates a custom column value for a single employee context.
 * If the column is manual, returns defaultValue.
 * If calculated:
 * - If expression is provided, parses and evaluates the multi-term expression.
 * - Else falls back to legacy binary operation.
 * Applies rounding at the end.
 */
export function calculateCustomColumnValue(
  variable: Pick<IPayrollCustomVariable, "columnType" | "defaultValue" | "calculation">,
  context: Record<string, any>
): number {
  if (variable.columnType !== "calculated" || !variable.calculation) {
    const fallback = Number(variable.defaultValue ?? 0);
    return Number.isFinite(fallback) ? fallback : 0;
  }

  const calc = variable.calculation;
  let raw = 0;

  if (calc.expression && calc.expression.trim()) {
    raw = evaluateFormulaExpression(calc.expression, context);
  } else if (calc.leftSource && calc.operator) {
    const left = resolveSourceValue(calc.leftSource, context);
    const right = calc.rightType === "source"
      ? resolveSourceValue(calc.rightSource ?? "", context)
      : Number(calc.rightValue ?? 0);

    switch (calc.operator as PayrollCustomColumnOperator) {
      case "add":
        raw = left + right;
        break;
      case "subtract":
        raw = left - right;
        break;
      case "multiply":
        raw = left * right;
        break;
      case "divide":
        raw = right === 0 ? 0 : left / right;
        break;
      case "percent":
        raw = left * (right / 100);
        break;
      default:
        raw = left;
    }
  } else {
    raw = Number(variable.defaultValue ?? 0);
  }

  if (!Number.isFinite(raw)) return 0;
  return applyRounding(raw, calc.roundingMode, calc.roundingUnit ?? 1);
}
