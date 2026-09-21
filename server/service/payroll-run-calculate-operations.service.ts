import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollLineOverrideModel } from "../model/payroll-line-override.model";
import { createPayrollRevisionRepositories } from "./payroll-revision.repository";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import { calculateRun } from "./payroll-run-calculation.service";
import { buildRunCalculationInputs } from "./payroll-run-input.service";
import { projectPayrollRevisionWithOverrides } from "./payroll-line-projection.service";

// Compatibility exports for existing controllers and integrations.
export { buildRunCalculationInputs } from "./payroll-run-input.service";
export { normalizePayrollLineSystemValues, projectPayrollEmployeeWithOverride, projectPayrollRevisionWithOverrides } from "./payroll-line-projection.service";

export async function projectPayrollLinesWithStoredOverrides(
  scope: PayrollOperationScope,
  run: { periodKey: string; type?: string },
  lines: any[],
) {
  const employeeIds = [...new Set(lines.map((line) => String(line.employeeId)))];
  if (!employeeIds.length) return [];
  const overrides = run.type === "regular"
    ? await PayrollLineOverrideModel.find({
        ...scope,
        periodKey: run.periodKey,
        employeeId: { $in: employeeIds },
      }).lean()
    : [];
  return projectPayrollRevisionWithOverrides({ lines }, overrides as any[]).effectiveLines;
}

const CALCULATION_ERRORS: Record<string, { message: string; status: number }> = {
  PAYROLL_RUN_NOT_FOUND: { message: "Payroll run not found", status: 404 },
  PAYROLL_VERSION_CONFLICT: { message: "Payroll run version conflict", status: 409 },
  PAYROLL_RUN_STATE_INVALID: { message: "Payroll run must have locked attendance before calculation", status: 409 },
  PAYROLL_CALCULATION_FAILED: { message: "Payroll calculation failed", status: 422 },
};

export async function calculateOperationalRun(
  scope: PayrollOperationScope,
  runId: string,
  actorId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  const repositories = createPayrollRevisionRepositories(scope, runId);
  const replay: any = await repositories.idempotency.get(idempotencyKey);
  if (replay?.result) {
    if (replay.runId && replay.runId !== runId) {
      throw new PayrollOperationError("PAYROLL_IDEMPOTENCY_CONFLICT", "Idempotency key was used for another request", 409);
    }
    const replayed: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
    const revision = replayed?.periodKey
      ? {
          ...replay.result,
          lines: replay.result.lines ?? [],
          effectiveLines: await projectPayrollLinesWithStoredOverrides(scope, replayed, replay.result.lines ?? []),
        }
      : replay.result;
    return { revision, runVersion: replayed?.version };
  }
  const result: any = await calculateRun({
    idempotencyKey,
    idempotency: repositories.idempotency,
    run: repositories.run,
    revision: repositories.revision,
    input: async () => {
      const run = await repositories.run.get();
      return buildRunCalculationInputs(scope, run);
    },
    expectedVersion,
  });

  const failure = result?.code ? CALCULATION_ERRORS[result.code] : undefined;
  if (failure) {
    throw new PayrollOperationError(result.code, failure.message, failure.status, result.currentVersion);
  }
  if (result?.code) {
    throw new PayrollOperationError(result.code, "Payroll calculation failed", 409, result.currentVersion);
  }

  const run: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
  await PayrollAuditModel.create({
    ...scope,
    periodKey: run?.periodKey ?? "",
    action: "calculate",
    actorId,
    metadata: {
      operation: "calculate",
      runId,
      revisionId: String(result?._id ?? result?.id ?? ""),
      lineCount: Array.isArray(result?.lines) ? result.lines.length : 0,
      beforeVersion: expectedVersion,
      afterVersion: run?.version,
    },
  });

  const revision = run?.periodKey
    ? {
        ...result,
        effectiveLines: await projectPayrollLinesWithStoredOverrides(scope, run, result?.lines ?? []),
      }
    : result;
  return { revision, runVersion: run?.version };
}
