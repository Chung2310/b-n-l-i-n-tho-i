import { RepairPartRequestModel } from "../repair/repair-part-request.model";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { RepairPartModel } from "../repair/repair-part.model";
import { RepairPaymentRequestModel } from "../repair/repair-payment-request.model";
import { RepairPaymentModel } from "../repair/repair-payment.model";
import { approveRepairQuote, cancelRepairTicket, deliverRepairTicket, quoteRepairTicket, recordRepairPayment, reconcileRepairPayment, revokeRepairPayment, transitionRepairTicket } from "../repair/repair-ticket.service";
import { buildRepairRevenuePipeline } from "../repair/services/repair-report.service";
vi.mock("../repair/services/repair-notify.service", () => ({ dispatchRepairNotification: async () => undefined }));
vi.mock("../repair/services/repair-events", () => ({ publishRepairTicketEvent: async () => undefined }));
const scope = { companyCode: "REPAIR-MONEY", branchId: "branch-1" };
const actor = { id: "staff", name: "Staff" };
const id = new mongoose.Types.ObjectId().toString();
const metadata = (extra: any = {}) => ({ idempotencyKey: "payment-1", expectedPaidAmount: 0, expectedTotalAmount: 1000, ...extra });
const pay = (amount = 300, extra: any = {}) => recordRepairPayment(scope, id, amount, actor, metadata(extra));
const reconcile = (amount = 300, extra: any = {}) => reconcileRepairPayment(scope, id, amount, actor, metadata(extra));
const ticket = () => RepairTicketModel.findById(id).lean();
const models = [RepairPartRequestModel, RepairTicketModel, RepairPartModel, RepairPaymentModel, RepairPaymentRequestModel];
let replica: MongoMemoryReplSet;
beforeAll(async () => { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replica.getUri()); await Promise.all(models.map(m => (m as any).init())); }, 60000);
beforeEach(async () => {
  vi.restoreAllMocks(); await Promise.all(models.map(m => (m as any).deleteMany({})));
  await RepairTicketModel.create({ _id: id, ...scope, ticketCode: "SC-1", ticketType: "service", customerId: "KH-1", customerName: "Customer", customerPhone: "0901234567", device: { name: "Phone", condition: "Broken" }, serialLifecycle: { mode: "untracked" }, coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: new Date() }, symptom: "Screen", status: "done", totalAmount: 1000, dueAmount: 1000, paidAmount: 0, receivedAt: new Date(), completedAt: new Date("2026-09-30T10:00:00+07:00"), createdBy: actor.id, createdByName: actor.name });
});
afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });
it("reconciles missing and completed payments without changing balances", async () => {
  expect((await reconcile()).status).toBe("not_found");
  await pay(); await pay(700, { idempotencyKey: "rest", expectedPaidAmount: 300 }); await deliverRepairTicket(scope, id, actor);
  const before = await ticket(); const receipts = await RepairPaymentModel.find().lean();
  expect(await reconcile()).toMatchObject({ status: "completed", amount: 300 });
  expect(await ticket()).toEqual(before); expect(await RepairPaymentModel.find().lean()).toEqual(receipts);
});
it.each([{ expectedPaidAmount: 1 }, { expectedTotalAmount: 999 }])("keeps changed balance snapshots in conflict: %j", async changed => {
  await pay(); expect((await reconcile(300, changed)).status).toBe("conflict");
});
it("requires exact payment, actor and scoped ticket identity for recovery", async () => {
  await pay(); expect((await reconcile(301)).status).toBe("conflict");
  expect((await reconcileRepairPayment(scope, id, 300, { ...actor, id: "other" }, metadata())).status).toBe("conflict");
  await expect(reconcileRepairPayment({ ...scope, branchId: "other" }, id, 300, actor, metadata())).rejects.toMatchObject({ statusCode: 404 });
  await expect(reconcileRepairPayment({ ...scope, companyCode: "other" }, id, 300, actor, metadata())).rejects.toMatchObject({ statusCode: 404 });
});
it.each([{ paidAmount: 200 }, { dueAmount: 1 }, { totalAmount: 999 }])("does not confirm inconsistent ticket evidence: %j", async changed => {
  await pay(); await RepairTicketModel.updateOne({ _id: id }, { $set: changed });
  expect((await reconcile()).status).toBe("conflict");
  await expect(pay()).rejects.toMatchObject({ code: "REPAIR_PAYMENT_CONFLICT" });
});
it("does not confirm changed receipt fields despite an unchanged request fingerprint", async () => {
  await pay(); await RepairPaymentModel.updateOne({ ticketId: id }, { $set: { amount: 1 } });
  expect((await reconcile()).status).toBe("conflict");
  await expect(pay()).rejects.toMatchObject({ code: "REPAIR_PAYMENT_CONFLICT" });
});
it("records a concurrent duplicate payment only once", async () => {
  const results = await Promise.all([pay(), pay()]);
  expect(results.map(r => r.paidAmount)).toEqual([300, 300]);
  expect(await ticket()).toMatchObject({ paidAmount: 300, dueAmount: 700, paymentStatus: "partial" });
  expect(await RepairPaymentModel.countDocuments()).toBe(1);
});
it("rejects a second key submitted from the same stale balance", async () => {
  const results = await Promise.allSettled([pay(), pay(300, { idempotencyKey: "payment-2" })]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await ticket()).toMatchObject({ paidAmount: 300, dueAmount: 700 });
  expect(await RepairPaymentModel.countDocuments()).toBe(1);
});
it("allows a new payment after reading the new balance and replays after delivery", async () => {
  await pay(); await pay(700, { idempotencyKey: "payment-2", expectedPaidAmount: 300 });
  await deliverRepairTicket(scope, id, actor); await pay();
  expect(await ticket()).toMatchObject({ status: "delivered", paidAmount: 1000, dueAmount: 0, paymentStatus: "paid" });
  expect(await RepairPaymentModel.countDocuments()).toBe(2);
});
it.each(["amount", "actor", "branch", "ticket", "snapshot"])("rejects key reuse with changed %s", async changed => {
  await pay();
  const result = recordRepairPayment(changed === "branch" ? { ...scope, branchId: "other" } : scope, changed === "ticket" ? new mongoose.Types.ObjectId().toString() : id, changed === "amount" ? 200 : 300, changed === "actor" ? { ...actor, id: "other" } : actor, metadata(changed === "snapshot" ? { expectedPaidAmount: 300 } : {}));
  await expect(result).rejects.toMatchObject({ statusCode: 409, code: "REPAIR_PAYMENT_CONFLICT" });
  expect(await RepairPaymentModel.countDocuments()).toBe(1); expect((await ticket())?.paidAmount).toBe(300);
});
it.each(["ticket", "record"])("rolls back ticket and receipt when %s persistence fails", async failed => {
  if (failed === "ticket") vi.spyOn(RepairTicketModel.prototype, "save").mockRejectedValueOnce(new Error("injected"));
  else vi.spyOn(RepairPaymentModel, "create").mockRejectedValueOnce(new Error("injected"));
  await expect(pay()).rejects.toThrow("injected");
  expect(await ticket()).toMatchObject({ paidAmount: 0, dueAmount: 1000 }); expect(await RepairPaymentModel.countDocuments()).toBe(0);
  await pay(); expect((await ticket())?.paidAmount).toBe(300);
});
it.each([0, -1, 0.5, Number.NaN, 1001])("rejects invalid or excess amount %s", async amount => {
  await expect(pay(amount)).rejects.toMatchObject({ statusCode: 400, code: "REPAIR_PAYMENT_INVALID" });
  expect((await ticket())?.paidAmount).toBe(0); expect(await RepairPaymentModel.countDocuments()).toBe(0);
});
it("requires a key and valid balance metadata without inferring a fresh balance", async () => {
  await expect(recordRepairPayment(scope, id, 300, actor)).rejects.toMatchObject({ code: "REPAIR_PAYMENT_INVALID" });
  await expect(pay(300, { expectedPaidAmount: -1 })).rejects.toMatchObject({ code: "REPAIR_PAYMENT_INVALID" });
  await RepairTicketModel.updateOne({ _id: id }, { $set: { totalAmount: 1200 } });
  await expect(pay()).rejects.toMatchObject({ code: "REPAIR_PAYMENT_CONFLICT" });
  expect(await RepairPaymentModel.countDocuments()).toBe(0);
});
it("enforces company/branch and done-state boundaries", async () => {
  await expect(recordRepairPayment({ ...scope, companyCode: "other" }, id, 300, actor, metadata())).rejects.toMatchObject({ statusCode: 404 });
  await expect(recordRepairPayment({ ...scope, branchId: "other" }, id, 300, actor, metadata())).rejects.toMatchObject({ statusCode: 404 });
  await RepairTicketModel.updateOne({ _id: id }, { $set: { status: "repairing" } });
  await expect(pay()).rejects.toMatchObject({ code: "REPAIR_PAYMENT_NOT_DUE" });
  expect(await RepairPaymentModel.countDocuments()).toBe(0);
});
it("keeps report collected and outstanding aligned with committed receipts", async () => {
  await Promise.all([pay(), pay()]);
  const [row] = await RepairTicketModel.aggregate(buildRepairRevenuePipeline(scope, { from: "2026-09-30", to: "2026-09-30" }));
  expect(row).toMatchObject({ revenue: 1000, collected: 300, outstanding: 700 });
  const [receipt] = await RepairPaymentModel.aggregate([{ $group: { _id: null, amount: { $sum: "$amount" } } }]);
  expect(receipt.amount).toBe(row.collected);
});
it("replays identical quotes once and rejects a changed quote", async () => {
  await RepairTicketModel.updateOne({ _id: id }, { $set: { status: "diagnosing", laborFee: 0 } });
  await Promise.all([quoteRepairTicket(scope, id, 1000, actor, "Screen", 400), quoteRepairTicket(scope, id, 1000, actor, "Screen", 400)]);
  expect(await ticket()).toMatchObject({ status: "quoted", quotedAmount: 1000, laborFee: 400, dueAmount: 0 });
  expect((await ticket())?.statusHistory).toHaveLength(1);
  await expect(quoteRepairTicket(scope, id, 1200, actor, "Screen", 400)).rejects.toMatchObject({ code: "REPAIR_QUOTE_CONFLICT" });
});
it("serializes quotation against cancellation without resurrecting a ticket", async () => {
  await RepairTicketModel.updateOne({ _id: id }, { $set: { status: "diagnosing" } });
  const results = await Promise.allSettled([quoteRepairTicket(scope, id, 1000, actor), cancelRepairTicket(scope, id, "cancel", actor)]);
  expect(results[1].status).toBe("fulfilled"); expect((await ticket())?.status).toBe("cancelled");
});
it("approves a quote once under concurrency", async () => {
  await RepairTicketModel.updateOne({ _id: id }, { $set: { status: "diagnosing" } }); await quoteRepairTicket(scope, id, 1000, actor);
  await Promise.all([approveRepairQuote(scope, id, actor), approveRepairQuote(scope, id, actor)]);
  expect(await ticket()).toMatchObject({ status: "approved", dueAmount: 0, totalAmount: 1000 });
  expect((await ticket())?.statusHistory.filter(h => h.to === "approved")).toHaveLength(1);
});
it("serializes approval against cancellation", async () => {
  await RepairTicketModel.updateOne({ _id: id }, { $set: { status: "diagnosing" } }); await quoteRepairTicket(scope, id, 1000, actor);
  const results = await Promise.allSettled([approveRepairQuote(scope, id, actor), cancelRepairTicket(scope, id, "cancel", actor)]);
  expect(results[1].status).toBe("fulfilled"); expect((await ticket())?.status).toBe("cancelled");
});
it("rejects quote workflow bypass through generic status changes", async () => {
  for (const status of ["quoted", "approved"] as const) await expect(transitionRepairTicket(scope, id, status, actor)).rejects.toMatchObject({ code: "REPAIR_QUOTE_WORKFLOW_REQUIRED" });
  expect((await ticket())?.status).toBe("done");
});
it("rejects invalid quotes and rolls back a failed quote save", async () => {
  await RepairTicketModel.updateOne({ _id: id }, { $set: { status: "diagnosing" } });
  await expect(quoteRepairTicket(scope, id, 100, actor, "note", 200)).rejects.toMatchObject({ statusCode: 400 });
  vi.spyOn(RepairTicketModel.prototype, "save").mockRejectedValueOnce(new Error("injected"));
  await expect(quoteRepairTicket(scope, id, 1000, actor)).rejects.toThrow("injected");
  expect(await ticket()).toMatchObject({ status: "diagnosing", totalAmount: 1000 }); expect((await ticket())?.quoteFingerprint).toBeUndefined();
});

const revoke = (amount = 300, extra: any = {}) => revokeRepairPayment(scope, id, amount, actor, metadata(extra));
it("durably revokes a missing request without creating a receipt or changing money", async () => {
  const before = await ticket();
  expect((await revoke()).status).toBe("revoked");
  expect((await revoke()).status).toBe("revoked");
  expect((await reconcile()).status).toBe("revoked");
  await expect(pay()).rejects.toMatchObject({ code: "REPAIR_PAYMENT_REVOKED" });
  expect(await ticket()).toEqual(before); expect(await RepairPaymentModel.countDocuments()).toBe(0);
  expect(await RepairPaymentRequestModel.countDocuments()).toBe(1);
  await pay(300, { idempotencyKey: "replacement" }); expect((await ticket())?.paidAmount).toBe(300);
});
it("reconciles already posted payments on revoke without reversing money", async () => {
  await pay(); const before = await ticket();
  expect((await revoke()).status).toBe("completed");
  await pay(); expect(await ticket()).toEqual(before);
  expect(await RepairPaymentModel.countDocuments()).toBe(1);
  expect((await RepairPaymentRequestModel.findOne().lean())?.revoked).toBe(false);
});
it("does not poison a legacy receipt key with a changed revocation payload", async () => {
  await pay(); await RepairPaymentRequestModel.deleteMany({});
  await expect(revoke(301)).rejects.toMatchObject({ code: "REPAIR_PAYMENT_CONFLICT" });
  expect(await RepairPaymentRequestModel.countDocuments()).toBe(0);
  expect((await reconcile()).status).toBe("completed");
  expect((await revoke()).status).toBe("completed"); await pay();
});
it("keeps revoked keys bound to their original actor and payload", async () => {
  await revoke();
  await expect(revoke(301)).rejects.toMatchObject({ code: "REPAIR_PAYMENT_CONFLICT" });
  await expect(revokeRepairPayment(scope, id, 300, { ...actor, id: "other" }, metadata())).rejects.toMatchObject({ code: "REPAIR_PAYMENT_CONFLICT" });
  expect((await reconcile(301)).status).toBe("conflict");
});
it("rolls back a failed revocation and permits the original payment", async () => {
  vi.spyOn(RepairPaymentRequestModel.prototype, "save").mockRejectedValueOnce(new Error("injected"));
  await expect(revoke()).rejects.toThrow("injected");
  expect(await RepairPaymentRequestModel.countDocuments()).toBe(0);
  await pay(); expect((await ticket())?.paidAmount).toBe(300);
});
it("does not create revocation markers outside the ticket scope", async () => {
  await expect(revokeRepairPayment({ ...scope, branchId: "other" }, id, 300, actor, metadata())).rejects.toMatchObject({ statusCode: 404 });
  await expect(revokeRepairPayment({ ...scope, companyCode: "other" }, id, 300, actor, metadata())).rejects.toMatchObject({ statusCode: 404 });
  expect(await RepairPaymentRequestModel.countDocuments()).toBe(0);
});
it.each(["post", "revoke"])("serializes a delayed %s against its competing operation", async delayed => {
  const original = RepairPaymentRequestModel.findOneAndUpdate.bind(RepairPaymentRequestModel);
  let entered!: () => void, release!: () => void;
  const reached = new Promise<void>(resolve => { entered = resolve; });
  const pause = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(RepairPaymentRequestModel, "findOneAndUpdate").mockImplementationOnce((async (...args: any[]) => {
    entered(); await pause; return (original as any)(...args);
  }) as any);
  const pending = (delayed === "post" ? pay() : revoke()).then(value => ({ value, error: null as any }), error => ({ value: null, error }));
  await reached;
  try {
    const winner = await (delayed === "post" ? revoke() : pay());
    if (delayed === "post") expect(winner).toMatchObject({ status: "revoked" });
  } finally { release(); }
  const result = await pending;
  if (delayed === "post") {
    expect(result.error).toMatchObject({ code: "REPAIR_PAYMENT_REVOKED" });
    expect(await RepairPaymentModel.countDocuments()).toBe(0); expect((await ticket())?.paidAmount).toBe(0);
  } else {
    expect(result.error).toBeNull(); expect(result.value).toMatchObject({ status: "completed" });
    expect(await RepairPaymentModel.countDocuments()).toBe(1); expect((await ticket())?.paidAmount).toBe(300);
  }
});

it("requires an identified actor and active caller transaction for revocation", async () => {
  await expect(revokeRepairPayment(scope, id, 300, { ...actor, id: "" }, metadata())).rejects.toMatchObject({ code: "REPAIR_PAYMENT_INVALID" });
  const session = await mongoose.startSession();
  try { await expect(revokeRepairPayment(scope, id, 300, actor, metadata(), session)).rejects.toMatchObject({ statusCode: 503 }); }
  finally { await session.endSession(); }
  expect(await RepairPaymentRequestModel.countDocuments()).toBe(0);
});
