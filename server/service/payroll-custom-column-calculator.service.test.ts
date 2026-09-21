import { describe, expect, it } from "vitest";
import {
  calculateCustomColumnValue,
  evaluateFormulaExpression,
  resolveSourceValue,
  tokenizeFormula,
  validateFormulaExpression,
} from "./payroll-custom-column-calculator.service";

describe("payroll-custom-column-calculator.service", () => {
  const context = {
    monthlySalary: 26_000_000,
    agreedSalary: 26_000_000,
    workedDays: 20,
    reconciledDays: 20,
    standardDays: 26,
    overtimeHours: 10,
    commission: 3_000_000,
    custom: {
      sales: 100_000_000,
      kpi_score: 1.2,
    },
  };

  it("resolves built-in and custom sources correctly", () => {
    expect(resolveSourceValue("monthlySalary", context)).toBe(26_000_000);
    expect(resolveSourceValue("workedDays", context)).toBe(20);
    expect(resolveSourceValue("standardDays", context)).toBe(26);
    expect(resolveSourceValue("overtimeHours", context)).toBe(10);
    expect(resolveSourceValue("custom.sales", context)).toBe(100_000_000);
    expect(resolveSourceValue("sales", context)).toBe(100_000_000);
    expect(resolveSourceValue("Lương cơ bản", context)).toBe(26_000_000);
    expect(resolveSourceValue("Công chuẩn", context)).toBe(26);
  });

  it("evaluates complex multi-term expressions like (monthlySalary / standardDays) * workedDays", () => {
    // 26_000_000 / 26 * 20 = 20_000_000
    const expr = "(monthlySalary / standardDays) * workedDays";
    expect(evaluateFormulaExpression(expr, context)).toBe(20_000_000);
  });

  it("evaluates complex formula: (monthlySalary / standardDays / 8) * overtimeHours * 1.5", () => {
    // 26_000_000 / 26 = 1_000_000 / 8 = 125_000 * 10 = 1_250_000 * 1.5 = 1_875_000
    const expr = "(monthlySalary / standardDays / 8) * overtimeHours * 1.5";
    expect(evaluateFormulaExpression(expr, context)).toBe(1_875_000);
  });

  it("supports unicode math symbols ÷ and ×", () => {
    const expr = "(monthlySalary ÷ standardDays) × workedDays";
    expect(evaluateFormulaExpression(expr, context)).toBe(20_000_000);
  });

  it("supports bracketed Vietnamese aliases: [Lương cơ bản] ÷ [Công chuẩn] × [Ngày công]", () => {
    const expr = "([Lương cơ bản] ÷ [Công chuẩn]) × [Ngày công]";
    expect(evaluateFormulaExpression(expr, context)).toBe(20_000_000);
  });

  it("supports multiple operations chaining additions, subtractions, and percentages", () => {
    // 100_000_000 * 0.05 + 3_000_000 - 500_000 = 5_000_000 + 3_000_000 - 500_000 = 7_500_000
    const expr = "(custom.sales * 5%) + commission - 500000";
    expect(evaluateFormulaExpression(expr, context)).toBe(7_500_000);
  });

  it("handles division by zero safely without throwing or NaN", () => {
    const exprZero = "(monthlySalary / 0) * workedDays + 500000";
    expect(evaluateFormulaExpression(exprZero, context)).toBe(500000);
  });

  it("validates formula syntax correctly", () => {
    expect(validateFormulaExpression("(monthlySalary / standardDays) * workedDays").valid).toBe(true);
    expect(validateFormulaExpression("(monthlySalary / standardDays").valid).toBe(false);
    expect(validateFormulaExpression("monthlySalary +").valid).toBe(false);
    expect(validateFormulaExpression("monthlySalary + * 2").valid).toBe(false);
  });

  it("applies rounding mode to expression results", () => {
    // 26_000_000 / 26 = 1_000_000. For workedDays = 21.3 -> 21_300_000
    const ctx = { ...context, workedDays: 21.33333333 };
    const variable = {
      columnType: "calculated" as const,
      calculation: {
        expression: "(monthlySalary / standardDays) * workedDays",
        roundingMode: "nearest" as const,
        roundingUnit: 1000,
      },
    };
    const val = calculateCustomColumnValue(variable, ctx);
    expect(val % 1000).toBe(0);
  });
});
