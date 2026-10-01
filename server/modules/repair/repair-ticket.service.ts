import { RepairCreationRequestModel } from "./repair-creation-request.model";
import { RepairPaymentRequestModel } from "./repair-payment-request.model";
import { repairLines } from "../partners/commission-calculation";
import { resolveCollaborator, snapshotPolicy } from "../partners/commission-snapshot";
import { reconcileCommission } from "../partners/commission.service";
import type { ClientSession } from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import { UserModel } from "../../model/user.model";
import { RepairTicketModel } from "./repair-ticket.model";
import { RepairPaymentModel } from "./repair-payment.model";
import type { RepairCoverage, RepairTicketDocument } from "./repair-ticket.interface";
import { assertRepairTransition, type RepairStatus } from "./repair-state";
import { dispatchRepairNotification } from "./services/repair-notify.service";
import { publishRepairTicketEvent } from "./services/repair-events";
import { assertSerialForRepairType, assertSoldSerialForRepair } from "./repair-serial-validation";
import { assertRepairSerialCompletion, recordRepairSerialLifecycle } from "./services/repair-serial-lifecycle";
import { lookupDeviceOptional, requireSoldSerialForRepair } from "./repair-sold-serial.service";
import { RepairSettingsModel } from "./repair-settings.model";
import { getCustomerContact } from "../customer-management/contracts";
import { inInventoryTransaction } from "../inventory/inventory-transaction";

export type RepairScope = { companyCode: string; branchId: string };
export type RepairActor = { id: string; name: string };

// An outer transaction owner must run these effects only after its commit.
type AfterCommit = Array<() => void>;
function requireEffectQueue(session?: ClientSession, effects?: AfterCommit) {
  if (session && !effects) throw Object.assign(new Error("Caller-owned repair transactions require an after-commit queue."), { statusCode: 503 });
}
function fingerprint(value: any): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" && !(v instanceof Date) ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function creationIdentity(scope: RepairScope, input: Record<string, unknown>, actor: RepairActor) {
  if (!actor.id?.trim() || typeof input?.ticketCode !== "string" || !input.ticketCode.trim()) throw Object.assign(new Error("Thiếu mã phiếu hoặc người tạo."), { statusCode: 400 });
  return { ticketCode: input.ticketCode.trim(), requestFingerprint: fingerprint({ scope, input, actor }) };
}
const creationConflict = () => Object.assign(new Error("Mã phiếu hoặc nội dung không khớp. Giữ yêu cầu để đối soát."), { statusCode: 409, code: "REPAIR_CREATION_CONFLICT" });
async function lockCreation(scope: RepairScope, ticketCode: string, requestFingerprint: string, session: ClientSession) {
  const gate = await RepairCreationRequestModel.findOneAndUpdate({ companyCode: scope.companyCode, ticketCode },
    { $setOnInsert: { ...scope, ticketCode, requestFingerprint }, $inc: { revision: 1 } }, { upsert: true, returnDocument: "after", session });
  if (gate.branchId !== scope.branchId || gate.requestFingerprint !== requestFingerprint) throw creationConflict();
  return gate;
}
export async function reconcileRepairCreation(scope: RepairScope, input: Record<string, unknown>, actor: RepairActor, session?: ClientSession) {
  const { ticketCode, requestFingerprint } = creationIdentity(scope, input, actor);
  const ticket = await RepairTicketModel.findOne({ ...scope, ticketCode }).select("creationFingerprint createdBy").session(session ?? null).lean();
  const gate = await RepairCreationRequestModel.findOne({ ...scope, ticketCode }).session(session ?? null).lean();
  if (gate && (gate.requestFingerprint !== requestFingerprint || (gate.revoked && ticket))) return { status: "conflict", message: creationConflict().message };
  if (gate?.revoked) return { status: "revoked", message: "Yêu cầu đã bị vô hiệu hóa. Mã cũ không thể tạo phiếu muộn." };
  if (!ticket) return { status: "not_found", message: "Chưa thấy phiếu trong phạm vi hiện tại. Giữ nguyên yêu cầu; chưa thể kết luận lần gửi cũ đã dừng." };
  if (ticket.createdBy !== actor.id || ticket.creationFingerprint !== requestFingerprint) return { status: "conflict", message: creationConflict().message };
  return { status: "completed", ticketId: String(ticket._id), message: "Phiếu đã được tạo từ đúng yêu cầu đã lưu." };
}
export async function revokeRepairCreation(scope: RepairScope, input: Record<string, unknown>, actor: RepairActor, existingSession?: ClientSession) {
  const { ticketCode, requestFingerprint } = creationIdentity(scope, input, actor);
  const work = async (session: ClientSession) => {
    const gate = await lockCreation(scope, ticketCode, requestFingerprint, session);
    // A legacy ticket may have no gate; never reserve its code from another branch.
    const ticket = await RepairTicketModel.findOne({ companyCode: scope.companyCode, ticketCode }).session(session).lean();
    if (ticket && ticket.branchId !== scope.branchId) throw creationConflict();
    const outcome = await reconcileRepairCreation(scope, input, actor, session);
    if (outcome.status === "conflict") throw creationConflict();
    if (outcome.status !== "not_found") return outcome;
    gate.revoked = true; gate.revokedAt = new Date(); gate.revokedBy = actor.id;
    await gate.save({ session });
    return { status: "revoked", message: "Đã vô hiệu hóa yêu cầu cũ. Có thể sửa nội dung và tạo bằng mã mới." };
  };
  try { return await inInventoryTransaction(work, existingSession); }
  catch (error: any) {
    if (existingSession || error?.code !== 11000 || !error?.keyPattern?.companyCode || !error?.keyPattern?.ticketCode) throw error;
    return inInventoryTransaction(work);
  }
}

export async function createRepairTicket(scope: RepairScope, input: Omit<RepairTicketDocument, "companyCode" | "branchId" | "status" | "statusHistory" | "createdAt" | "updatedAt"> & { ticketCode: string; coverage?: RepairCoverage }, actor: RepairActor, existingSession?: ClientSession, afterCommit?: AfterCommit) {
  requireEffectQueue(existingSession, afterCommit);
  const originalInput = structuredClone(input);
  const { ticketCode, requestFingerprint: creationFingerprint } = creationIdentity(scope, originalInput, actor);
  let created = false;
  const work = async (session: ClientSession) => {
    input = structuredClone(originalInput);
    created = false;
    const gate = await lockCreation(scope, ticketCode, creationFingerprint, session);
    if (gate.revoked) throw Object.assign(new Error("Yêu cầu tạo phiếu đã bị vô hiệu hóa."), { statusCode: 409, code: "REPAIR_CREATION_REVOKED" });
    const existing: any = await RepairTicketModel.findOne({ companyCode: scope.companyCode, ticketCode: String(input.ticketCode || "").trim() }).session(session).lean();
    if (existing) {
      if (existing.branchId !== scope.branchId || existing.creationFingerprint !== creationFingerprint) throw Object.assign(new Error("Repair ticket code already used with different input."), { statusCode: 409 });
      return existing;
    }
    if (!input.customerId || !input.device?.name || !input.symptom) throw Object.assign(new Error("Khách hàng, thiết bị và mô tả lỗi là bắt buộc."), { statusCode: 400 });

    const rawCustId = String(input.customerId || "").trim();
    let customerCode = (input as any).customerCode;
    if (/^[0-9a-fA-F]{24}$/.test(rawCustId)) {
      const contact = await getCustomerContact({ companyCode: scope.companyCode }, rawCustId, { includeInactive: true }).catch(() => null);
      if (contact?.customerCode) {
        customerCode = contact.customerCode;
      }
    }
    if (!customerCode && rawCustId && !/^[0-9a-fA-F]{24}$/.test(rawCustId)) {
      customerCode = rawCustId;
    }
    if (!customerCode && input.customerPhone) {
      customerCode = `KH-${input.customerPhone.trim()}`;
    }
    input.customerId = customerCode || rawCustId;
    (input as any).customerCode = customerCode;
    const ticketType = input.ticketType || "warranty";
    assertSerialForRepairType(ticketType, input.device);

    let coverage = input.coverage;
    if (ticketType === "warranty") {
      await requireSoldSerialForRepair(scope, input.device, session);
      if (!coverage) {
        coverage = { customer: { covered: true }, supplier: { covered: false }, costBearer: "shop", checkedAt: new Date() };
      }
    } else {
      // Sửa chữa dịch vụ: kiểm tra máy hệ thống để hưởng ưu đãi khách quen
      const existingDevice = await lookupDeviceOptional(scope, input.device, session);
      if (existingDevice && !input.loyaltyDiscount) {
        const settings: any = await RepairSettingsModel.findOne({ companyCode: scope.companyCode }).lean();
        const loyaltyRate = Number(settings?.loyaltyDiscountRate ?? 10);
        if (loyaltyRate > 0) {
          input.loyaltyDiscount = { rate: loyaltyRate, reason: "Khách mua máy tại hệ thống" };
        }
      }
      if (!coverage) {
        coverage = { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: new Date() };
      }
    }

    const collaborator = await resolveCollaborator(scope.companyCode, input.collaboratorId, session);
    const ticket = new RepairTicketModel({
      ...input,
      creationFingerprint,
      serialLifecycle: undefined,
      quoteFingerprint: undefined,
      quotedAmount: undefined,
      quotedAt: undefined,
      customerApprovedAt: undefined,
      paidAmount: 0,
      dueAmount: 0,
      paymentStatus: "unpaid",
      ...scope,
      ticketType,
      coverage,
      collaboratorId: collaborator ? String(collaborator._id) : undefined,
      commissionSnapshot: undefined,
      commissionRefunds: [],
      refundRequestRevocations: [],
      status: "received",
      statusHistory: [{ to: "received", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false }],
      createdBy: actor.id,
      createdByName: actor.name,
    });
    await recordRepairSerialLifecycle(ticket, "received", actor, session);
    const saved = (await ticket.save({ session })).toObject();
    created = true;
    return saved;
  };
  let saved: any;
  try { saved = await inInventoryTransaction(work, existingSession); }
  catch (error: any) {
    if (existingSession || error?.code !== 11000 || !error?.keyPattern?.ticketCode || !error?.keyPattern?.companyCode) throw error;
    saved = await inInventoryTransaction(work);
  }
  if (created) {
    const effect = () => afterRepairTicketEvent(saved, "received", actor);
    if (existingSession) afterCommit!.push(effect); else effect();
  }
  return saved;
}

/**
 * Phát sự kiện và gửi tin cho khách sau khi phiếu đã lưu. Cố ý không await: gửi tin
 * chậm hoặc hỏng không được làm hỏng việc tiếp nhận / chuyển trạng thái phiếu.
 */
function afterRepairTicketEvent(ticket: any, event: "received" | "technician_assigned" | "done" | "delivered", actor: RepairActor) {
  if (event === "received" || event === "done" || event === "delivered") {
    void publishRepairTicketEvent(event as any, ticket, actor).catch(() => undefined);
  }
  void dispatchRepairNotification(ticket, event).catch(() => undefined);
}

export async function transitionRepairTicket(scope: RepairScope, id: string, to: RepairStatus, actor: RepairActor, note?: string, customerNotified = false, existingSession?: ClientSession, technicianId?: string, afterCommit?: AfterCommit) {
  if (to === "quoted" || to === "approved") throw Object.assign(new Error("Vui lòng dùng thao tác báo giá hoặc duyệt báo giá."), { statusCode: 409, code: "REPAIR_QUOTE_WORKFLOW_REQUIRED" });
  if (to === "cancelled") return cancelRepairTicket(scope, id, note || "", actor, existingSession);
  requireEffectQueue(existingSession, afterCommit);
  let effects: AfterCommit = [];
  const result = await inInventoryTransaction(async (session) => {
    effects = [];
    const query = RepairTicketModel.findOne({ _id: id, ...scope }); if (session) query.session(session); const ticket: any = await query; if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
    if ((to === "delivered" || to === "returned") && ticket.status === to) {
      await assertRepairSerialCompletion(ticket, to, session);
      return ticket.toObject();
    }
    assertRepairTransition(ticket.status, to); const from = ticket.status;
    if (to === "delivered" && Math.max(0, Number(ticket.totalAmount || 0) - Number(ticket.paidAmount || 0)) > 0) throw Object.assign(new Error("Không thể giao máy khi phiếu còn công nợ."), { statusCode: 403, code: "REPAIR_DEBT_BLOCKED" });
    let assignedTech = false;
    if (ticket.status === "received" && to === "diagnosing") {
      if (!technicianId) throw Object.assign(new Error("Cần chọn kỹ thuật viên tiếp nhận."), { statusCode: 400 });
      const technician: any = await UserModel.findOne({ _id: technicianId, companyCode: scope.companyCode, isActive: { $ne: false } }).select("displayName email").lean();
      if (!technician) throw Object.assign(new Error("Cần chọn kỹ thuật viên tiếp nhận."), { statusCode: 400 });
      ticket.technicianId = String(technician._id);
      ticket.technicianName = String(technician.displayName || technician.email || "");
      ticket.assignedAt = new Date();
      ticket.assignedBy = actor.id;
      assignedTech = true;
    }
    if (ticket.collaboratorId && !ticket.commissionSnapshot && ["approved", "delivered"].includes(to)) ticket.commissionSnapshot = await snapshotPolicy(scope.companyCode, ticket.collaboratorId, session);
    if (to === "delivered" && ticket.commissionSnapshot) ticket.commissionSnapshot = { ...ticket.commissionSnapshot, lines: repairLines(ticket, ticket.commissionSnapshot.policy) };
    ticket.status = to; ticket.statusHistory.push({ from, to, at: new Date(), by: actor.id, byName: actor.name, note, customerNotified: to === "done" ? false : customerNotified, technicianId: ticket.technicianId, technicianName: ticket.technicianName });
    if (to === "done") {
      ticket.completedAt = new Date();
      ticket.dueAmount = Math.max(0, Number(ticket.totalAmount || 0) - Number(ticket.paidAmount || 0));
      ticket.paymentStatus = ticket.dueAmount === 0 ? "paid" : ticket.paidAmount > 0 ? "partial" : "unpaid";
      if (!ticket.feedbackToken) ticket.feedbackToken = randomUUID();
    }
    if (to === "delivered") {
      ticket.deliveredAt = new Date();
      if (!ticket.completedAt) ticket.completedAt = ticket.deliveredAt;
    }
    ticket.updatedBy = actor.id; if (session) ticket.$session(session); await ticket.save();
    const saved = ticket.toObject();
    if (to === "delivered" && saved.commissionSnapshot) await reconcileCommission("repair", id, scope.companyCode, session);
    if (to === "delivered" || to === "returned") await recordRepairSerialLifecycle(saved, to, actor, session);
    if (assignedTech) effects.push(() => afterRepairTicketEvent(saved, "technician_assigned", actor));
    if (to === "done" || to === "delivered") effects.push(() => afterRepairTicketEvent(saved, to, actor));
    return saved;
  }, existingSession);
  if (existingSession) afterCommit!.push(...effects); else effects.forEach(effect => effect());
  return result;
}

export async function quoteRepairTicket(scope: RepairScope, id: string, amount: number, actor: RepairActor, note?: string, laborFee?: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw Object.assign(new Error("Báo giá không hợp lệ."), { statusCode: 400 });
  if (laborFee !== undefined && (!Number.isSafeInteger(laborFee) || laborFee < 0 || laborFee > amount)) throw Object.assign(new Error("Tiền công phải từ 0 đến tổng báo giá."), { statusCode: 400 });
  const quoteNote = String(note || "").trim();
  const quoteFingerprint = fingerprint({ scope, id, amount, laborFee, note: quoteNote, actorId: actor.id });
  return inInventoryTransaction(async session => {
    const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }).session(session);
    if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
    if (ticket.quoteFingerprint === quoteFingerprint) return ticket.toObject();
    if (ticket.status !== "diagnosing") throw Object.assign(new Error("Phiếu đã thay đổi hoặc đã có báo giá khác. Vui lòng tải lại."), { statusCode: 409, code: "REPAIR_QUOTE_CONFLICT" });
    if (Number(ticket.paidAmount || 0) !== 0 || Number(laborFee ?? ticket.laborFee ?? 0) > amount) throw Object.assign(new Error("Tiền đã thu hoặc tiền công không phù hợp với báo giá."), { statusCode: 409, code: "REPAIR_QUOTE_CONFLICT" });
    if (laborFee !== undefined) ticket.laborFee = laborFee;
    ticket.quoteFingerprint = quoteFingerprint;
    ticket.quotedAmount = amount; ticket.quotedAt = new Date(); ticket.totalAmount = amount; ticket.dueAmount = 0; ticket.status = "quoted";
    ticket.statusHistory.push({ from: "diagnosing", to: "quoted", at: new Date(), by: actor.id, byName: actor.name, ...(quoteNote ? { note: quoteNote } : {}), customerNotified: false });
    await ticket.save({ session });
    return ticket.toObject();
  });
}

export async function approveRepairQuote(scope: RepairScope, id: string, actor: RepairActor) {
  return inInventoryTransaction(async session => {
    const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }).session(session);
    if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
    if (ticket.status === "approved" && ticket.customerApprovedAt) return ticket.toObject();
    if (ticket.status !== "quoted" || !Number.isSafeInteger(ticket.quotedAmount) || ticket.quotedAmount < 0 || ticket.totalAmount !== ticket.quotedAmount) throw Object.assign(new Error("Phiếu hoặc báo giá đã thay đổi. Vui lòng tải lại."), { statusCode: 409, code: "REPAIR_QUOTE_CONFLICT" });
    if (ticket.collaboratorId) ticket.commissionSnapshot = await snapshotPolicy(scope.companyCode, ticket.collaboratorId, session);
    ticket.customerApprovedAt = new Date(); ticket.dueAmount = 0; ticket.status = "approved";
    ticket.statusHistory.push({ from: "quoted", to: "approved", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false });
    await ticket.save({ session });
    return ticket.toObject();
  });
}

export async function deliverRepairTicket(scope: RepairScope, id: string, actor: RepairActor, _allowDebt = false) {
  return transitionRepairTicket(scope, id, "delivered", actor);
}

export type RepairPaymentRequest = { idempotencyKey: string; expectedPaidAmount: number; expectedTotalAmount: number };
function paymentRequestIdentity(scope: RepairScope, id: string, amount: number, actor: RepairActor, request?: RepairPaymentRequest) {
  const invalid = () => Object.assign(new Error("Khoản thu cần số tiền, khóa yêu cầu và số dư hợp lệ."), { statusCode: 400, code: "REPAIR_PAYMENT_INVALID" });
  const key = typeof request?.idempotencyKey === "string" ? request.idempotencyKey.trim() : "";
  if (!actor.id?.trim() || !key || key.length > 200 || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(request?.expectedPaidAmount) || request!.expectedPaidAmount < 0 || !Number.isSafeInteger(request?.expectedTotalAmount) || request!.expectedTotalAmount < request!.expectedPaidAmount) throw invalid();
  const requestFingerprint = fingerprint({ scope, id, amount, actorId: actor.id, expectedPaidAmount: request!.expectedPaidAmount, expectedTotalAmount: request!.expectedTotalAmount });
  return { key, requestFingerprint };
}

function paymentEvidenceMatches(receipt: any, ticket: any, scope: RepairScope, id: string, amount: number, actor: RepairActor, requestFingerprint: string, request: RepairPaymentRequest) {
  return !(receipt.branchId !== scope.branchId || receipt.ticketId !== id || receipt.requestFingerprint !== requestFingerprint || receipt.amount !== amount || receipt.paidBefore !== request!.expectedPaidAmount || receipt.totalAmount !== request!.expectedTotalAmount || receipt.actorId !== actor.id || ![ticket.paidAmount, ticket.totalAmount, ticket.dueAmount].every(Number.isSafeInteger) || ticket.totalAmount !== receipt.totalAmount || ticket.paidAmount < receipt.paidBefore + receipt.amount || ticket.dueAmount < 0 || ticket.paidAmount + ticket.dueAmount !== ticket.totalAmount);
}

export async function reconcileRepairPayment(scope: RepairScope, id: string, amount: number, actor: RepairActor, request?: RepairPaymentRequest, session?: ClientSession) {
  const { key, requestFingerprint } = paymentRequestIdentity(scope, id, amount, actor, request);
  const ticket = await RepairTicketModel.findOne({ ...scope, _id: id }).select("paidAmount totalAmount dueAmount").session(session ?? null).lean();
  if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  const receipt = await RepairPaymentModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).session(session ?? null).lean();
  const fence = await RepairPaymentRequestModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).session(session ?? null).lean();
  if (fence && (fence.branchId !== scope.branchId || fence.ticketId !== id || fence.requestFingerprint !== requestFingerprint || (fence.revoked && receipt))) return { status: "conflict", message: "Khóa thu tiền không khớp yêu cầu. Giữ nguyên để đối soát." };
  if (fence?.revoked) return { status: "revoked", message: "Yêu cầu đã bị vô hiệu hóa. Khóa cũ không thể ghi nhận muộn; không đảo khoản thu đã ghi sổ." };
  if (!receipt) return { status: "not_found", message: "Chưa thấy khoản thu. Yêu cầu có thể đang xử lý; chỉ thử lại nguyên yêu cầu cũ." };
  if (!paymentEvidenceMatches(receipt, ticket, scope, id, amount, actor, requestFingerprint, request!)) return { status: "conflict", message: "Khoản thu hoặc số dư không khớp. Giữ nguyên yêu cầu để đối soát." };
  return { status: "completed", message: "Khoản thu đã được ghi nhận và khớp số dư phiếu.", paymentId: String(receipt._id), amount: receipt.amount };
}

async function lockPaymentRequest(scope: RepairScope, id: string, key: string, requestFingerprint: string, session: ClientSession) {
  const fence = await RepairPaymentRequestModel.findOneAndUpdate(
    { companyCode: scope.companyCode, idempotencyKey: key },
    { $setOnInsert: { ...scope, ticketId: id, idempotencyKey: key, requestFingerprint }, $inc: { revision: 1 } },
    { upsert: true, returnDocument: "after", session }
  );
  if (fence.branchId !== scope.branchId || fence.ticketId !== id || fence.requestFingerprint !== requestFingerprint) throw Object.assign(new Error("Khóa thu tiền đã dùng cho yêu cầu khác."), { statusCode: 409, code: "REPAIR_PAYMENT_CONFLICT" });
  return fence;
}

export async function revokeRepairPayment(scope: RepairScope, id: string, amount: number, actor: RepairActor, request?: RepairPaymentRequest, existingSession?: ClientSession) {
  const { key, requestFingerprint } = paymentRequestIdentity(scope, id, amount, actor, request);
  const work = async (session: ClientSession) => {
    if (!await RepairTicketModel.exists({ ...scope, _id: id }).session(session)) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
    const fence = await lockPaymentRequest(scope, id, key, requestFingerprint, session);
    const outcome = await reconcileRepairPayment(scope, id, amount, actor, request, session);
    if (outcome.status === "conflict") throw Object.assign(new Error(outcome.message), { statusCode: 409, code: "REPAIR_PAYMENT_CONFLICT" });
    if (outcome.status !== "not_found") return outcome;
    fence.revoked = true; fence.revokedAt = new Date(); fence.revokedBy = actor.id;
    await fence.save({ session });
    return { status: "revoked", message: "Yêu cầu đã bị vô hiệu hóa. Không đảo tiền đã thu; có thể nhập lại nội dung đúng." };
  };
  try { return await inInventoryTransaction(work, existingSession); }
  catch (error: any) {
    if (existingSession || error?.code !== 11000 || !error?.keyPattern?.companyCode || !error?.keyPattern?.idempotencyKey) throw error;
    return inInventoryTransaction(work);
  }
}

export async function recordRepairPayment(scope: RepairScope, id: string, amount: number, actor: RepairActor, request?: RepairPaymentRequest) {
  const { key, requestFingerprint } = paymentRequestIdentity(scope, id, amount, actor, request);
  const invalid = () => Object.assign(new Error("Khoản thu cần số tiền, khóa yêu cầu và số dư hợp lệ."), { statusCode: 400, code: "REPAIR_PAYMENT_INVALID" });
  const conflict = () => Object.assign(new Error("Yêu cầu thu tiền hoặc số dư đã thay đổi. Cần đối chiếu khoản thu trước khi tiếp tục."), { statusCode: 409, code: "REPAIR_PAYMENT_CONFLICT" });
  const work = async (session: ClientSession) => {
    const fence = await lockPaymentRequest(scope, id, key, requestFingerprint, session);
    if (fence.revoked) throw Object.assign(new Error("Yêu cầu thu tiền đã bị vô hiệu hóa."), { statusCode: 409, code: "REPAIR_PAYMENT_REVOKED" });
    const prior = await RepairPaymentModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).session(session).lean();
    if (prior && (prior.branchId !== scope.branchId || prior.ticketId !== id || prior.requestFingerprint !== requestFingerprint)) throw conflict();
    const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }).session(session);
    if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
    if (prior) {
      if (!paymentEvidenceMatches(prior, ticket, scope, id, amount, actor, requestFingerprint, request!)) throw conflict();
      return ticket.toObject();
    }
    if (ticket.status !== "done") throw Object.assign(new Error("Chỉ ghi nhận thanh toán khi giao máy."), { statusCode: 409, code: "REPAIR_PAYMENT_NOT_DUE" });
    if (ticket.paidAmount !== request!.expectedPaidAmount || ticket.totalAmount !== request!.expectedTotalAmount) throw conflict();
    const due = ticket.totalAmount - ticket.paidAmount;
    if (amount > due) throw invalid();
    await RepairPaymentModel.create([{ ...scope, ticketId: id, idempotencyKey: key, requestFingerprint, amount, paidBefore: ticket.paidAmount, totalAmount: ticket.totalAmount, actorId: actor.id, actorName: actor.name }], { session });
    ticket.paidAmount += amount; ticket.dueAmount = ticket.totalAmount - ticket.paidAmount;
    ticket.paymentStatus = ticket.dueAmount === 0 ? "paid" : "partial"; ticket.updatedBy = actor.id;
    await ticket.save({ session });
    return ticket.toObject();
  };
  try { return await inInventoryTransaction(work); }
  catch (error: any) {
    if (error?.code !== 11000 || !error?.keyPattern?.companyCode || !error?.keyPattern?.idempotencyKey) throw error;
    return inInventoryTransaction(work);
  }
}

export async function cancelRepairTicket(scope: RepairScope, id: string, reason: string, actor: RepairActor, existingSession?: ClientSession) {
  const note = String(reason || "").trim(); if (!note) throw Object.assign(new Error("Lý do hủy phiếu là bắt buộc."), { statusCode: 400 });
  return inInventoryTransaction(async (session) => {
    const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }).session(session);
    if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
    const { listRepairParts, returnRepairPart } = await import("./repair-part.service");
    if (ticket.status === "cancelled" && ticket.statusHistory.at(-1)?.note === note) {
      await assertRepairSerialCompletion(ticket, "cancelled", session);
      const parts = await listRepairParts(scope, id, session);
      if (parts.some((part) => part.status === "issued")) throw Object.assign(new Error("Phiếu đã hủy còn linh kiện chưa hoàn. Cần đối soát dữ liệu cũ."), { statusCode: 409 });
      return ticket.toObject();
    }
    assertRepairTransition(ticket.status, "cancelled");
    const from = ticket.status;
    ticket.status = "cancelled";
    ticket.statusHistory.push({ from, to: "cancelled", at: new Date(), by: actor.id, byName: actor.name, note, customerNotified: false });
    await recordRepairSerialLifecycle(ticket, "cancelled", actor, session);
    await ticket.save({ session });
    for (const part of await listRepairParts(scope, id, session)) {
      if (part.status !== "issued") continue;
      await returnRepairPart(scope, id, String(part._id), `Huỷ phiếu: ${note}`, actor, session, undefined, true);
    }
    return RepairTicketModel.findOne({ _id: id, ...scope }).session(session).lean();
  }, existingSession);
}

export async function createFeedbackQr(scope: RepairScope, id: string) {
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (ticket.status !== "done") throw Object.assign(new Error("Chỉ tạo QR khi phiếu đã sửa xong."), { statusCode: 409 });
  if (!ticket.feedbackToken) { ticket.feedbackToken = randomUUID(); await ticket.save(); }
  return { ticketCode: ticket.ticketCode, feedbackToken: ticket.feedbackToken, url: `/repair/feedback/${ticket.feedbackToken}` };
}
