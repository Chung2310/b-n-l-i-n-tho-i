export type PayrollInputProvenance = "period_override" | "system" | "default" | "legacy_fallback";
export type PayrollPeriodInputValues = { agreedSalary?: number; reconciledDays?: number; reconciledHours?: number; allowance?: number; bonus?: number; deduction?: number; customValues?: Record<string, number | undefined> };
export interface IPayrollPeriodInput extends PayrollPeriodInputValues { companyCode: string; branchId: string; periodKey: string; employeeId: string; reason: string; version: number; updatedBy: string; }
export type PayrollCustomVariableUnit = "money" | "number" | "days" | "hours" | "minutes" | "percent";
export type PayrollCustomColumnType = "manual" | "calculated";
export type PayrollCustomColumnOperator = "add" | "subtract" | "multiply" | "divide" | "percent";
export type PayrollCustomColumnRoundingMode = "none" | "nearest" | "up" | "down";

export interface PayrollCustomColumnCalculation {
  expression?: string;
  leftSource?: string;
  operator?: PayrollCustomColumnOperator;
  rightType?: "value" | "source";
  rightValue?: number;
  rightSource?: string;
  roundingMode?: PayrollCustomColumnRoundingMode;
  roundingUnit?: number;
}

export interface IPayrollCustomVariable {
  companyCode: string;
  code: string;
  name: string;
  description?: string;
  unit: PayrollCustomVariableUnit;
  defaultValue?: number;
  columnType?: PayrollCustomColumnType;
  calculation?: PayrollCustomColumnCalculation;
  status: "draft" | "active" | "retired";
  version: number;
  createdBy: string;
  activatedBy?: string;
  retiredBy?: string;
}
