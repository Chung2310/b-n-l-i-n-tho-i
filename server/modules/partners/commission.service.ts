import mongoose, { type ClientSession } from "mongoose";
import { runInTransaction } from "../../config/database";
import { inInventoryTransaction } from "../inventory/inventory-transaction";
import { FinanceCashVoucherModel, FinancePostingGuardModel } from "../finance/models/finance-treasury.model";
import { assertCashPeriodOpen } from "../finance/services/finance-posting.service";
import { financeToday, validDay } from "../finance/services/financial-calculations";
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

export async function closePartnerMonths(companyCode: string, partnerId: string, existingSession?: ClientSession) {
  const run = async (session?: ClientSession) => {
    const partner = await lockedPartner(companyCode, partnerId, session);
    const query = CommissionLedgerModel.distinct("period", {
      companyCode,
      partnerId,
      kind: { $ne: "payout" },
      period: { $lt: monthKey(new Date()) },
    });
    const periods = await (session ? query.session(session) : query);
    for (const period of periods) await adjustKpi(partner, period, session);
    await partner.save(session ? { session } : {});
  };
  if (existingSession !== undefined) return run(existingSession);
  return runInTransaction((session) => run(session));
}

export async function recordPartnerPayout(companyCode: string, partnerId: string, input: any, actorId: string, existingSession?: ClientSession) {
  const amount = integer(input.amount, 1), reference = String(input.reference || "").trim(), key = String(input.idempotencyKey || "").trim();
  if (!reference || !key || key.length > 100) throw invalid("Cần chứng từ thanh toán và khóa chống trùng.");
  const idempotencyKey = `payout:${partnerId}:${key}`;
  const run = async (session?: ClientSession) => {
    const partner = await lockedPartner(companyCode, partnerId, session);
    const replayQuery = CommissionLedgerModel.findOne({ companyCode, idempotencyKey }).lean();
    const replay = await (session ? replayQuery.session(session) : replayQuery);
    if (replay) {
      if (replay.amount !== -amount || replay.reference !== reference) throw invalid("Khóa chi trả đã dùng cho nội dung khác.", 409);
      return replay;
    }
    if (partner.balance < amount) throw invalid("Số tiền vượt số dư hoa hồng khả dụng.", 409);
    await append(partner, { sourceType: "payout", sourceId: key, period: monthKey(new Date()), kind: "payout", amount: -amount, machines: 0, reason: "Xác nhận đã chi hoa hồng", reference, idempotencyKey, createdBy: actorId }, session);
    await partner.save(session ? { session } : {});
    const resultQuery = CommissionLedgerModel.findOne({ companyCode, idempotencyKey }).lean();
    return await (session ? resultQuery.session(session) : resultQuery);
  };
  if (existingSession !== undefined) return run(existingSession);
  return runInTransaction((session) => run(session));
}

/** Read-only recovery: absence is not permission to discard an in-flight request. */
export async function reconcileRepairRefund(scope: { companyCode: string; branchId: string }, id: string, input: any, actorId: string, session?: ClientSession) {
  const amount = integer(input.amount, 1), laborAmount = integer(input.laborAmount, 0, amount);
  const key = String(input.idempotencyKey || "").trim(), reason = String(input.reason || "").trim(), reference = String(input.reference || "").trim();
  if (!key || key.length > 100 || !reason || !reference) throw invalid("Thiếu nội dung yêu cầu hoàn tiền.");
  const ticket = await RepairTicketModel.findOne({ ...scope, _id: id }).select("commissionRefunds refundRequestRevocations ticketCode").session(session ?? null).lean();
  if (!ticket) throw invalid("Không tìm thấy phiếu sửa chữa trong chi nhánh.", 404);
  const revoked = (ticket.refundRequestRevocations || []).find((r: any) => r.key === key);
  if (revoked) {
    if (revoked.amount !== amount || revoked.laborAmount !== laborAmount || revoked.reason !== reason || revoked.reference !== reference || revoked.by !== actorId) return { status: "conflict", message: "Khóa đã bị vô hiệu hóa cho nội dung hoặc người thao tác khác." };
    return { status: "revoked", message: "Yêu cầu cũ đã bị vô hiệu hóa ở máy chủ và không thể ghi nhận muộn. Không đảo phiếu chi hoặc khoản hoàn đã ghi sổ." };
  }
  const rows = ticket.commissionRefunds || [];
  let row = rows.find((r: any) => r.key === key);
  if (!row) {
    // A second tab may have missed the first tab's success. A uniquely bound
    // voucher and an identical payload prove the same intent without posting again.
    const matches = rows.filter((r: any) => r.reference === reference || r.financeVoucherId === reference);
    if (matches.length > 1) return { status: "conflict", message: "Có nhiều khoản hoàn cùng tham chiếu. Cần đối soát chứng từ." };
    row = matches[0];
  }
  if (!row) return { status: "not_found", message: "Chưa thấy khoản hoàn này. Yêu cầu có thể đang xử lý; chỉ thử lại nguyên yêu cầu cũ." };
  if (row.amount !== amount || row.laborAmount !== laborAmount || row.reason !== reason || row.reference !== reference || row.by !== actorId || !mongoose.isObjectIdOrHexString(row.financeVoucherId)) return { status: "conflict", message: "Nội dung hoặc người thao tác không khớp khoản hoàn đã ghi nhận. Giữ yêu cầu để đối soát." };
  const proof = await FinanceCashVoucherModel.findOne({ ...scope, _id: row.financeVoucherId, status: "posted", kind: "payment", amount, reference: ticket.ticketCode, sourceKey: `repair-refund:${id}:${row.key}`, sourceId: id, sourceType: "repair-refund" }).select("occurredOn approvedBy approvedAt").session(session ?? null).lean();
  if (!proof?.approvedBy || !proof.approvedAt || !row.at || financeToday(new Date(row.at)) !== proof.occurredOn) return { status: "conflict", message: "Chứng từ Finance không khớp khoản hoàn. Giữ yêu cầu để đối soát." };
  return { status: "completed", message: "Khoản hoàn và phiếu chi Finance đã khớp. Không cần gửi lại.", voucherId: row.financeVoucherId, occurredOn: proof.occurredOn };
}

export async function revokeRepairRefundRequest(scope: { companyCode: string; branchId: string }, id: string, input: any, actorId: string, existingSession?: ClientSession) {
  const amount = integer(input.amount, 1), laborAmount = integer(input.laborAmount, 0, amount);
  const key = String(input.idempotencyKey || "").trim(), reason = String(input.reason || "").trim(), reference = String(input.reference || "").trim();
  if (!key || key.length > 100 || !reason || !reference || !actorId) throw invalid("Thiếu nội dung yêu cầu cần vô hiệu hóa.");
  return inInventoryTransaction(async session => {
    const ticket = await RepairTicketModel.findOne({ ...scope, _id: id }).session(session);
    if (!ticket) throw invalid("Không tìm thấy phiếu sửa chữa trong chi nhánh.", 404);
    if ((ticket.commissionRefunds || []).some((r: any) => r.key === key) || (ticket.refundRequestRevocations || []).some((r: any) => r.key === key)) {
      return reconcileRepairRefund(scope, id, input, actorId, session);
    }
    // Both posting and revocation write the same ticket in a transaction. The
    // loser retries and sees either the posted row or this durable tombstone.
    ticket.refundRequestRevocations = [...(ticket.refundRequestRevocations || []), { key, amount, laborAmount, reason, reference, by: actorId, revokedAt: new Date() }];
    await ticket.save({ session });
    return { status: "revoked", message: "Yêu cầu cũ đã bị vô hiệu hóa ở máy chủ. Phiếu chi và khoản hoàn đã ghi sổ không bị đảo." };
  }, existingSession);
}

export async function refundRepairCommission(scope: { companyCode: string; branchId: string }, id: string, input: any, actorId: string, existingSession?: ClientSession) {
  const amount = integer(input.amount, 1), laborAmount = integer(input.laborAmount, 0, amount);
  const reason = String(input.reason || "").trim(), key = String(input.idempotencyKey || "").trim(), reference = String(input.reference || "").trim();
  if (!reason || !key || key.length > 100 || !reference) throw invalid("Cần lý do, chứng từ hoàn tiền và khóa chống trùng.");
  const run = async (session?: ClientSession) => {
    const ticketQuery = RepairTicketModel.findOne({ _id: id, ...scope, status: "delivered" });
    const ticket: any = await (session ? ticketQuery.session(session) : ticketQuery);
    if (!ticket) throw invalid("Chỉ hoàn tiền phiếu đã giao.", 409);
    if ((ticket.refundRequestRevocations || []).some((r: any) => r.key === key)) throw invalid("Yêu cầu hoàn tiền này đã bị vô hiệu hóa. Không thể gửi lại khóa cũ.", 409);
    const rows = ticket.commissionRefunds || [];
    const replay = rows.find((r: any) => r.key === key);
    if (replay) {
      if (!replay.financeVoucherId || replay.amount !== amount || replay.laborAmount !== laborAmount || replay.reference !== reference || replay.reason !== reason || replay.by !== actorId) throw invalid("Khóa hoàn tiền đã dùng hoặc khoản hoàn cũ chưa đối soát Finance.", 409);
      const proof = await FinanceCashVoucherModel.exists({ ...scope, _id: replay.financeVoucherId, status: "posted", kind: "payment", amount, sourceKey: `repair-refund:${id}:${key}`, sourceId: id, sourceType: "repair-refund" }).session(session ?? null);
      if (!proof) throw invalid("Liên kết chứng từ hoàn tiền không còn khớp. Cần đối soát.", 409);
      return ticket;
    }
    const totalRefund = rows.reduce((s: number, r: any) => s + r.amount, 0) + amount;
    const laborRefund = rows.reduce((s: number, r: any) => s + r.laborAmount, 0) + laborAmount;
    const base = (ticket.commissionSnapshot?.lines || repairLines(ticket, ticket.commissionSnapshot?.policy || { repairBps: 1000 } as any))[0].base;
    if (totalRefund > ticket.paidAmount || laborRefund > base || totalRefund - laborRefund > ticket.totalAmount - base) throw invalid("Hoàn tiền vượt giá trị tiền công/linh kiện còn lại.");
    const candidates = await FinanceCashVoucherModel.find({ ...scope, $or: [{ key: reference }, ...(mongoose.isObjectIdOrHexString(reference) ? [{ _id: reference }] : [])] }).limit(2).session(session ?? null);
    const voucher = candidates.length === 1 ? candidates[0] : null;
    if (!voucher || voucher.status !== "posted" || voucher.kind !== "payment" || voucher.amount !== amount || voucher.reference !== ticket.ticketCode || !voucher.approvedBy || !voucher.approvedAt || voucher.sourceKey != null || voucher.sourceType != null || voucher.sourceId != null || voucher.debtId != null) throw invalid("Cần phiếu chi Finance đã ghi sổ, đúng số tiền, tham chiếu mã phiếu sửa chữa và chưa liên kết nghiệp vụ khác.", 409);
    const day = validDay(voucher.occurredOn);
    const completion = ticket.completedAt ?? ticket.deliveredAt;
    if (!completion || day < financeToday(new Date(completion)) || day > financeToday()) throw invalid("Ngày phiếu chi không phù hợp với phiếu sửa chữa.", 409);
    // Serialize with treasury period closing; linking never debits the account again.
    await FinancePostingGuardModel.updateOne(scope, { $inc: { revision: 1 } }, { upsert: true, session });
    await assertCashPeriodOpen(scope, day, session);
    const claimed = await FinanceCashVoucherModel.updateOne({ ...scope, _id: voucher._id, status: "posted", version: voucher.version, sourceKey: null, sourceType: null, sourceId: null, debtId: null }, { $set: { sourceKey: `repair-refund:${id}:${key}`, sourceType: "repair-refund", sourceId: id }, $inc: { version: 1 } }, { session });
    if (claimed.modifiedCount !== 1) throw invalid("Phiếu chi đã được sử dụng. Vui lòng đối soát.", 409);
    ticket.commissionRefunds = [...rows, { key, amount, laborAmount, reason, reference, financeVoucherId: String(voucher._id), at: new Date(`${day}T00:00:00+07:00`), recordedAt: new Date(), by: actorId }];
    await ticket.save(session ? { session } : {});
    await reconcileCommission("repair", id, scope.companyCode, session);
    return ticket;
  };
  return inInventoryTransaction((session) => run(session), existingSession);
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
