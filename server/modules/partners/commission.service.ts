import mongoose, { type ClientSession } from "mongoose";
import { runInTransaction } from "../../config/database";
import { RetailOrderModel } from "../retail/models/retail-order.model";
import { RetailAfterSaleModel } from "../retail/models/retail-after-sale.model";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { CommissionLedgerModel, PartnerModel } from "./partner.models";
import { integer, invalid, kpiBonus, monthKey, remainingLine, repairLines, type CommissionLine } from "./commission-calculation";

async function lockedPartner(companyCode: string, partnerId: string, session?: ClientSession) {
  const partner = await PartnerModel.findOneAndUpdate({ companyCode, _id: partnerId }, { $inc: { revision: 1 } }, { returnDocument: "after", ...(session ? { session } : {}) });
  if (!partner) throw invalid("Không tìm thấy đối tác.", 404);
  return partner;
}
async function append(partner: any, row: any, session?: ClientSession) {
  await CommissionLedgerModel.create([{ ...row, companyCode: partner.companyCode, partnerId: String(partner._id) }], session ? { session } : {});
  partner.balance += row.amount;
}
async function adjustKpi(partner: any, period: string, session?: ClientSession) {
  if (period >= monthKey(new Date())) return; // Current month remains provisional.
  const agg = CommissionLedgerModel.aggregate([
    { $match: { companyCode: partner.companyCode, partnerId: String(partner._id), period, kind: { $ne: "payout" } } },
    { $group: { _id: "$kind", amount: { $sum: "$amount" }, machines: { $sum: "$machines" } } },
  ]);
  const rows = await (session ? agg.session(session) : agg);
  const machines = Math.max(0, rows.reduce((s, r) => s + r.machines, 0));
  const prior = rows.find(r => r._id === "kpi")?.amount || 0;
  const amount = kpiBonus(machines) - prior;
  if (amount) await append(partner, { sourceType: "kpi", sourceId: period, sourceCode: period, period, kind: "kpi", amount, machines: 0, calculation: { machines, entitlement: kpiBonus(machines), previous: prior }, reason: amount > 0 ? "Chốt thưởng KPI tháng" : "Điều chỉnh thưởng do trả/hủy máy", createdBy: "system" }, session);
}
/** Read the source again under a transaction; never trust event delivery order. */
export async function reconcileCommission(sourceType: "retail" | "repair", sourceId: string, companyCode: string, existingSession?: ClientSession) {
  const run = async (session?: ClientSession) => {
    const model: any = sourceType === "retail" ? RetailOrderModel : RepairTicketModel;
    const sourceQuery = model.findOne({ _id: sourceId, companyCode }).lean();
    const source: any = await (session ? sourceQuery.session(session) : sourceQuery);
    if (!source?.commissionSnapshot?.partnerId) return;
    const partner = await lockedPartner(companyCode, source.commissionSnapshot.partnerId, session);
    const at = sourceType === "retail" ? source.completedAt : source.deliveredAt;
    if (!at) return;
    const period = monthKey(at);
    const eligible = sourceType === "retail" ? source.status === "completed" && source.dueAmount === 0 : source.status === "delivered" && source.paidAmount >= source.totalAmount;
    const lines: CommissionLine[] = source.commissionSnapshot.lines || repairLines(source, source.commissionSnapshot.policy);
    const returnsQuery = RetailAfterSaleModel.find({ companyCode, orderId: sourceId, type: "return" }).lean();
    const returns: any[] = sourceType === "retail" ? await (session ? returnsQuery.session(session) : returnsQuery) : [];
    const priorQuery = CommissionLedgerModel.aggregate([
      { $match: { companyCode, partnerId: String(partner._id), sourceType, sourceId } },
      { $group: { _id: "$line", amount: { $sum: "$amount" }, machines: { $sum: "$machines" } } },
    ]);
    const prior = await (session ? priorQuery.session(session) : priorQuery);
    for (const line of lines) {
      const returned = returns.flatMap(r => r.items).filter(i => i.orderLineIndex === line.line).reduce((s, i) => s + Number(i.quantity), 0);
      const refundedBase = sourceType === "repair" ? (source.commissionRefunds || []).reduce((s: number, r: any) => s + Number(r.laborAmount), 0) : 0;
      const desired = eligible ? remainingLine(line, returned, refundedBase) : { amount: 0, machines: 0 };
      const previous = prior.find(r => r._id === line.line);
      const amount = desired.amount - (previous?.amount || 0), machines = desired.machines - (previous?.machines || 0);
      if (amount || machines) await append(partner, {
        sourceType, sourceId, sourceCode: source.orderCode || source.ticketCode, branchId: source.branchId,
        line: line.line, period, kind: amount < 0 || machines < 0 ? "reversal" : "earning", amount, machines,
        calculation: { ...line, returnedQuantity: returned, refundedBase, entitlement: desired.amount, policyId: source.commissionSnapshot.policyId },
        reason: amount < 0 || machines < 0 ? "Thu hồi do hủy/trả hàng/hoàn tiền" : "Hoàn tất và thanh toán đủ", createdBy: "system",
      }, session);
    }
    await adjustKpi(partner, period, session);
    await partner.save(session ? { session } : {});
  };
  if (existingSession !== undefined) return run(existingSession);
  return runInTransaction((session) => run(session));
}

export async function closePartnerMonths(companyCode: string, partnerId: string) {
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const partner = await lockedPartner(companyCode, partnerId, session);
    const periods = await CommissionLedgerModel.distinct("period", { companyCode, partnerId, kind: { $ne: "payout" }, period: { $lt: monthKey(new Date()) } }).session(session);
    for (const period of periods) await adjustKpi(partner, period, session);
    await partner.save({ session });
  }); } finally { await session.endSession(); }
}

export async function recordPartnerPayout(companyCode: string, partnerId: string, input: any, actorId: string) {
  const amount = integer(input.amount, 1), reference = String(input.reference || "").trim(), key = String(input.idempotencyKey || "").trim();
  if (!reference || !key || key.length > 100) throw invalid("Cần chứng từ thanh toán và khóa chống trùng.");
  const idempotencyKey = `payout:${partnerId}:${key}`;
  const session = await mongoose.startSession(); let result: any;
  try { await session.withTransaction(async () => {
    const partner = await lockedPartner(companyCode, partnerId, session);
    const replay = await CommissionLedgerModel.findOne({ companyCode, idempotencyKey }).session(session).lean();
    if (replay) {
      if (replay.amount !== -amount || replay.reference !== reference) throw invalid("Khóa chi trả đã dùng cho nội dung khác.", 409);
      result = replay; return;
    }
    if (partner.balance < amount) throw invalid("Số tiền vượt số dư hoa hồng khả dụng.", 409);
    await append(partner, { sourceType: "payout", sourceId: key, period: monthKey(new Date()), kind: "payout", amount: -amount, machines: 0, reason: "Xác nhận đã chi hoa hồng", reference, idempotencyKey, createdBy: actorId }, session);
    await partner.save({ session });
    result = await CommissionLedgerModel.findOne({ companyCode, idempotencyKey }).session(session).lean();
  }); } finally { await session.endSession(); }
  return result;
}

export async function refundRepairCommission(scope: { companyCode: string; branchId: string }, id: string, input: any, actorId: string) {
  const amount = integer(input.amount, 1), laborAmount = integer(input.laborAmount, 0, amount);
  const reason = String(input.reason || "").trim(), key = String(input.idempotencyKey || "").trim(), reference = String(input.reference || "").trim();
  if (!reason || !key || key.length > 100 || !reference) throw invalid("Cần lý do, chứng từ hoàn tiền và khóa chống trùng.");
  const session = await mongoose.startSession(); let result: any;
  try { await session.withTransaction(async () => {
    const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope, status: "delivered" }).session(session);
    if (!ticket) throw invalid("Chỉ hoàn tiền phiếu đã giao.", 409);
    const rows = ticket.commissionRefunds || [];
    const replay = rows.find((r: any) => r.key === key);
    if (replay) { if (replay.amount !== amount || replay.laborAmount !== laborAmount || replay.reference !== reference) throw invalid("Khóa hoàn tiền đã dùng.", 409); result = ticket; return; }
    const totalRefund = rows.reduce((s: number, r: any) => s + r.amount, 0) + amount;
    const laborRefund = rows.reduce((s: number, r: any) => s + r.laborAmount, 0) + laborAmount;
    const base = (ticket.commissionSnapshot?.lines || repairLines(ticket, ticket.commissionSnapshot?.policy || { repairBps: 1000 } as any))[0].base;
    if (totalRefund > ticket.paidAmount || laborRefund > base || totalRefund - laborRefund > ticket.totalAmount - base) throw invalid("Hoàn tiền vượt giá trị tiền công/linh kiện còn lại.");
    ticket.commissionRefunds = [...rows, { key, amount, laborAmount, reason, reference, at: new Date(), by: actorId }];
    await ticket.save({ session });
    await reconcileCommission("repair", id, scope.companyCode, session); result = ticket;
  }); } finally { await session.endSession(); }
  return result;
}

/** Durable source snapshots are the recovery queue, including repairs whose legacy events are best-effort. */
let running = false;
let retailCursor = "", repairCursor = "", partnerCursor = "";
export async function runCommissionRecovery() {
  if (running || mongoose.connection.readyState !== 1) return;
  running = true;
  try {
    for (const type of ["retail", "repair"] as const) {
      const cursor = type === "retail" ? retailCursor : repairCursor;
      const model: any = type === "retail" ? RetailOrderModel : RepairTicketModel;
      const rows = await model.find({ "commissionSnapshot.partnerId": { $exists: true }, ...(cursor ? { _id: { $gt: cursor } } : {}) }).sort({ _id: 1 }).limit(50).select("_id companyCode").lean();
      for (const row of rows) {
        try { await reconcileCommission(type, String(row._id), row.companyCode); }
        catch (error) { console.error("[commission-recovery-source]", type, String(row._id), error); }
      }
      const next = rows.length === 50 ? String(rows[rows.length - 1]._id) : "";
      if (type === "retail") retailCursor = next; else repairCursor = next;
    }
    const partners = await PartnerModel.find({ roles: "collaborator", ...(partnerCursor ? { _id: { $gt: partnerCursor } } : {}) }).sort({ _id: 1 }).limit(50).select("_id companyCode").lean();
    for (const partner of partners) {
      try { await closePartnerMonths(partner.companyCode, String(partner._id)); }
      catch (error) { console.error("[commission-recovery-partner]", String(partner._id), error); }
    }
    partnerCursor = partners.length === 50 ? String(partners[partners.length - 1]._id) : "";
  } finally { running = false; }
}
let timer: ReturnType<typeof setInterval> | undefined;
export function startCommissionRecovery() {
  if (timer) return;
  timer = setInterval(() => { void runCommissionRecovery().catch(error => console.error("[commission-recovery]", error)); }, 30000);
  timer.unref();
}
