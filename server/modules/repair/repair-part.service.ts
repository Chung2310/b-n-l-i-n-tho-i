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

  ticket.partCost = partCost;
  ticket.partRevenue = partRevenue;
  ticket.totalAmount = locked ? Number(ticket.quotedAmount) : computed;
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

function replayPart(part: any, scope: RepairScope, ticketId: string, fingerprint: string) {
  if (part.branchId !== scope.branchId || part.ticketId !== ticketId || part.requestFingerprint !== fingerprint) {
    partError("Khóa xuất linh kiện đã được dùng cho nội dung khác hoặc phiếu cũ cần đối soát.");
  }
  return part;
}

export async function issueRepairPart(scope: RepairScope, ticketId: string, input: { productId: string; sku: string; productName: string; quantity: number; unitCost: number; unitPrice: number; serialNumbers?: string[]; idempotencyKey: string; billing?: RepairPartBilling; manual?: boolean }, actor: RepairActor) {
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
  try {
    return await inInventoryTransaction(async (session) => {
      const existing = await RepairPartModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).session(session).lean();
      if (existing) return replayPart(existing, scope, ticketId, fingerprint);
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
  } catch (error: any) {
    if (error?.code === 11000) {
      const existing = await RepairPartModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean();
      if (existing) return replayPart(existing, scope, ticketId, fingerprint);
    }
    throw error;
  }
}
export async function returnRepairPart(scope: RepairScope, ticketId: string, partId: string, reason: string, actor: RepairActor, existingSession?: ClientSession) {
  const note = String(reason || "").trim(); if (!note) throw Object.assign(new Error("Lý do hoàn linh kiện là bắt buộc."), { statusCode: 400 });
  return inInventoryTransaction(async (session) => {
    const ticket = await lockTicket(scope, ticketId, session);
    const part: any = await RepairPartModel.findOne({ _id: partId, ...scope, ticketId }).session(session);
    if (!part) partError("Không tìm thấy linh kiện.", 404);
    if (part.status === "returned" && part.returnReason === note) return part.toObject();
    if (part.status !== "issued") partError("Linh kiện đã được hoàn hoặc hủy.");
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
    part.status = "returned"; part.returnedAt = new Date(); part.returnReason = note; part.updatedBy = actor.id; part.returnedByName = actor.name;
    await part.save({ session });
    const amounts = await recomputeRepairTicketAmounts(ticket, session);
    return { ...part.toObject(), ticketAmounts: amounts };
  }, existingSession);
}
