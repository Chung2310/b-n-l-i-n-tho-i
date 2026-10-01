import { FinanceCashAccountModel, FinanceCashVoucherModel, FinancePostingGuardModel, FinanceClosedPeriodModel } from "../finance/models/finance-treasury.model";
import { financeTreasuryService } from "../finance/services/finance-treasury.service";
import { financialReportingService } from "../finance/services/financial-reporting.service";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { RepairPartModel } from "../repair/repair-part.model";
import { RepairFeedbackModel } from "../repair/repair-feedback.model";
import { repairRevenueReport, repairTechnicianPerformanceReport, repairPartUsageReport, repairFeedbackSummaryReport } from "../repair/services/repair-report.service";
import { refundRepairCommission, reconcileRepairRefund, revokeRepairRefundRequest } from "../partners/commission.service";
const scope = { companyCode: "REPORT-REPAIR", branchId: "branch-a" };
const range = { from: "2026-09-30", to: "2026-09-30" };
const models = [RepairTicketModel, RepairPartModel, RepairFeedbackModel, FinanceCashAccountModel, FinanceCashVoucherModel, FinancePostingGuardModel, FinanceClosedPeriodModel];
let replica: MongoMemoryReplSet;
let legacyId: string;
const date = (hour: number) => new Date(Date.UTC(2026, 8, 30, hour));
const create = (code: string, extra: any = {}) => RepairTicketModel.create({ ...scope, ticketCode: code, ticketType: "service", customerId: "KH-1", customerName: "Customer", customerPhone: "0901234567", device: { name: "Phone", condition: "Broken" }, coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: date(0) }, symptom: "Screen", status: "delivered", technicianId: "tech-1", technicianName: "Technician", totalAmount: 200, laborFee: 100, partRevenue: 100, partCost: 20, paidAmount: 200, dueAmount: 0, receivedAt: date(1), deliveredAt: date(2), createdBy: "staff", createdByName: "Staff", ...extra });
beforeAll(async () => { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replica.getUri(), { monitorCommands: true }); await Promise.all(models.map(m => (m as any).init())); }, 60000);
beforeEach(async () => {
  vi.restoreAllMocks(); await Promise.all(models.map(m => (m as any).deleteMany({})));
  legacyId = String((await create("LEGACY"))._id);
  const account = await financeTreasuryService.createAccount(scope, { name: "Refund cash", kind: "cash", openingOn: "2026-01-01", openingBalance: 1000 }, "maker");
  const voucher = await financeTreasuryService.createVoucher(scope, { key: "REF-1", kind: "payment", amount: 100, occurredOn: "2026-09-30", description: "Repair refund", reference: "LEGACY", accountId: String(account._id) }, "maker");
  await financeTreasuryService.decide(scope, String(voucher._id), { action: "approve", version: 0 }, "approver");
  await create("MODERN", { receivedAt: date(0), completedAt: date(1), deliveredAt: new Date("2026-10-01"), totalAmount: 300, paidAmount: 300, partCost: 40 });
  await create("OLDER", { completedAt: new Date("2026-09-29T03:00:00Z"), totalAmount: 400 });
  await create("BRANCH-B", { branchId: "branch-b", totalAmount: 500 });
  await create("OTHER", { companyCode: "OTHER", totalAmount: 600 });
  await create("UNFINISHED", { status: "done", totalAmount: 700 });
});
afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });
it("uses a delivery-date fallback without writing historical tickets", async () => {
  const before = await RepairTicketModel.find().sort({ ticketCode: 1 }).lean();
  const writes: string[] = [];
  const listener = (event: any) => { if (["update", "insert", "delete", "findAndModify"].includes(event.commandName)) writes.push(event.commandName); };
  mongoose.connection.getClient().on("commandStarted", listener);
  try {
    const revenue = await repairRevenueReport(scope, range, { includeCost: true });
    expect(revenue.total).toMatchObject({ ticketCount: 2, revenue: 500, collected: 500, partCost: 60, grossProfit: 440 });
    const technicians = await repairTechnicianPerformanceReport(scope, range);
    expect(technicians).toHaveLength(1); expect(technicians[0]).toMatchObject({ ticketCount: 2, revenue: 500, averageMinutes: 60 });
  } finally { mongoose.connection.getClient().off("commandStarted", listener); }
  expect(writes).toEqual([]); expect(await RepairTicketModel.find().sort({ ticketCode: 1 }).lean()).toEqual(before);
});
it("keeps company/branch filters on the fallback and hides cost fields", async () => {
  const local = await repairRevenueReport(scope, range);
  expect(local.total).toMatchObject({ ticketCount: 2, revenue: 500 }); expect(local.total).not.toHaveProperty("partCost"); expect(local.items[0]).not.toHaveProperty("grossProfit");
  const company = await repairRevenueReport({ companyCode: scope.companyCode }, range);
  expect(company.total).toMatchObject({ ticketCount: 3, revenue: 1000 });
});
it("groups fallback timestamps at Vietnamese midnight", async () => {
  await create("MIDNIGHT", { deliveredAt: new Date("2026-09-29T17:00:00Z"), totalAmount: 10 });
  await create("PREVIOUS-DAY", { deliveredAt: new Date("2026-09-29T16:59:59.999Z"), totalAmount: 20 });
  const result = await repairRevenueReport(scope, range, { groupBy: "day" });
  expect(result.items).toHaveLength(1); expect(result.items[0]).toMatchObject({ key: "2026-09-30", revenue: 510 });
});
it("does not assign missing technicians or cross-branch feedback to performance", async () => {
  await create("UNASSIGNED", { technicianId: undefined, technicianName: undefined });
  await RepairFeedbackModel.create({ companyCode: scope.companyCode, branchId: "branch-b", ticketId: legacyId, ticketCode: "LEGACY", rating: 5, submittedAt: date(3) });
  const rows = await repairTechnicianPerformanceReport(scope, range);
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ ticketCount: 2, ratingCount: 0 });
});
it.each([repairRevenueReport, repairTechnicianPerformanceReport, repairPartUsageReport, repairFeedbackSummaryReport])("rejects invalid date ranges before querying", async report => {
  await expect(report(scope, { from: "2026-09-31", to: "2026-10-01" })).rejects.toMatchObject({ statusCode: 400 });
  await expect(report(scope, { from: "2026-10-01", to: "2026-09-30" })).rejects.toMatchObject({ statusCode: 400 });
});
it("rejects an unsupported revenue grouping", async () => {
  await expect(repairRevenueReport(scope, range, { groupBy: "invalid" as any })).rejects.toMatchObject({ statusCode: 400 });
});
const refund = (extra: any = {}, actor = "staff") => refundRepairCommission(scope, legacyId, { amount: 100, laborAmount: 50, reason: "refund", reference: "REF-1", idempotencyKey: "refund-1", ...extra }, actor);
it("serializes matching refund adjustments and rejects changed actor/reason", async () => {
  await Promise.all([refund(), refund()]);
  expect((await RepairTicketModel.findById(legacyId).lean())?.commissionRefunds).toHaveLength(1);
  await expect(refund({ reason: "changed" })).rejects.toMatchObject({ statusCode: 409 });
  await expect(refund({}, "other")).rejects.toMatchObject({ statusCode: 409 });
});
it("rolls back a failed refund and allows the same key to be retried", async () => {
  vi.spyOn(RepairTicketModel.prototype, "save").mockRejectedValueOnce(new Error("injected"));
  await expect(refund()).rejects.toThrow("injected"); expect((await RepairTicketModel.findById(legacyId).lean())?.commissionRefunds).toHaveLength(0);
  await refund(); expect((await RepairTicketModel.findById(legacyId).lean())?.commissionRefunds).toHaveLength(1);
});
it("rejects refund writes without an active transaction", async () => {
  const session = await mongoose.startSession();
  try { await expect(refundRepairCommission(scope, legacyId, { amount: 100, laborAmount: 50, reason: "refund", reference: "REF-1", idempotencyKey: "refund-1" }, "staff", session)).rejects.toMatchObject({ statusCode: 503 }); }
  finally { await session.endSession(); }
  expect((await RepairTicketModel.findById(legacyId).lean())?.commissionRefunds).toHaveLength(0);
});

it("keeps Finance repair profit aligned with repair reporting before and after opening reports", async () => {
  const before = await RepairTicketModel.find().sort({ ticketCode: 1 }).lean();
  const first = await financialReportingService.profit(scope, { from: range.from, to: range.to });
  const repair = await repairRevenueReport(scope, range, { includeCost: true });
  const second = await financialReportingService.profit(scope, { from: range.from, to: range.to });
  expect(first.movements).toEqual(second.movements);
  expect(first.movements).toHaveLength(2);
  expect(first.movements.reduce((sum, row) => sum + row.revenue, 0)).toBe(repair.total.revenue);
  expect(first.movements.reduce((sum, row) => sum + row.cost, 0)).toBe(repair.total.partCost);
  expect(await RepairTicketModel.find().sort({ ticketCode: 1 }).lean()).toEqual(before);
});

it("rolls back a saved refund when commission reconciliation fails", async () => {
  await RepairTicketModel.updateOne({ _id: legacyId }, { $set: { commissionSnapshot: { partnerId: new mongoose.Types.ObjectId().toString(), policy: { repairBps: 1000 }, lines: [{ line: 0, base: 100, amount: 10, rate: 1000, quantity: 1, kind: "repair" }] } } });
  await expect(refund()).rejects.toMatchObject({ statusCode: 404 });
  expect((await RepairTicketModel.findById(legacyId).lean())?.commissionRefunds).toHaveLength(0);
  expect((await FinanceCashVoucherModel.findOne({ key: "REF-1" }))?.sourceKey).toBeUndefined();
});

it("links a posted payment once without spending cash again or exposing an unassigned source", async () => {
  await Promise.all([refund(), refund()]);
  expect((await FinanceCashAccountModel.findOne(scope))?.balance).toBe(900);
  const overview = await financeTreasuryService.overview(scope);
  expect(overview.unassigned).toHaveLength(0);
  expect(overview.sourceChanges).toHaveLength(0);
  const voucher = await FinanceCashVoucherModel.findOne({ key: "REF-1" });
  const original = { key: "REF-1", kind: "payment", amount: 100, occurredOn: "2026-09-30", description: "Repair refund", reference: "LEGACY", accountId: voucher!.accountId };
  expect(String((await financeTreasuryService.createVoucher(scope, original, "maker"))._id)).toBe(String(voucher!._id));
  await expect(financeTreasuryService.createVoucher(scope, { ...original, amount: 101 }, "maker")).rejects.toMatchObject({ status: 409 });
  await expect(refund({ idempotencyKey: "another" })).rejects.toMatchObject({ statusCode: 409 });
  expect((await RepairTicketModel.findById(legacyId))?.commissionRefunds).toHaveLength(1);
});

it("allows only one competing request key to claim the same posted voucher", async () => {
  const results = await Promise.allSettled([refund(), refund({ idempotencyKey: "competing" })]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect((await RepairTicketModel.findById(legacyId))?.commissionRefunds).toHaveLength(1);
  expect((await FinanceCashAccountModel.findOne(scope))?.balance).toBe(900);
});

it("accepts a voucher ID and rejects ambiguity between an ID and another voucher key", async () => {
  const voucher = await FinanceCashVoucherModel.findOne({ key: "REF-1" });
  const reference = String(voucher!._id);
  const copy = voucher!.toObject();
  const duplicate = await FinanceCashVoucherModel.create({ ...copy, _id: new mongoose.Types.ObjectId(), key: reference });
  await expect(refund({ reference })).rejects.toMatchObject({ statusCode: 409 });
  await FinanceCashVoucherModel.deleteOne({ _id: duplicate._id });
  await refund({ reference }); await refund({ reference });
  expect((await RepairTicketModel.findById(legacyId))?.commissionRefunds).toHaveLength(1);
});

it.each([
  { status: "pending" }, { status: "rejected" }, { kind: "receipt" }, { amount: 99 },
  { reference: "OTHER-TICKET" }, { branchId: "branch-b" }, { companyCode: "OTHER" },
  { sourceKey: "other-source" }, { debtId: "debt" }, { approvedBy: "" }, { occurredOn: "2026-09-29" },
])("rejects unsuitable Finance evidence: %j", async changes => {
  await FinanceCashVoucherModel.updateOne({ key: "REF-1" }, { $set: changes });
  await expect(refund()).rejects.toMatchObject({ statusCode: 409 });
  expect((await RepairTicketModel.findById(legacyId))?.commissionRefunds).toHaveLength(0);
});

it("rejects missing proof and legacy replay, without upgrading unverified references", async () => {
  await expect(refund({ reference: "missing" })).rejects.toMatchObject({ statusCode: 409 });
  await RepairTicketModel.updateOne({ _id: legacyId }, { $set: { commissionRefunds: [{ key: "refund-1", amount: 100, laborAmount: 50, reference: "REF-1", reason: "refund", by: "staff", at: date(3) }] } });
  await expect(refund()).rejects.toMatchObject({ statusCode: 409 });
  expect((await repairRevenueReport(scope, range)).total.revenue).toBe(500);
  expect((await FinanceCashVoucherModel.findOne({ key: "REF-1" }))?.sourceKey).toBeUndefined();
});

it("blocks new links to closed cash periods, but permits exact replay after closing", async () => {
  const closed = await FinanceClosedPeriodModel.create({ ...scope, month: "2026-09", status: "closed" });
  await expect(refund()).rejects.toMatchObject({ status: 409 });
  await FinanceClosedPeriodModel.deleteOne({ _id: closed._id });
  await refund();
  await FinanceClosedPeriodModel.create({ ...scope, month: "2026-09", status: "closed" });
  await refund();
  expect((await FinanceCashAccountModel.findOne(scope))?.balance).toBe(900);
});

it("deducts refunds in the cash voucher period independently of the original completion period", async () => {
  await RepairTicketModel.updateOne({ _id: legacyId }, { $set: { completedAt: new Date("2026-08-20"), deliveredAt: new Date("2026-08-20") } });
  await refund();
  const previous = await repairRevenueReport(scope, { from: "2026-08-01", to: "2026-08-31" });
  expect(previous.total.revenue).toBe(200);
  for (const groupBy of ["branch", "day", "technician"] as const) {
    const report = await repairRevenueReport(scope, range, { groupBy, includeCost: true });
    expect(report.total).toMatchObject({ ticketCount: 1, revenue: 200, laborRevenue: 50, partRevenue: 150, collected: 200, partCost: 40, grossProfit: 160 });
  }
  const finance = await financialReportingService.profit(scope, range);
  expect(finance.movements.reduce((sum, row) => sum + row.revenue, 0)).toBe(200);
  expect(finance.movements.find(row => row.source === "repair-refund")).toMatchObject({ date: "2026-09-30", revenue: -100, cost: 0 });
  const movement = finance.movements.find(row => row.source === "repair-refund")!;
  expect(await financialReportingService.document(scope, movement.source, movement.sourceId!)).toMatchObject({ code: "REF-1", amount: -100, date: "2026-09-30", status: "posted" });
  await expect(financialReportingService.document({ ...scope, branchId: "other" }, movement.source, movement.sourceId!)).rejects.toMatchObject({ status: 404 });
  expect(finance.lossSales).toHaveLength(0);
  expect((await repairRevenueReport({ ...scope, branchId: "branch-b" }, range)).total.revenue).toBe(500);
});

it("allocates discounted quotes to labor and parts with half-up rounding and no revenue gap", async () => {
  await RepairTicketModel.updateOne({ _id: legacyId }, { $set: { totalAmount: 101, paidAmount: 101 } });
  const report = await repairRevenueReport(scope, range);
  expect(report.total).toMatchObject({ revenue: 401, laborRevenue: 151, partRevenue: 250 });
  await refund();
  const net = await repairRevenueReport(scope, range);
  expect(net.total).toMatchObject({ revenue: 301, laborRevenue: 101, partRevenue: 200 });
});

it("keeps refund-only reporting rows with zero completed jobs and unchanged costs", async () => {
  await RepairTicketModel.updateMany({ ...scope, ticketCode: { $in: ["LEGACY", "MODERN"] } }, { $set: { completedAt: new Date("2026-08-20") } });
  await refund();
  const result = await repairRevenueReport(scope, range, { groupBy: "day", includeCost: true });
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({ key: "2026-09-30", ticketCount: 0, revenue: -100, laborRevenue: -50, partRevenue: -50, partCost: 0, grossProfit: -100 });
});

const reconcileRefund = (extra: any = {}, actor = "staff", selectedScope = scope) => reconcileRepairRefund(selectedScope, legacyId, { amount: 100, laborAmount: 50, reason: "refund", reference: "REF-1", idempotencyKey: "refund-1", ...extra }, actor);
it("reconciles an absent or completed refund without writing or changing money", async () => {
  expect((await reconcileRefund()).status).toBe("not_found");
  await refund();
  await FinanceClosedPeriodModel.create({ ...scope, month: "2026-09", status: "closed" });
  const writes: string[] = [];
  const listener = (event: any) => { if (["insert", "update", "delete", "findAndModify"].includes(event.commandName)) writes.push(event.commandName); };
  mongoose.connection.getClient().on("commandStarted", listener);
  try {
    const result = await reconcileRefund();
    expect(result).toMatchObject({ status: "completed", occurredOn: "2026-09-30" });
    expect(result.voucherId).toBe(String((await FinanceCashVoucherModel.findOne({ key: "REF-1" }))!._id));
  } finally { mongoose.connection.getClient().off("commandStarted", listener); }
  expect(writes).toEqual([]);
  expect((await FinanceCashAccountModel.findOne(scope))?.balance).toBe(900);
});
it.each([{ amount: 99 }, { laborAmount: 49 }, { reason: "changed" }, { reference: "changed" }])("does not confirm a changed recovery payload: %j", async changed => {
  await refund(); expect((await reconcileRefund(changed)).status).toBe("conflict");
});
it("isolates refund recovery by branch, company and actor", async () => {
  await refund();
  expect((await reconcileRefund({}, "other")).status).toBe("conflict");
  await expect(reconcileRefund({}, "staff", { ...scope, branchId: "other" })).rejects.toMatchObject({ statusCode: 404 });
  await expect(reconcileRefund({}, "staff", { ...scope, companyCode: "other" })).rejects.toMatchObject({ statusCode: 404 });
});
it("reconciles an identical second-tab intent only with unique matching voucher evidence", async () => {
  await refund();
  expect((await reconcileRefund({ idempotencyKey: "second-tab" })).status).toBe("completed");
  expect((await reconcileRefund({ idempotencyKey: "second-tab", amount: 99 })).status).toBe("conflict");
  expect((await reconcileRefund({ idempotencyKey: "second-tab" }, "other")).status).toBe("conflict");
  await RepairTicketModel.updateOne({ _id: legacyId }, { $push: { commissionRefunds: { key: "legacy-duplicate", reference: "REF-1", amount: 1, laborAmount: 0 } } });
  expect((await reconcileRefund({ idempotencyKey: "second-tab" })).status).toBe("conflict");
});
it.each([{ status: "rejected" }, { sourceKey: "other" }, { occurredOn: "2026-09-29" }, { approvedBy: "" }, { amount: 99 }])("requires matching Finance proof when recovering: %j", async changed => {
  await refund(); await FinanceCashVoucherModel.updateOne({ key: "REF-1" }, { $set: changed });
  expect((await reconcileRefund()).status).toBe("conflict");
});
it("does not treat legacy or missing Finance evidence as a completed request", async () => {
  await refund(); await FinanceCashVoucherModel.deleteMany({});
  expect((await reconcileRefund()).status).toBe("conflict");
  await RepairTicketModel.updateOne({ _id: legacyId }, { $unset: { "commissionRefunds.0.financeVoucherId": 1 } });
  expect((await reconcileRefund()).status).toBe("conflict");
});

const revokeRefund = (extra: any = {}, actor = "staff", selectedScope = scope) => revokeRepairRefundRequest(selectedScope, legacyId, { amount: 100, laborAmount: 50, reason: "refund", reference: "REF-1", idempotencyKey: "refund-1", ...extra }, actor);
it("durably revokes a pending key without altering cash, vouchers or commission refunds", async () => {
  const voucher = await FinanceCashVoucherModel.findOne({ key: "REF-1" }).lean();
  expect((await revokeRefund()).status).toBe("revoked");
  expect((await revokeRefund()).status).toBe("revoked");
  expect((await reconcileRefund()).status).toBe("revoked");
  await expect(refund()).rejects.toMatchObject({ statusCode: 409 });
  await expect(refund({ reference: "different", amount: 50 })).rejects.toMatchObject({ statusCode: 409 });
  const ticket = await RepairTicketModel.findById(legacyId).lean();
  expect(ticket?.refundRequestRevocations).toHaveLength(1);
  expect(ticket?.refundRequestRevocations?.[0]).toMatchObject({ key: "refund-1", by: "staff", reference: "REF-1", revokedAt: expect.any(Date) });
  expect(ticket?.commissionRefunds).toHaveLength(0);
  expect(await FinanceCashVoucherModel.findOne({ key: "REF-1" }).lean()).toEqual(voucher);
  expect((await FinanceCashAccountModel.findOne(scope))?.balance).toBe(900);
  await refund({ idempotencyKey: "corrected-new-request" });
  expect((await RepairTicketModel.findById(legacyId))?.commissionRefunds).toHaveLength(1);
});
it("rejects changed revocation identities and isolates branch/company access", async () => {
  await revokeRefund();
  expect((await revokeRefund({ reason: "other" })).status).toBe("conflict");
  expect((await revokeRefund({}, "other")).status).toBe("conflict");
  expect((await reconcileRefund({ amount: 99 })).status).toBe("conflict");
  await expect(revokeRefund({}, "staff", { ...scope, branchId: "other" })).rejects.toMatchObject({ statusCode: 404 });
  await expect(revokeRefund({}, "staff", { ...scope, companyCode: "other" })).rejects.toMatchObject({ statusCode: 404 });
});
it("reconciles completed requests instead of revoking or reversing them", async () => {
  await refund();
  expect((await revokeRefund()).status).toBe("completed");
  expect((await revokeRefund({ reason: "changed" })).status).toBe("conflict");
  expect((await RepairTicketModel.findById(legacyId))?.refundRequestRevocations).toHaveLength(0);
  expect((await FinanceCashAccountModel.findOne(scope))?.balance).toBe(900);
});
it("can revoke invalid proof in a closed cash period without changing the cash period", async () => {
  await FinanceClosedPeriodModel.create({ ...scope, month: "2026-09", status: "closed" });
  expect((await revokeRefund({ reference: "invalid-proof" })).status).toBe("revoked");
  expect((await FinanceClosedPeriodModel.findOne(scope))?.status).toBe("closed");
});
it("rolls back failed revocation and requires an active transaction", async () => {
  vi.spyOn(RepairTicketModel.prototype, "save").mockRejectedValueOnce(new Error("revocation-failure"));
  await expect(revokeRefund()).rejects.toThrow("revocation-failure");
  expect((await RepairTicketModel.findById(legacyId))?.refundRequestRevocations).toHaveLength(0);
  const session = await mongoose.startSession();
  try { await expect(revokeRepairRefundRequest(scope, legacyId, { amount: 100, laborAmount: 50, reason: "refund", reference: "REF-1", idempotencyKey: "refund-1" }, "staff", session)).rejects.toMatchObject({ statusCode: 503 }); }
  finally { await session.endSession(); }
  expect((await revokeRefund()).status).toBe("revoked");
});
it.each(["refund", "revocation"])("serializes a delayed %s against the competing transaction", async delayed => {
  const save = RepairTicketModel.prototype.save;
  let signal!: () => void, release!: () => void, gated = false;
  const entered = new Promise<void>(resolve => { signal = resolve; });
  const resume = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(RepairTicketModel.prototype, "save").mockImplementation(async function (this: any, ...args: any[]) {
    const shouldDelay = delayed === "refund" ? this.commissionRefunds.length > 0 : this.refundRequestRevocations.length > 0;
    if (!gated && shouldDelay) { gated = true; signal(); await resume; }
    return (save as any).apply(this, args);
  });
  const first = (delayed === "refund" ? refund() : revokeRefund()).then(value => ({ value }), error => ({ error }));
  await entered;
  try {
    if (delayed === "refund") expect((await revokeRefund()).status).toBe("revoked");
    else await refund();
  } finally { release(); }
  const outcome: any = await first;
  const ticket = await RepairTicketModel.findById(legacyId);
  if (delayed === "refund") {
    expect(outcome.error).toMatchObject({ statusCode: 409 });
    expect(ticket?.commissionRefunds).toHaveLength(0); expect(ticket?.refundRequestRevocations).toHaveLength(1);
    expect((await FinanceCashVoucherModel.findOne({ key: "REF-1" }))?.sourceKey).toBeUndefined();
  } else {
    expect(outcome.value.status).toBe("completed");
    expect(ticket?.commissionRefunds).toHaveLength(1); expect(ticket?.refundRequestRevocations).toHaveLength(0);
  }
  expect((await FinanceCashAccountModel.findOne(scope))?.balance).toBe(900);
});
