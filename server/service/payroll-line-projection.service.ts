import { calculateProgressiveTax } from "./payroll-vietnam.service";
import { PAYROLL_LINE_OVERRIDE_FIELDS, type PayrollLineOverrideValues, type PayrollLineSystemValues } from "../interface/payroll-line-override.interface";
import { resolvePayrollLineOverride } from "./payroll-line-override-resolver.service";

const amount = (value: unknown) => {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
};

const insuranceFundAmount = (vietnam: any, code: string) => {
  const funds = Array.isArray(vietnam?.insurance?.funds) ? vietnam.insurance.funds : [];
  return amount(funds.find((fund: any) => fund.code === code)?.employeeAmount);
};

/** Adapts an immutable calculation snapshot to the manual-override component contract. */
export function normalizePayrollLineSystemValues(line: any): PayrollLineSystemValues {
  const calculation = line?.calculation ?? {};
  const vietnam = line?.vietnam ?? calculation.vietnam ?? {};
  const adjustments = amount(calculation.adjustments);
  const commission = amount(calculation.commission);
  const adjustedBase = amount(calculation.adjustedBase) - (calculation.commissionIncludedInBase === 0 ? 0 : commission);
  const overtime = amount(calculation.overtime);
  const bonusTotal = amount(
    calculation.bonusTotal
      ?? vietnam?.income?.bonuses
      ?? (amount(calculation.bonuses) + Math.max(adjustments, 0)),
  );
  const penaltyTotal = amount(calculation.penaltyTotal ?? Math.max(-adjustments, 0));
  const gross = amount(calculation.gross ?? vietnam?.income?.totalIncome);
  const otherDeductions = amount(
    calculation.otherDeductions
      ?? Math.max(0, amount(vietnam?.deductions?.other) - penaltyTotal),
  );

  return {
    baseSalary: amount(calculation.baseSalary ?? calculation.monthlySalary),
    adjustedBase,
    commission,
    overtime,
    bonusTotal,
    penaltyTotal,
    socialInsurance: amount(calculation.socialInsurance ?? insuranceFundAmount(vietnam, "social")),
    healthInsurance: amount(calculation.healthInsurance ?? insuranceFundAmount(vietnam, "health")),
    unemploymentInsurance: amount(calculation.unemploymentInsurance ?? insuranceFundAmount(vietnam, "unemployment")),
    personalIncomeTax: amount(calculation.personalIncomeTax ?? vietnam?.tax?.tax),
    otherDeductions,
    advances: amount(calculation.advances ?? vietnam?.deductions?.advances),
    hiddenIncome: Math.max(0, gross - adjustedBase - commission - overtime - bonusTotal),
  };
}

const overrideProjection = (override: any): PayrollLineOverrideValues => {
  if (!override) return {};
  const values: PayrollLineOverrideValues = {};
  for (const field of PAYROLL_LINE_OVERRIDE_FIELDS) {
    if (override[field] !== undefined) values[field] = amount(override[field]);
  }
  if (override.customValues !== undefined) {
    const customValues = override.customValues instanceof Map
      ? Object.fromEntries(override.customValues.entries())
      : { ...override.customValues };
    values.customValues = Object.fromEntries(
      Object.entries(customValues).map(([key, value]) => [key, amount(value)]),
    );
  }
  return values;
};

const emptySystemValues = (): PayrollLineSystemValues => ({
  baseSalary: 0,
  adjustedBase: 0,
  overtime: 0,
  bonusTotal: 0,
  penaltyTotal: 0,
  socialInsurance: 0,
  healthInsurance: 0,
  unemploymentInsurance: 0,
  personalIncomeTax: 0,
  otherDeductions: 0,
  advances: 0,
  hiddenIncome: 0,
  commission: 0,
  customValues: {},
});

const PERIOD_INPUT_CORE_FIELDS = new Set([
  "agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction",
]);

const stableSegmentKey = (line: any) => JSON.stringify([
  line?.effectiveSegments?.[0]?.start ?? "",
  ...(Array.isArray(line?.sourceIds) ? line.sourceIds : []),
]);

function aggregatePayrollCustomValues(lines: any[]) {
  const ordered = [...lines].sort((left, right) => (
    amount(right?.periodInput?.version) - amount(left?.periodInput?.version)
    || stableSegmentKey(left).localeCompare(stableSegmentKey(right))
  ));
  const values: Record<string, number> = {};
  for (const line of ordered) {
    for (const [storedKey, storedValue] of Object.entries(line?.periodInput?.values ?? {})) {
      const code = storedKey.startsWith("custom.") ? storedKey.slice("custom.".length) : storedKey;
      if (!code || PERIOD_INPUT_CORE_FIELDS.has(storedKey) || Object.prototype.hasOwnProperty.call(values, code)) continue;
      values[code] = amount(storedValue);
    }
  }
  return values;
}

const aggregatePayrollLineSystemValues = (lines: any[]) => {
  const total = lines.reduce((result, line) => {
    const values = normalizePayrollLineSystemValues(line);
    for (const field of [...PAYROLL_LINE_OVERRIDE_FIELDS, "hiddenIncome"] as const) {
      result[field] = amount(result[field]) + amount(values[field]);
    }
    return result;
  }, emptySystemValues());
  total.customValues = aggregatePayrollCustomValues(lines);
  return total;
};

const aggregateMetadata = (segmentLines: any[]) => {
  const first = segmentLines[0] ?? {};
  const payment = segmentLines.find((line) => line?.payment)?.payment;
  const selectedPeriodInput = [...segmentLines].sort((left, right) => (
    amount(right?.periodInput?.version) - amount(left?.periodInput?.version)
    || stableSegmentKey(left).localeCompare(stableSegmentKey(right))
  ))[0]?.periodInput;
  return {
    attendance: first.attendance,
    formulaVersion: first.formulaVersion ?? first.vietnam?.formulaVersion ?? "legacy",
    ...(first.policyId !== undefined ? { policyId: first.policyId } : {}),
    ...(first.policyVersion !== undefined ? { policyVersion: first.policyVersion } : {}),
    ...(first.policyCode !== undefined ? { policyCode: first.policyCode } : {}),
    ...(first.policyName !== undefined ? { policyName: first.policyName } : {}),
    sourceIds: [...new Set(segmentLines.flatMap((line) => line.sourceIds ?? []))],
    effectiveSegments: segmentLines.flatMap((line) => line.effectiveSegments ?? []),
    warnings: [...new Set(segmentLines.flatMap((line) => line.warnings ?? []))],
    ...(selectedPeriodInput !== undefined ? { periodInput: selectedPeriodInput } : {}),
    ...(payment !== undefined ? { payment: { ...payment } } : {}),
  };
};

const effectiveVietnam = (segmentLines: any[], values: PayrollLineSystemValues, deductionTotal: number, net: number, recalculateTax: boolean) => {
  const sources = segmentLines.map((line) => line?.vietnam).filter(Boolean);
  const source = sources[0];
  if (!source) return undefined;
  const sum = (read: (item: any) => unknown) => sources.reduce((total, item) => total + amount(read(item)), 0);

  const fundsByCode = new Map<string, any>();
  for (const item of sources) {
    for (const fund of Array.isArray(item?.insurance?.funds) ? item.insurance.funds : []) {
      const code = String(fund.code ?? "");
      if (!code) continue;
      const aggregate = fundsByCode.get(code) ?? { ...fund, base: 0, employeeAmount: 0, employerAmount: 0 };
      aggregate.base += amount(fund.base);
      aggregate.employeeAmount += amount(fund.employeeAmount);
      aggregate.employerAmount += amount(fund.employerAmount);
      fundsByCode.set(code, aggregate);
    }
  }
  const funds = [...fundsByCode.values()].map((fund) => ({
    ...fund,
    employeeAmount: fund.code === "social" ? values.socialInsurance
      : fund.code === "health" ? values.healthInsurance
        : fund.code === "unemployment" ? values.unemploymentInsurance
          : fund.employeeAmount,
  }));
  const employeeInsurance = funds.length
    ? funds.reduce((total, fund) => total + amount(fund.employeeAmount), 0)
    : sum((item) => item?.insurance?.employeeTotal);
  const employerInsurance = funds.length
    ? funds.reduce((total, fund) => total + amount(fund.employerAmount), 0)
    : sum((item) => item?.insurance?.employerTotal);

  const taxDeductions = {
    personal: sum((item) => item?.tax?.deductions?.personal),
    dependents: sum((item) => item?.tax?.deductions?.dependents),
    insurance: employeeInsurance,
    other: sum((item) => item?.tax?.deductions?.other),
    total: 0,
  };
  taxDeductions.total = taxDeductions.personal + taxDeductions.dependents + taxDeductions.insurance + taxDeductions.other;

  const bracketsByKey = new Map<string, any>();
  for (const item of sources) {
    for (const bracket of Array.isArray(item?.tax?.brackets) ? item.tax.brackets : []) {
      const key = JSON.stringify([bracket.upTo ?? null, amount(bracket.rate)]);
      const aggregate = bracketsByKey.get(key) ?? { ...bracket, taxableAmount: 0, tax: 0 };
      aggregate.taxableAmount += amount(bracket.taxableAmount);
      aggregate.tax += amount(bracket.tax);
      bracketsByKey.set(key, aggregate);
    }
  }

  const gross = values.adjustedBase + amount(values.commission) + values.overtime + values.bonusTotal + values.hiddenIncome;
  const sourceTax = source.tax ?? {};
  const assessableIncome = recalculateTax
    ? Math.max(0, values.adjustedBase + amount(values.commission) + values.overtime + values.bonusTotal
      + sum((item) => item?.income?.taxableAllowances) - taxDeductions.total)
    : sum((item) => item?.tax?.assessableIncome);
  const taxMethod = sourceTax.method ?? "progressive";
  const schedule = Array.isArray(sourceTax.schedule) ? sourceTax.schedule : sourceTax.brackets;
  const progressive = recalculateTax && taxMethod === "progressive" && Array.isArray(schedule)
    ? calculateProgressiveTax(schedule.map((item: any) => ({ upTo: item.upTo, rate: amount(item.rate) })), assessableIncome)
    : undefined;
  const effectiveTax = progressive?.tax ?? values.personalIncomeTax;
  const employerOtherCosts = sources.reduce((total, item) => total + Math.max(
    0,
    amount(item?.employerCost) - amount(item?.income?.totalIncome) - amount(item?.insurance?.employerTotal),
  ), 0);
  return {
    ...source,
    workPay: values.adjustedBase + amount(values.commission),
    overtime: {
      ...(source.overtime ?? {}),
      details: sources.flatMap((item) => Array.isArray(item?.overtime?.details) ? item.overtime.details : []),
      total: values.overtime,
    },
    income: {
      ...(source.income ?? {}),
      taxableAllowances: sum((item) => item?.income?.taxableAllowances),
      exemptAllowances: sum((item) => item?.income?.exemptAllowances),
      bonuses: values.bonusTotal,
      totalIncome: gross,
      taxableIncome: sum((item) => item?.income?.taxableIncome),
    },
    insurance: { ...(source.insurance ?? {}), funds, employeeTotal: employeeInsurance, employerTotal: employerInsurance },
    tax: {
      ...sourceTax,
      deductions: taxDeductions,
      assessableIncome,
      brackets: progressive?.details ?? [...bracketsByKey.values()],
      tax: effectiveTax,
    },
    deductions: {
      ...(source.deductions ?? {}),
      other: values.otherDeductions + values.penaltyTotal,
      advances: values.advances,
      total: deductionTotal,
    },
    netPay: net,
    carryForward: Math.max(0, deductionTotal - gross),
    employerCost: gross + employerInsurance + employerOtherCosts,
    warnings: sources.flatMap((item) => Array.isArray(item?.warnings) ? item.warnings : []),
  };
};

export function projectPayrollEmployeeWithOverride(segmentLines: any[], override?: any) {
  const systemValues = aggregatePayrollLineSystemValues(segmentLines);
  const overrideValues = overrideProjection(override);
  const resolved = resolvePayrollLineOverride(systemValues, overrideValues);
  const gross = resolved.values.adjustedBase
    + amount(resolved.values.commission)
    + resolved.values.overtime
    + resolved.values.bonusTotal
    + resolved.values.hiddenIncome;
  const taxDrivingFields = ["adjustedBase", "commission", "overtime", "bonusTotal", "socialInsurance", "healthInsurance", "unemploymentInsurance"] as const;
  const recalculateTax = overrideValues.personalIncomeTax === undefined
    && taxDrivingFields.some((field) => overrideValues[field] !== undefined);
  const vietnam = effectiveVietnam(segmentLines, resolved.values, resolved.deductionTotal, resolved.net, recalculateTax);
  const effectiveTax = amount(vietnam?.tax?.tax ?? resolved.values.personalIncomeTax);
  const effectiveValues = { ...resolved.values, personalIncomeTax: effectiveTax };
  const deductionTotal = resolved.deductionTotal - resolved.values.personalIncomeTax + effectiveTax;
  const net = Math.max(0, Math.round(gross - deductionTotal));
  const calculation = {
    ...(segmentLines[0]?.calculation ?? {}),
    monthlySalary: resolved.values.baseSalary,
    baseSalary: resolved.values.baseSalary,
    adjustedBase: resolved.values.adjustedBase,
    commission: amount(resolved.values.commission),
    commissionIncludedInBase: 0,
    overtime: resolved.values.overtime,
    bonuses: resolved.values.bonusTotal,
    bonusTotal: resolved.values.bonusTotal,
    penaltyTotal: resolved.values.penaltyTotal,
    socialInsurance: resolved.values.socialInsurance,
    healthInsurance: resolved.values.healthInsurance,
    unemploymentInsurance: resolved.values.unemploymentInsurance,
    personalIncomeTax: effectiveTax,
    otherDeductions: resolved.values.otherDeductions,
    advances: resolved.values.advances,
    gross,
    deductions: deductionTotal,
    net,
  };
  if (vietnam) vietnam.deductions.total = deductionTotal;
  if (vietnam) vietnam.netPay = net;
  return {
    employeeId: String(segmentLines[0]?.employeeId ?? override?.employeeId ?? ""),
    ...(segmentLines[0]?.employeeName ? { employeeName: segmentLines[0].employeeName } : {}),
    ...aggregateMetadata(segmentLines),
    calculation,
    vietnam,
    segmentLines,
    systemValues,
    overrideValues,
    effectiveValues,
    overrideVersion: amount(override?.version),
    deductionTotal,
    net,
    provenance: resolved.provenance,
  };
}

export function projectPayrollRevisionWithOverrides(revision: any, overrides: any[]) {
  const overrideByEmployee = new Map(overrides.map((item) => [String(item.employeeId), item]));
  const lines = revision?.lines ?? [];
  const linesByEmployee = new Map<string, any[]>();
  for (const line of lines) {
    const employeeId = String(line.employeeId);
    linesByEmployee.set(employeeId, [...(linesByEmployee.get(employeeId) ?? []), line]);
  }
  return {
    ...revision,
    lines,
    effectiveLines: [...linesByEmployee.entries()].map(([employeeId, segmentLines]) => (
      projectPayrollEmployeeWithOverride(segmentLines, overrideByEmployee.get(employeeId))
    )),
  };
}
