import { calculatePayrollChecksum } from "./payroll-checksum.service";
import { calculateDetailedPayroll, calculateDetailedPayrollBatch, type DetailedCalculationInput } from "./payroll-detailed-calculation.service";
export { calculateDetailedPayroll, calculateDetailedPayrollBatch, type DetailedCalculationInput } from "./payroll-detailed-calculation.service";

export async function runPayrollRevision(args: {
  revision: { create: (value: any) => Promise<any>; update: (id: string, value: any) => Promise<any> };
  run: { activateRevision: (id: string) => Promise<void> };
  input: DetailedCalculationInput;
}) {
  const started = await args.revision.create({ status: "running", lines: [], totals: { grossPay: 0, deductions: 0, netPay: 0 } });
  try {
    const calculated = calculateDetailedPayroll(args.input);
    const completed = await args.revision.update(started.id, { status: "completed", lines: calculated.lines, totals: calculated.totals, issues: calculated.issues });
    await args.run.activateRevision(started.id);
    return { ...completed, status: "completed" as const };
  } catch (error) {
    await args.revision.update(started.id, { status: "failed", issues: [{ code: "PAYROLL_CALCULATION_FAILED", message: error instanceof Error ? error.message : "Payroll calculation failed", severity: "blocking" }] });
    return { ...started, status: "failed" as const };
  }
}
export async function calculateRun(args: {
  idempotencyKey?: string;
  idempotency?: { get: (key: string) => Promise<any>; save: (key: string, result: any) => Promise<void> };
  run: { get: () => Promise<any>; activateRevision?: (id: string, expectedVersion: number, checksum: string) => Promise<any> };
  revision: { nextRevision: (runId: string) => Promise<number>; create: (value: any) => Promise<any>; update: (id: string, value: any) => Promise<any> };
  input: () => Promise<DetailedCalculationInput | DetailedCalculationInput[]>;
  expectedVersion: number;
}) {
  if (args.idempotencyKey && args.idempotency) { const replay = await args.idempotency.get(args.idempotencyKey); if (replay?.result) return replay.result; }
  const run = await args.run.get();
  if (!run) return { code: "PAYROLL_RUN_NOT_FOUND" };
  if (run.version !== args.expectedVersion) return { code: "PAYROLL_VERSION_CONFLICT", currentVersion: run.version };
  if (run.status !== "draft") return { code: "PAYROLL_RUN_STATE_INVALID", status: run.status };
  const runId = run.id ?? (run._id === undefined ? undefined : String(run._id));
  const revision = await args.revision.nextRevision(runId);
  const started = await args.revision.create({ runId, revision, status: "running", lines: [], totals: { grossPay: 0, deductions: 0, netPay: 0 }, issues: [] });
  try {
    const input = await args.input();
    const calculated = calculateDetailedPayrollBatch(Array.isArray(input) ? input : [input]);
    const checksum = calculatePayrollChecksum({ lines: calculated.lines, totals: calculated.totals });
    const completed = await args.revision.update(started.id, { status: "completed", lines: calculated.lines, totals: calculated.totals, issues: calculated.issues, checksum });
    if (args.run.activateRevision) {
      const activated = await args.run.activateRevision(started.id, args.expectedVersion, checksum);
      if (activated === null) return { code: "PAYROLL_VERSION_CONFLICT", currentVersion: run.version };
    }
    if (args.idempotencyKey && args.idempotency) await args.idempotency.save(args.idempotencyKey, completed);
    return completed;
  } catch (error) {
    await args.revision.update(started.id, { status: "failed", issues: [{ code: "PAYROLL_CALCULATION_FAILED", message: error instanceof Error ? error.message : "Payroll calculation failed", severity: "blocking" }] });
    return { code: "PAYROLL_CALCULATION_FAILED", revisionId: started.id };
  }
}
