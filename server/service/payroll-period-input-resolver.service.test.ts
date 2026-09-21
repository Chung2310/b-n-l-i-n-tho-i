import { describe, expect, it } from "vitest";
import { resolvePayrollPeriodInputs } from "./payroll-period-input-resolver.service";

describe("resolvePayrollPeriodInputs", () => {
  const source = { agreedSalary: 20_000_000, reconciledDays: 24, reconciledHours: 192, allowance: 500_000, bonus: 300_000, deduction: 100_000 };
  it("preserves explicit zero and falls back only for absent fields", () => {
    const result = resolvePayrollPeriodInputs(source, { agreedSalary: 0, bonus: undefined }, []);
    expect(result.values.agreedSalary).toBe(0);
    expect(result.provenance.agreedSalary).toBe("period_override");
    expect(result.values.bonus).toBe(300_000);
    expect(result.provenance.bonus).toBe("system");
  });
  it("uses custom overrides then defaults and reports missing variables", () => {
    const result = resolvePayrollPeriodInputs(source, { customValues: { sales: 0 } }, [{ code: "sales", defaultValue: 10 }, { code: "quality" }]);
    expect(result.customValues["custom.sales"]).toEqual({ value: 0, provenance: "period_override" });
    expect(result.missing).toEqual(["custom.quality"]);
  });

  it("dynamically evaluates calculated custom variables from employee context and prior variables", () => {
    const variables: any[] = [
      { code: "sales", defaultValue: 10_000_000, columnType: "manual" },
      {
        code: "bonus_commission",
        columnType: "calculated",
        calculation: {
          leftSource: "custom.sales",
          operator: "percent",
          rightType: "value",
          rightValue: 10, // 10% of sales = 1_000_000
        },
      },
      {
        code: "daily_pay",
        columnType: "calculated",
        calculation: {
          leftSource: "monthlySalary",
          operator: "divide",
          rightType: "source",
          rightSource: "standardDays",
          roundingMode: "nearest",
          roundingUnit: 1000,
        },
      },
    ];

    const context = { monthlySalary: 26_000_000, standardDays: 26 };
    const result = resolvePayrollPeriodInputs(source, {}, variables, context);

    expect(result.customValues["custom.sales"]).toEqual({ value: 10_000_000, provenance: "default" });
    expect(result.customValues["custom.bonus_commission"]).toEqual({ value: 1_000_000, provenance: "system" });
    expect(result.customValues["custom.daily_pay"]).toEqual({ value: 1_000_000, provenance: "system" });
  });

  it("evaluates complex multi-term formula expressions in resolver", () => {
    const variables: any[] = [
      {
        code: "real_salary",
        columnType: "calculated",
        calculation: {
          expression: "(monthlySalary / standardDays) * workedDays + 500000",
          roundingMode: "nearest",
          roundingUnit: 1000,
        },
      },
    ];

    const context = { monthlySalary: 26_000_000, standardDays: 26, workedDays: 20 };
    const result = resolvePayrollPeriodInputs(source, {}, variables, context);

    // 26M / 26 * 20 + 500k = 20M + 500k = 20_500_000
    expect(result.customValues["custom.real_salary"]).toEqual({ value: 20_500_000, provenance: "system" });
  });
});
