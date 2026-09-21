import type { PayrollInputProvenance, PayrollPeriodInputValues } from "../interface/payroll-period-input.interface";
import { calculateCustomColumnValue } from "./payroll-custom-column-calculator.service";
type CoreKey = "agreedSalary" | "reconciledDays" | "reconciledHours" | "allowance" | "bonus" | "deduction";
const keys: CoreKey[] = ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"];

export function resolvePayrollPeriodInputs(
  source: Record<CoreKey, number>,
  override: PayrollPeriodInputValues = {},
  variables: Array<{ code: string; defaultValue?: number; columnType?: string; calculation?: any }> = [],
  employeeContext: Record<string, any> = {}
) {
  const values = {} as Record<CoreKey, number>, provenance = {} as Record<CoreKey, PayrollInputProvenance>;
  keys.forEach((key) => {
    if (override[key] !== undefined) {
      values[key] = override[key]!;
      provenance[key] = "period_override";
    } else {
      values[key] = source[key];
      provenance[key] = "system";
    }
  });

  const customValues: Record<string, { value: number; provenance: PayrollInputProvenance }> = {}, missing: string[] = [];
  const currentContext: Record<string, any> = {
    ...source,
    ...values,
    ...employeeContext,
  };

  variables.forEach((variable) => {
    const key = `custom.${variable.code}`;
    const explicit = override.customValues?.[variable.code];

    if (explicit !== undefined) {
      customValues[key] = { value: explicit, provenance: "period_override" };
      currentContext[key] = explicit;
      currentContext[variable.code] = explicit;
    } else if (variable.columnType === "calculated" && variable.calculation) {
      const calculated = calculateCustomColumnValue({ ...variable, columnType: "calculated" }, currentContext);
      customValues[key] = { value: calculated, provenance: "system" };
      currentContext[key] = calculated;
      currentContext[variable.code] = calculated;
    } else if (variable.defaultValue !== undefined) {
      customValues[key] = { value: variable.defaultValue, provenance: "default" };
      currentContext[key] = variable.defaultValue;
      currentContext[variable.code] = variable.defaultValue;
    } else {
      missing.push(key);
    }
  });

  return { values, provenance, customValues, missing };
}
