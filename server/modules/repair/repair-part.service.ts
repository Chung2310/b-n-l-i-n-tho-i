import { RepairPartRequestModel } from "./repair-part-request.model";
import { RepairPartModel } from "./repair-part.model";
import type { RepairActor, RepairScope } from "./repair-ticket.service";
import { RepairTicketModel } from "./repair-ticket.model";
import { writeStockMovement } from "../../integrations/shared/stock-movement.service";
import { createHash } from "node:crypto";
import type { ClientSession } from "mongoose";
import { inInventoryTransaction } from "../inventory/inventory-transaction";
import { resolveInventoryVariant, resolveInventoryWarehouse } from "../inventory/inventory-scope";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { ProductCatalogLegacyMappingModel } from "../../model/product-catalog-legacy-mapping.model";


export type RepairPartBilling = "customer" | "warranty_shop" | "warranty_supplier";

/** Ai chịu chi phí linh kiện suy ra từ diện bảo hành đã chốt lúc tiếp nhận. */
export function defaultPartBilling(costBearer: unknown): RepairPartBilling {
  if (costBearer === "supplier") return "warranty_supplier";
  if (costBearer === "shop") return "warranty_shop";
  return "customer";
}

/**
 * Tính lại tiền của phiếu từ toàn bộ linh kiện còn hiệu lực. Tính lại (thay vì cộng dồn)
 * để hoàn linh kiện cũng trả đúng số, không bị lệch dần.
 *
 * - partCost  = giá vốn mọi linh kiện, kể cả linh kiện bảo hành — dùng tính lãi và chi phí bảo hành.
 * - partRevenue = chỉ linh kiện khách trả tiền.
 * - Phiếu đã báo giá và khách đã duyệt thì GIỮ NGUYÊN số đã cam kết; phần lệch trả về
 *   cho nhân viên báo lại khách chứ không âm thầm tăng tiền.
 */
export async function recomputeRepairTicketAmounts(ticket: any, session?: ClientSession) {
  const query = RepairPartModel.find({ companyCode: ticket.companyCode, branchId: ticket.branchId, ticketId: String(ticket._id), status: "issued" });
  const parts: any[] = await (session ? query.session(session) : query).lean();
  const partCost = parts.reduce((total, part) => total + Number(part.unitCost || 0) * Number(part.quantity || 0), 0);
  const partRevenue = parts.reduce((total, part) => total + (part.chargeable === false ? 0 : Number(part.unitPrice || 0) * Number(part.quantity || 0)), 0);
  const subtotal = Math.max(0, Number(ticket.laborFee || 0) + partRevenue - Number(ticket.discountAmount || 0));
  const loyaltyRate = Number(ticket.loyaltyDiscount?.rate || 0);
  const loyaltyDiscount = loyaltyRate > 0 ? Math.round((subtotal * loyaltyRate) / 100) : 0;
  if (ticket.loyaltyDiscount) {
    ticket.loyaltyDiscount.amount = loyaltyDiscount;
  }
  const computed = Math.max(0, subtotal - loyaltyDiscount);
  const locked = Number.isFinite(Number(ticket.quotedAmount)) && ticket.quotedAmount !== undefined && ticket.quotedAmount !== null && Boolean(ticket.customerApprovedAt);
  const totalAmount = locked ? Number(ticket.quotedAmount) : computed;
  const paidAmount = Number(ticket.paidAmount || 0);
  if (!Number.isFinite(totalAmount) || !Number.isFinite(paidAmount) || paidAmount < 0 || totalAmount < paidAmount) {
    throw Object.assign(new Error("Tổng tiền sau điều chỉnh thấp hơn số đã thu hoặc dữ liệu tiền không hợp lệ. Cần đối chiếu và xử lý hoàn tiền trước."), { statusCode: 409, code: "REPAIR_AMOUNT_CONFLICT" });
  }

  ticket.partCost = partCost;
  ticket.partRevenue = partRevenue;
  ticket.totalAmount = totalAmount;
  ticket.dueAmount = Math.max(0, ticket.totalAmount - Number(ticket.paidAmount || 0));
  ticket.paymentStatus = ticket.dueAmount === 0 ? (ticket.paidAmount > 0 ? "paid" : ticket.paymentStatus) : Number(ticket.paidAmount || 0) > 0 ? "partial" : "unpaid";
  await ticket.save(session ? { session } : {});
  return { partCost, partRevenue, totalAmount: ticket.totalAmount, quoteDeviation: locked ? computed - Number(ticket.quotedAmount) : 0 };
}

export async function listRepairParts(scope: RepairScope, ticketId: string, session?: ClientSession) { return RepairPartModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, ticketId }).session(session || null).sort({ issuedAt: -1 }).lean(); }

function partError(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}

// A real write serializes concurrent part changes, even when both are free of charge.
async function lockTicket(scope: RepairScope, ticketId: string, session: ClientSession) {
  const ticket: any = await RepairTicketModel.findOneAndUpdate({ _id: ticketId, ...scope }, { $inc: { partsVersion: 1 } }, { returnDocument: "after", session });
  if (!ticket) partError("Không tìm thấy phiếu sửa chữa.", 404);
  return ticket;
}

function replayPart(part: any, scope: RepairScope, ticketId: string, fingerprint: string, actor: RepairActor) {
  if (!actor.id || part.issuedBy !== actor.id || part.branchId !== scope.branchId || part.ticketId !== ticketId || part.requestFingerprint !== fingerprint) {
    partError("Khóa xuất linh kiện đã được dùng cho nội dung khác hoặc phiếu cũ cần đối soát.");
  }
  return part;
}

export type RepairPartIssueInput = { productId: string; sku: string; productName: string; quantity: number; unitCost: number; unitPrice: number; serialNumbers?: string[]; idempotencyKey: string; billing?: RepairPartBilling; manual?: boolean };
function issueIdentity(scope: RepairScope, ticketId: string, input: RepairPartIssueInput) {
  if (!input || typeof input !== "object") partError("Thiếu nội dung xuất linh kiện.", 400);
  const key = String(input.idempotencyKey || "").trim(); if (!key) throw Object.assign(new Error("idempotencyKey là bắt buộc."), { statusCode: 400 });
  const quantity = Number(input.quantity); if (!Number.isInteger(quantity) || quantity <= 0) throw Object.assign(new Error("Số lượng linh kiện không hợp lệ."), { statusCode: 400 });
  const manual = Boolean(input.manual);
  const unitPrice = Number(input.unitPrice), manualCost = Number(input.unitCost);
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || (manual && (!Number.isFinite(manualCost) || manualCost < 0))) partError("Giá linh kiện không hợp lệ.", 400);
  if (input.serialNumbers?.length) partError("Xuất linh kiện có mã máy cần quy trình quản lý serial; chưa hỗ trợ tại đây.", 400);
  if (input.billing && !["customer", "warranty_shop", "warranty_supplier"].includes(input.billing)) partError("Diện chi phí không hợp lệ.", 400);
  const sku = String(input.sku || "").trim().toUpperCase(), productName = String(input.productName || "").trim();
  const productId = manual ? `manual:${key}` : String(input.productId || "").trim();
  const fingerprint = createHash("sha256").update(JSON.stringify({ branchId: scope.branchId, ticketId, productId, sku, productName, quantity, unitPrice, manual, manualCost: manual ? manualCost : undefined, billing: input.billing || null })).digest("hex");
  return { key, quantity, manual, unitPrice, manualCost, sku, productName, productId, fingerprint };
}
export type RepairPartRequest = { kind: "issue"; input: RepairPartIssueInput } | { kind: "return"; partId: string; reason: string; idempotencyKey?: string };
const partRequestConflict = () => Object.assign(new Error("Khóa linh kiện hoặc nội dung không khớp. Giữ nguyên để đối soát."), { statusCode: 409, code: "REPAIR_PART_REQUEST_CONFLICT" });
function partRequestIdentity(scope: RepairScope, ticketId: string, request: RepairPartRequest, actor: RepairActor, cancellation = false) {
  if (!actor.id?.trim() || !request || !["issue", "return"].includes(request.kind)) partError("Yêu cầu linh kiện không hợp lệ.", 400);
  let requestKey: string, content: unknown;
  if (request.kind === "issue") {
    const identity = issueIdentity(scope, ticketId, request.input);
    requestKey = identity.key; content = identity.fingerprint;
  } else {
    if (typeof request.partId !== "string" || !request.partId.trim() || typeof request.reason !== "string" || !request.reason.trim()) partError("Thiếu linh kiện hoặc lý do hoàn.", 400);
    if (request.idempotencyKey !== undefined && (typeof request.idempotencyKey !== "string" || !request.idempotencyKey.trim())) partError("Khóa yêu cầu hoàn không hợp lệ.", 400);
    requestKey = cancellation ? "cancel:" + ticketId + ":" + request.partId : request.idempotencyKey === undefined ? "legacy:" + ticketId + ":" + request.partId : "request:" + request.idempotencyKey.trim();
    content = { partId: request.partId, reason: request.reason.trim() };
  }
  const requestFingerprint = createHash("sha256").update(JSON.stringify({ scope, ticketId, kind: request.kind, actorId: actor.id, content })).digest("hex");
  return { requestKey, requestFingerprint };
}
async function lockPartRequest(scope: RepairScope, ticketId: string, kind: RepairPartRequest["kind"], identity: { requestKey: string; requestFingerprint: string }, session: ClientSession) {
  const gate = await RepairPartRequestModel.findOneAndUpdate({ companyCode: scope.companyCode, kind, requestKey: identity.requestKey },
    { $setOnInsert: { ...scope, ticketId, kind, ...identity }, $inc: { revision: 1 } }, { upsert: true, returnDocument: "after", session });
  if (gate.branchId !== scope.branchId || gate.ticketId !== ticketId || gate.requestFingerprint !== identity.requestFingerprint) throw partRequestConflict();
  return gate;
}
function assertPartRequestActive(gate: { revoked: boolean }) {
  if (gate.revoked) throw Object.assign(new Error("Yêu cầu linh kiện đã bị vô hiệu hóa."), { statusCode: 409, code: "REPAIR_PART_REQUEST_REVOKED" });
}
async function partRequestTransaction<T>(work: (session: ClientSession) => Promise<T>, session?: ClientSession): Promise<T> {
  try { return await inInventoryTransaction(work, session); }
  catch (error: any) {
    if (session || error?.code !== 11000 || !error?.keyPattern?.companyCode || !(error?.keyPattern?.requestKey || error?.keyPattern?.idempotencyKey)) throw error;
    return inInventoryTransaction(work);
  }
}
export async function issueRepairPart(scope: RepairScope, ticketId: string, input: RepairPartIssueInput, actor: RepairActor) {
  if (!actor.id?.trim()) partError("Thiếu người thao tác.", 400);
  const { key, quantity, manual, unitPrice, manualCost, sku, productName, productId, fingerprint } = issueIdentity(scope, ticketId, input);
  const identity = partRequestIdentity(scope, ticketId, { kind: "issue", input }, actor);
  return partRequestTransaction(async session => {
      assertPartRequestActive(await lockPartRequest(scope, ticketId, "issue", identity, session));
      const existing = await RepairPartModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).session(session).lean();
      if (existing) return replayPart(existing, scope, ticketId, fingerprint, actor);
      const ticket = await lockTicket(scope, ticketId, session);
      if (!["approved", "repairing"].includes(ticket.status)) partError("Chỉ được xuất linh kiện khi phiếu đã được duyệt hoặc đang sửa.");
      let unitCost = manualCost, warehouseId: string | undefined, variantId: string | undefined, issueLedgerId: string | undefined;
      let stockProductId = productId;
      if (!manual) {
        const mapping = await ProductCatalogLegacyMappingModel.findOne({ companyCode: scope.companyCode, legacyProductId: productId }).session(session).lean();
        if (mapping && mapping.legacyBranchId !== scope.branchId) partError("Sản phẩm cũ không thuộc chi nhánh đang thao tác.");
        stockProductId = mapping?.productId || productId;
        const { variant } = await resolveInventoryVariant(scope.companyCode, { productId: stockProductId, variantId: mapping?.variantId, sku }, session);
        if (variant.trackingMode !== "quantity") partError("Chỉ hỗ trợ xuất linh kiện quản lý theo số lượng; serial và lô cần quy trình riêng.");
        variantId = String(variant._id);
        const warehouse = await resolveInventoryWarehouse(scope, undefined, session);
        const movement = await writeStockMovement({ ...scope, warehouseId: String(warehouse._id), direction: "out", purpose: "other", sourceType: "repair-ticket", sourceId: ticketId, idempotencyKey: key, operatorName: actor.name, items: [{ productId: stockProductId, variantId, sku, productName, quantity, unitPrice, lineTotal: quantity * unitPrice }], reason: `Xuất linh kiện cho phiếu ${ticket.ticketCode}`, session });
        if (movement.replayed) partError("Đã có bút toán xuất nhưng thiếu chứng từ linh kiện. Cần đối soát dữ liệu cũ.");
        unitCost = Number(movement.entries[0].unitCost);
        warehouseId = movement.warehouseId;
        issueLedgerId = String(movement.entries[0]._id);
      }
      const billing: RepairPartBilling = input.billing || defaultPartBilling(ticket.coverage?.costBearer);
      const chargeable = billing === "customer";
      const partData = { productId: stockProductId, variantId, warehouseId, issueLedgerId, requestFingerprint: fingerprint, sku, productName, unitCost, unitPrice, manual, billing, chargeable, ...scope, ticketId, quantity, idempotencyKey: key, lineTotal: chargeable ? quantity * unitPrice : 0, status: "issued" as const, issuedBy: actor.id, issuedByName: actor.name, issuedAt: new Date() };
      const [part] = await RepairPartModel.create([partData], { session });
      const amounts = await recomputeRepairTicketAmounts(ticket, session);
      return { ...part.toObject(), ticketAmounts: amounts };
  });
}
export async function returnRepairPart(scope: RepairScope, ticketId: string, partId: string, reason: string, actor: RepairActor, existingSession?: ClientSession, requestKey?: string, cancellation = false) {
  if (cancellation && !existingSession) partError("Hoàn theo hủy phiếu cần transaction của phiếu.", 503);
  if (!actor.id?.trim()) partError("Thiếu người thao tác.", 400);
  const note = String(reason || "").trim(); if (!note) throw Object.assign(new Error("Lý do hoàn linh kiện là bắt buộc."), { statusCode: 400 });
  const identity = partRequestIdentity(scope, ticketId, { kind: "return", partId, reason: note, idempotencyKey: requestKey }, actor, cancellation);
  return partRequestTransaction(async (session) => {
    assertPartRequestActive(await lockPartRequest(scope, ticketId, "return", identity, session));
    const ticket = await lockTicket(scope, ticketId, session);
    const part: any = await RepairPartModel.findOne({ _id: partId, ...scope, ticketId }).session(session);
    if (!part) partError("Không tìm thấy linh kiện.", 404);
    if (part.status === "returned" && part.returnReason === note && part.updatedBy === actor.id && (part.returnRequestKey || "legacy:" + ticketId + ":" + partId) === identity.requestKey) return part.toObject();
    if (part.status !== "issued") partError("Linh kiện đã được hoàn hoặc hủy.");
    if (!["approved", "repairing", "waiting_parts", "waiting_supplier"].includes(ticket.status) && !(ticket.status === "cancelled" && existingSession)) {
      throw Object.assign(new Error("Không thể hoàn linh kiện trực tiếp trên phiếu đã chốt. Cần mở lại quy trình sửa chữa hoặc xử lý chứng từ điều chỉnh."), { statusCode: 409, code: "REPAIR_PART_RETURN_STATE" });
    }
    if (!part.manual) {
      const entries = await InventoryLedgerEntryModel.find({ ...scope, idempotencyKey: part.idempotencyKey }).session(session).lean();
      const source = entries[0];
      if (entries.length !== 1 || source.sourceType !== "repair-ticket" || source.sourceId !== ticketId || source.direction !== "out" || source.purpose !== "other" || source.productId !== part.productId || source.sku !== part.sku || source.quantity !== part.quantity || !Number.isFinite(source.unitCost) || source.unitCost < 0 || (part.issueLedgerId && part.issueLedgerId !== String(source._id)) || (part.warehouseId && part.warehouseId !== source.warehouseId) || (part.variantId && part.variantId !== source.variantId)) partError("Không đối chiếu được bút toán xuất linh kiện gốc. Cần kiểm tra dữ liệu trước khi hoàn.");
      const { variant } = await resolveInventoryVariant(scope.companyCode, { productId: source.productId, variantId: source.variantId, sku: source.sku }, session);
      if (variant.trackingMode !== "quantity" || part.serialNumbers?.length) partError("Hoàn linh kiện có serial hoặc lô cần quy trình riêng.");
      await resolveInventoryWarehouse(scope, source.warehouseId, session);
      const movement = await writeStockMovement({ ...scope, warehouseId: source.warehouseId, direction: "in", purpose: "other", sourceType: "repair-ticket", sourceId: ticketId, idempotencyKey: `repair:${ticketId}:part:${partId}:return`, operatorName: actor.name, items: [{ productId: source.productId, variantId: source.variantId, sku: source.sku, productName: part.productName, quantity: source.quantity, unitCost: source.unitCost, unitPrice: part.unitPrice, lineTotal: part.lineTotal }], reason: note, session });
      if (movement.replayed) partError("Đã có bút toán hoàn nhưng linh kiện chưa cập nhật. Cần đối soát dữ liệu cũ.");
      part.returnLedgerId = String(movement.entries[0]._id);
    }
    part.returnRequestKey = identity.requestKey;
    part.status = "returned"; part.returnedAt = new Date(); part.returnReason = note; part.updatedBy = actor.id; part.returnedByName = actor.name;
    await part.save({ session });
    const amounts = await recomputeRepairTicketAmounts(ticket, session);
    return { ...part.toObject(), ticketAmounts: amounts };
  }, existingSession);
}

async function partStockEvidence(part: any, scope: RepairScope, returning: boolean, session?: ClientSession) {
  if (part.manual) return part.productId === "manual:" + part.idempotencyKey && !part.issueLedgerId && !part.returnLedgerId && Number.isFinite(part.unitCost) && part.unitCost >= 0 && Number.isSafeInteger(part.quantity) && part.quantity > 0;
  const matches = (row: any, direction: string, ledgerId: string) => row && String(row._id) === ledgerId && row.sourceType === "repair-ticket" && row.sourceId === part.ticketId && row.purpose === "other" && row.direction === direction && row.warehouseId === part.warehouseId && row.productId === part.productId && row.variantId === part.variantId && row.sku === part.sku && row.quantity === part.quantity && row.unitCost === part.unitCost && row.quantityDelta === (direction === "out" ? -part.quantity : part.quantity);
  const issued = await InventoryLedgerEntryModel.find({ ...scope, idempotencyKey: part.idempotencyKey }).session(session ?? null).lean();
  if (issued.length !== 1 || !matches(issued[0], "out", part.issueLedgerId)) return false;
  if (!returning) return true;
  const returned = await InventoryLedgerEntryModel.find({ ...scope, idempotencyKey: "repair:" + part.ticketId + ":part:" + part._id + ":return" }).session(session ?? null).lean();
  return returned.length === 1 && matches(returned[0], "in", part.returnLedgerId) && returned[0].reason === part.returnReason;
}
export async function reconcileRepairPart(scope: RepairScope, ticketId: string, request: RepairPartRequest, actor: RepairActor, session?: ClientSession) {
  if (!actor.id?.trim() || !request || !["issue", "return"].includes(request.kind)) partError("Yêu cầu đối chiếu không hợp lệ.", 400);
  const identity = partRequestIdentity(scope, ticketId, request, actor);
  if (!await RepairTicketModel.exists({ ...scope, _id: ticketId }).session(session ?? null)) partError("Không tìm thấy phiếu sửa chữa.", 404);
  const gate = await RepairPartRequestModel.findOne({ companyCode: scope.companyCode, kind: request.kind, requestKey: identity.requestKey }).session(session ?? null).lean();
  if (gate && (gate.branchId !== scope.branchId || gate.ticketId !== ticketId || gate.requestFingerprint !== identity.requestFingerprint)) throw partRequestConflict();
  let part: any;
  if (request.kind === "issue") {
    const { key, fingerprint } = issueIdentity(scope, ticketId, request.input);
    part = await RepairPartModel.findOne({ ...scope, ticketId, idempotencyKey: key }).session(session ?? null).lean();
    if (gate?.revoked) {
      if (part) throw partRequestConflict();
      return { status: "revoked", message: "Yêu cầu đã bị vô hiệu hóa, không thể ghi kho muộn." };
    }
    if (part) {
      replayPart(part, scope, ticketId, fingerprint, actor);
      const expected = issueIdentity(scope, ticketId, request.input);
      if (part.quantity !== expected.quantity || part.sku !== expected.sku || part.productName !== expected.productName || part.unitPrice !== expected.unitPrice || part.manual !== expected.manual || (expected.manual && part.unitCost !== expected.manualCost) || (request.input.billing && part.billing !== request.input.billing) || part.lineTotal !== (part.chargeable ? part.quantity * part.unitPrice : 0)) return { status: "conflict", message: "Chứng từ linh kiện khác yêu cầu gốc. Cần đối soát." };
    }
  } else {
    if (!request.partId || !request.reason?.trim()) partError("Thiếu linh kiện hoặc lý do hoàn.", 400);
    part = await RepairPartModel.findOne({ ...scope, ticketId, _id: request.partId }).session(session ?? null).lean();
    if (gate?.revoked) {
      if (part?.status === "returned" && (part.returnRequestKey || "legacy:" + ticketId + ":" + request.partId) === identity.requestKey) throw partRequestConflict();
      return { status: "revoked", message: "Yêu cầu đã bị vô hiệu hóa, không thể ghi kho muộn." };
    }
    if (part && part.status === "issued") return { status: "not_found", message: "Chưa thấy kết quả hoàn. Giữ nguyên yêu cầu." };
    if (part && (part.status !== "returned" || part.returnReason !== request.reason.trim() || part.updatedBy !== actor.id || (part.returnRequestKey || "legacy:" + ticketId + ":" + request.partId) !== identity.requestKey)) partError("Nội dung hoặc người hoàn không khớp. Cần đối soát.");
  }
  if (!part) return { status: "not_found", message: "Chưa thấy kết quả. Giữ nguyên yêu cầu, không đổi khóa." };
  if (!["issued", "returned"].includes(part.status) || !await partStockEvidence(part, scope, request.kind === "return", session)) return { status: "conflict", message: "Chứng từ linh kiện và bút toán kho không khớp. Giữ nguyên để đối soát." };
  return { status: "completed", partId: String(part._id), message: "Đã đối chiếu chứng từ linh kiện và bút toán kho." };
}

export async function revokeRepairPartRequest(scope: RepairScope, ticketId: string, request: RepairPartRequest, actor: RepairActor, existingSession?: ClientSession) {
  const identity = partRequestIdentity(scope, ticketId, request, actor);
  return partRequestTransaction(async session => {
    if (!await RepairTicketModel.exists({ ...scope, _id: ticketId }).session(session)) partError("Không tìm thấy phiếu sửa chữa.", 404);
    const gate = await lockPartRequest(scope, ticketId, request.kind, identity, session);
    if (request.kind === "issue") {
      const existing = await RepairPartModel.findOne({ companyCode: scope.companyCode, idempotencyKey: identity.requestKey }).session(session).lean();
      if (existing && (existing.branchId !== scope.branchId || existing.ticketId !== ticketId)) throw partRequestConflict();
    } else if (!await RepairPartModel.exists({ ...scope, ticketId, _id: request.partId }).session(session)) partError("Không tìm thấy linh kiện.", 404);
    const result = await reconcileRepairPart(scope, ticketId, request, actor, session);
    if (result.status === "conflict") throw partRequestConflict();
    if (result.status !== "not_found") return result;
    // An orphaned historical stock entry is not evidence of a request that never posted.
    const ledgerKey = request.kind === "issue" ? identity.requestKey : "repair:" + ticketId + ":part:" + request.partId + ":return";
    if (await InventoryLedgerEntryModel.exists({ companyCode: scope.companyCode, idempotencyKey: ledgerKey }).session(session)) throw partRequestConflict();
    gate.revoked = true; gate.revokedAt = new Date(); gate.revokedBy = actor.id;
    await gate.save({ session });
    return { status: "revoked", message: "Đã vô hiệu hóa yêu cầu. Không đảo kho đã ghi; có thể nhập lại bằng khóa mới." };
  }, existingSession);
}
