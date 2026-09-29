import { attachAfterSaleHistory } from "./retail-after-sale-history";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { resolveCollaborator, snapshotRetail } from "../../partners/commission-snapshot";
import { reconcileCommission } from "../../partners/commission.service";
import type { RetailPaymentStatus } from "../interfaces/retail-order.interface";
import { RETAIL_PAYMENT_METHODS } from "../models/retail-order.model";
import { createHash } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { ProductModel } from "../../../model/product.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { BranchModel } from "../../../model/branch.model";
import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailOrderCounterModel } from "../models/retail-order-counter.model";
import { RetailIdempotencyModel } from "../models/retail-idempotency.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import { getBillingProfile, getCustomerBrief } from "../../customer-management/contracts";
import { calculateOrderTotals, toDiscountInput } from "./retail-pricing.service";
import { consumeCoupon, releaseCoupon, resolveCoupon } from "./retail-coupon.service";
import { getResolvedRetailSettings } from "./retail-settings.service";
import { applyOrderStockOut, revertOrderStock } from "./retail-stock.service";
import { issueRetailInvoice } from "./retail-invoice.service";
import { businessDateInVietnam } from "./cashier-shift.service";
import { buildOrderListQuery } from "./retail-query.service";
import type { PostReceivableEntryInput } from "../interfaces/retail-receivable.interface";
import { enqueueTierRefresh, processTierRefreshBySourceKey } from "./retail-customer-tier.service";
import { publishRetailOrderEvent } from "./retail-order-events";
import { claimSerialsForOrder, releaseSerialsForOrder } from "./retail-serial-order.service";
import { ensureDefaultWarehouse } from "../../inventory/warehouse/warehouse.service";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { CustomerPointLedgerModel } from "../../customer-management/models/customer-point-ledger.model";
import { CustomerPointService } from "../../customer-management/services/customer-point.service";
import { CustomerSettingsService } from "../../customer-management/services/customer-settings.service";

export function receivableEntriesForOrderChange(action: "confirm" | "collect" | "cancel", order: any, collectedAmount: number): PostReceivableEntryInput[] {
  const orderId = String(order._id);
  const customerId = String(order.customerId || "");
  if (!customerId) return [];
  if (action === "confirm" && order.dueAmount > 0) return [{ type: "charge", customerId, orderId, amount: order.dueAmount, idempotencyKey: `retail-order:${orderId}:debt-charge` }];
  if (action === "collect" && collectedAmount > 0) return [{ type: "payment", customerId, orderId, amount: collectedAmount, idempotencyKey: `retail-order:${orderId}:debt-payment:${collectedAmount}:${order.dueAmount}` }];
  if (action === "cancel" && order.dueAmount > 0) return [{ type: "reversal", customerId, orderId, amount: order.dueAmount, reason: "Hủy số dư công nợ của đơn", idempotencyKey: `retail-order:${orderId}:debt-cancel` }];
  return [];
}

export function tierRefreshForOrderChange(action: "confirm" | "cancel", order: any) {
  const customerId = String(order.customerId || "");
  if (!customerId) return null;
  return { customerId, sourceKey: `retail-order:${order._id}:tier-${action}` };
}

export function validateRetailSerialItems(items: Array<{ quantity: number; trackingMode?: string; serialNumbers?: string[]; internalBarcodes?: string[] }>) {
  for (const item of items) {
    const serials = item.serialNumbers || [];
    const barcodes = item.internalBarcodes || [];
    if (item.trackingMode === "serial" && serials.length !== Number(item.quantity)) throw new Error("Sản phẩm quản lý IMEI/serial phải chọn đủ mã theo số lượng.");
    if (item.trackingMode === "unit_barcode" && barcodes.length !== Number(item.quantity)) throw new Error("Sản phẩm quản lý mã vạch phải chọn đủ mã theo số lượng.");
    if (item.trackingMode !== "serial" && serials.length) throw new Error("Sản phẩm này không hỗ trợ IMEI/serial.");
    if (item.trackingMode !== "unit_barcode" && barcodes.length) throw new Error("Sản phẩm này không hỗ trợ mã vạch từng đơn vị.");
    if (new Set(serials.map((serial) => String(serial).trim().toUpperCase())).size !== serials.length) throw new Error("IMEI/serial trong đơn không được trùng.");
    if (new Set(barcodes.map((barcode) => String(barcode).trim().toUpperCase())).size !== barcodes.length) throw new Error("Mã vạch trong đơn không được trùng.");
  }
}

async function enqueueOrderTierRefresh(scope: RetailBranchScope, action: "confirm" | "cancel", order: any, session: mongoose.ClientSession) {
  const refresh = tierRefreshForOrderChange(action, order);
  if (refresh) await enqueueTierRefresh(scope, refresh.customerId, refresh.sourceKey, session);
}
export function scheduleOrderTierRefreshAfterCommit(
  scope: RetailBranchScope,
  action: "confirm" | "cancel",
  order: any,
  processor = processTierRefreshBySourceKey,
) {
  const refresh = tierRefreshForOrderChange(action, order);
  if (!refresh) return false;
  setImmediate(() => void processor(scope.companyCode, refresh.sourceKey).catch((error) => console.error("[retail-tier-refresh]", error)));
  return true;
}

async function awardOrderPoints(scope: RetailBranchScope, order: any, session: mongoose.ClientSession) {
  if (!order.customerId) return;
  try {
    const settings = await CustomerSettingsService.getSettings(scope.companyCode).catch(() => null);
    if (settings?.pointsPolicy && !settings.pointsPolicy.enabled) return;

    const grossProfitPerPoint = settings?.pointsPolicy?.grossProfitPerPoint || 10000;
    const grossProfit = Math.max(0, Number(order.grandTotal || 0) - Number(order.totalCost || 0));
    if (grossProfit <= 0) return;

    const customer = await CustomerModel.findOne({ _id: order.customerId, companyCode: scope.companyCode }).session(session).lean();
    const multiplier = Number(customer?.tier?.pointMultiplier || 1);
    const basePoints = Math.floor(grossProfit / grossProfitPerPoint);
    const points = Math.floor(basePoints * (multiplier > 0 ? multiplier : 1));

    if (points > 0) {
      await CustomerPointService.earnPoints({
        companyCode: scope.companyCode,
        branchId: scope.branchId,
        customerId: String(order.customerId),
        points,
        sourceType: "retail_order",
        sourceId: String(order._id),
        sourceCode: order.orderCode,
        reason: `Tích điểm đơn hàng ${order.orderCode}`,
        session,
      });
    }
  } catch (err) {
    console.error("[awardOrderPoints] error:", err);
  }
}

async function revertOrderPointsOnCancel(scope: RetailBranchScope, order: any, actor: any, session: mongoose.ClientSession) {
  if (!order.customerId) return;
  try {
    const earnLedger = await CustomerPointLedgerModel.findOne({
      companyCode: scope.companyCode,
      sourceId: String(order._id),
      type: "EARN_ORDER",
    }).session(session);

    if (earnLedger && earnLedger.points > 0) {
      const priorReverts = await CustomerPointLedgerModel.find({
        companyCode: scope.companyCode,
        sourceId: String(order._id),
        type: "REFUND_REVERT",
      }).session(session);
      const alreadyReverted = priorReverts.reduce((sum: number, r: any) => sum + Math.abs(r.points), 0);
      const toRevert = Math.max(0, earnLedger.points - alreadyReverted);
      if (toRevert > 0) {
        await CustomerPointService.revertRefundPoints({
          companyCode: scope.companyCode,
          branchId: scope.branchId,
          customerId: String(order.customerId),
          points: toRevert,
          sourceType: "retail_order",
          sourceId: String(order._id),
          sourceCode: order.orderCode,
          reason: `Thu hồi điểm do hủy đơn hàng ${order.orderCode}`,
          actor: { id: actorId(actor), name: actorName(actor) },
          session,
        });
      }
    }
  } catch (err) {
    console.error("[revertOrderPointsOnCancel] error:", err);
  }
}

type PaymentInput = { method: unknown; amount: unknown; tenderedAmount?: unknown; reference?: unknown };

export function requireRetailPaymentCustomer(customerId: unknown) {
  if (!String(customerId || "").trim()) {
    throw new Error("Vui lòng chọn khách hàng trước khi thanh toán.");
  }
}
export function buildRetailCustomerSnapshots(customer: any, billing: any | null = null) {
  return { customerId: customer.customerId, customerName: customer.name, customerPhone: customer.phone, customerSnapshot: { customerId: customer.customerId, customerCode: customer.customerCode, name: customer.name, phone: customer.phone }, ...(billing ? { billingProfileId: billing.profileId, billingSnapshot: { legalName: billing.legalName, taxId: billing.taxId, address: billing.address, invoiceEmail: billing.invoiceEmail, contactName: billing.contactName } } : {}) };
}
export function normalizePayments(input: PaymentInput[], remaining: number) {
  if (!Array.isArray(input)) throw new Error("Danh sách thanh toán không hợp lệ.");
  let total = 0;
  const payments = input.map((item) => {
    const method = String(item.method || "");
    if (!(RETAIL_PAYMENT_METHODS as readonly string[]).includes(method)) throw new Error("Phương thức thanh toán không hợp lệ.");
    const amount = Number(item.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Số tiền thanh toán không hợp lệ.");
    total += amount;
    if (method === "cash") {
      const tenderedAmount = item.tenderedAmount === undefined ? amount : Number(item.tenderedAmount);
      if (!Number.isSafeInteger(tenderedAmount) || tenderedAmount < amount) throw new Error("Tiền khách đưa không được thấp hơn tiền áp dụng.");
      return { method, amount, tenderedAmount, changeAmount: tenderedAmount - amount, reference: undefined };
    }
    if (item.tenderedAmount !== undefined) throw new Error("Chỉ thanh toán tiền mặt mới có tiền khách đưa.");
    return { method, amount, reference: String(item.reference || "").trim() || undefined, tenderedAmount: undefined, changeAmount: undefined };
  });
  if (total > remaining) throw new Error("Tổng tiền thanh toán vượt số tiền phải thu.");
  return { payments, total };
}

export function paymentStatusFor(paidAmount: number, grandTotal: number, refundedAmount: number): RetailPaymentStatus {
  if (grandTotal > 0 && refundedAmount >= grandTotal) return "refunded";
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount < grandTotal) return "partial";
  return "paid";
}

export function serializeRetailOrder(order: any, canSeeCost: boolean) {
  const value = typeof order?.toObject === "function" ? order.toObject() : { ...order };
  if (canSeeCost) return value;
  const { totalCost: _totalCost, ...safe } = value;
  return { ...safe, items: (value.items || []).map(({ unitCost: _unitCost, ...item }: any) => item) };
}

const actorId = (actor: any) => String(actor.id || actor.uid || "");
const actorName = (actor: any) => String(actor.displayName || actor.email || "");
function draftRequestFingerprint(operation: string, scope: RetailBranchScope, actor: any, input: any, orderId?: string) {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const fields = ["items", "customerId", "billingProfileId", "orderDiscount", "taxRate", "shippingFee", "dueDate", "couponCode", "collaboratorId", "salespersonId", "salespersonName", ...(orderId ? ["version"] : [])];
  return createHash("sha256").update(JSON.stringify(canonical({ operation, ...scope, actorId: actorId(actor), ...(orderId ? { orderId } : {}), input: Object.fromEntries(fields.map((field) => [field, input[field]])) }))).digest("hex");
}
const replayConflict = () => retailError("Khóa xác nhận không khớp yêu cầu hoặc thiếu chứng từ gốc. Vui lòng đối chiếu đơn hàng.", "ORDER_IDEMPOTENCY_CONFLICT");
async function confirmedResult(scope: RetailBranchScope, attempt: any, session?: mongoose.ClientSession) {
  if (!attempt.orderId || !attempt.invoiceId || !Types.ObjectId.isValid(attempt.orderId) || !Types.ObjectId.isValid(attempt.invoiceId)) throw replayConflict();
  const order = await RetailOrderModel.findOne({ _id: attempt.orderId, ...scope }).session(session || null).lean();
  const invoice = await RetailInvoiceModel.findOne({ _id: attempt.invoiceId, orderId: attempt.orderId, ...scope }).session(session || null).lean();
  if (!order || !invoice) throw replayConflict();
  return { order, invoice };
}
const monthlyScope = (businessDate: string) => businessDate.replace("-", "").slice(0, 6);
export function formatRetailDocumentCode(prefix: string, branchCode: string, scope: string, seq: number) {
  return `${prefix.trim().toUpperCase()}-${branchCode.trim().toUpperCase()}-${scope}-${String(seq).padStart(6, "0")}`;
}
export function retailPaymentCode(orderCode: string) {
  return orderCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
const duplicate = (error: any) => error?.code === 11000;

function retailError(message: string, code: string, status = 409) {
  return Object.assign(new Error(message), { code, status });
}

export function assertHeldDraftCapacity(activeDrafts: number) {
  if (activeDrafts >= 5) throw retailError("Mỗi thu ngân chỉ được giữ tối đa 5 đơn.", "HELD_DRAFT_LIMIT");
}

export function assertHeldDraftAccess(createdBy: string, actor: string, canManage: boolean) {
  if (createdBy !== actor && !canManage) throw retailError("Bạn không được sửa đơn treo của thu ngân khác.", "HELD_DRAFT_FORBIDDEN", 403);
}

export function isHeldDraftExpired(draftBusinessDate: string | undefined, currentBusinessDate: string) {
  return Boolean(draftBusinessDate && draftBusinessDate < currentBusinessDate);
}

async function expireHeldDrafts(scope: RetailBranchScope, currentBusinessDate: string) {
  await RetailOrderModel.updateMany(
    { ...scope, status: "draft", businessDate: { $lt: currentBusinessDate } },
    { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Đơn treo hết hạn", expiredBySystem: true }, $inc: { version: 1 } },
  );
}

export function snapshotRetailProductForPricing(product: any, item: any) {
  const text = (value: unknown) => String(value || "").trim();
  return {
    productId: String(product._id), sku: text(product.sku), productName: text(product.name), unit: text(product.unit),
    ...(text(product.category) ? { category: text(product.category) } : {}), ...(text(product.brand) ? { brand: text(product.brand) } : {}),
    quantity: Number(item.quantity), unitPrice: Number(product.price || 0), unitCost: Number(product.costPrice || 0),
    ...(product.trackingMode ? { trackingMode: product.trackingMode } : item.trackingMode ? { trackingMode: item.trackingMode } : {}),
    ...(product.variantId || item.variantId ? { variantId: String(product.variantId || item.variantId) } : {}),
    ...(Array.isArray(item.serialNumbers) ? { serialNumbers: item.serialNumbers } : {}), discount: toDiscountInput(item.discount ?? item.discountAmount),
    ...(Array.isArray(item.internalBarcodes) ? { internalBarcodes: item.internalBarcodes } : {}),
    note: text(item.note) || undefined,
  };
}

async function priceInput(scope: RetailBranchScope, input: any, session?: mongoose.ClientSession, persistedDraft = false) {
  const settings = await getResolvedRetailSettings(scope);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const ids = rawItems.map((item: any) => String(item.productId || ""));
  if (!ids.length || ids.some((id: string) => !Types.ObjectId.isValid(id))) throw new Error("Danh sách sản phẩm không hợp lệ.");
  const variants = await ProductVariantModel.find({ _id: { $in: ids }, companyCode: scope.companyCode, status: "active" }).session(session || null).lean();
  const byId = new Map(variants.map((variant: any) => [String(variant._id), variant]));
  const productIds = [...new Set(variants.map((variant: any) => String(variant.productId)))];
  const products = await ProductCatalogModel.find({ _id: { $in: productIds }, companyCode: scope.companyCode, status: "active" }).session(session || null).lean();
  const productById = new Map(products.map((product: any) => [String(product._id), product]));
  const prices = await ProductPriceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, variantId: { $in: ids }, status: "active" }).session(session || null).lean();
  const priceById = new Map(prices.map((price: any) => [String(price.variantId), price]));
  const defaultWarehouse = await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  const balances = await InventoryBalanceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(defaultWarehouse._id), variantId: { $in: ids } }).session(session || null).lean();
  const balanceById = new Map<string, any>();
  for (const balance of balances as any[]) {
    const key = String(balance.variantId); const current = balanceById.get(key) || { quantity: 0, reservedQuantity: 0 };
    current.quantity += Number(balance.quantity || 0); current.reservedQuantity += Number(balance.reservedQuantity || 0); balanceById.set(key, current);
  }
  if (byId.size !== new Set(ids).size) throw new Error("SKU không thuộc danh mục đang bán.");
  const items = rawItems.map((item: any) => { const variant: any = byId.get(String(item.productId)); const product: any = productById.get(String(variant.productId)); const price: any = priceById.get(String(variant._id)); const balance: any = balanceById.get(String(variant._id)); if (!product || !price) throw new Error("Sản phẩm chưa được khai báo giá bán."); const available = Number(balance?.quantity || 0) - Number(balance?.reservedQuantity || 0); if (available < Number(item.quantity)) throw new Error(`Tồn kho của ${product.name} không đủ.`); return { product: { _id: variant._id, sku: variant.sku, name: product.name, unit: variant.unitCode, category: product.categoryCode, brand: product.brandCode, price: price.sellingPrice, costPrice: price.costPrice, trackingMode: variant.trackingMode, variantId: variant._id }, item }; }).map(({ product, item }: any) => snapshotRetailProductForPricing(product, item));
  validateRetailSerialItems(items);
  const couponCode = typeof input.couponCode === "string" ? input.couponCode.trim() : "";
  let orderDiscount = toDiscountInput(input.orderDiscount) || { type: "amount" as const, value: 0 };
  let couponSnapshot: Awaited<ReturnType<typeof resolveCoupon>> | null = null;
  if (couponCode) {
    // Persisted drafts store the calculated coupon amount in orderDiscount.
    if ((!persistedDraft && orderDiscount.value !== 0) || items.some((item) => Number(item.discount?.value || 0) !== 0)) throw new Error("Mã ưu đãi không cộng dồn với giảm giá thủ công.");
    const base = calculateOrderTotals({ items, orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: settings.maxDiscountPercent });
    couponSnapshot = await resolveCoupon(scope, couponCode, base.subtotal, session, input.customerId);
    orderDiscount = { type: "amount", value: couponSnapshot.amount };
  }
  return { settings, pricing: { ...calculateOrderTotals({ items, orderDiscount, taxRate: input.taxRate === undefined ? settings.defaultTaxRate : Number(input.taxRate), shippingFee: Number(input.shippingFee || 0), maxDiscountPercent: settings.maxDiscountPercent }), couponCode: couponSnapshot?.code || "", couponSnapshot } };
}

function snapshotPayment(item: any, shift: any, actor: any) { return { ...item, paidAt: new Date(), receivedBy: actorId(actor), receivedByName: actorName(actor), shiftId: shift?._id ? String(shift._id) : undefined, businessDate: shift?.businessDate || businessDateInVietnam(new Date()) }; }

export function customerLookupFilter(scope: RetailBranchScope, customerId: string) {
  return { _id: customerId, companyCode: scope.companyCode };
}

async function resolveOrderCustomer(scope: RetailBranchScope, customerId: unknown, session?: any) {
  const id = String(customerId || "").trim();
  if (!id) return null;
  const customer = await getCustomerBrief({ companyCode: scope.companyCode }, id);
  if (!customer) throw new Error("Không tìm thấy khách hàng.");
  return { ...customer, _id: customer.customerId };
}

async function resolveOrderCustomerSnapshots(scope: RetailBranchScope, customerId: unknown, billingProfileId?: unknown) {
  const customer = await resolveOrderCustomer(scope, customerId);
  if (!customer) return null;
  const profileId = String(billingProfileId || "").trim();
  const billing = profileId ? await getBillingProfile({ companyCode: scope.companyCode }, customer.customerId, profileId) : null;
  if (profileId && !billing) throw new Error("Không tìm thấy hồ sơ xuất VAT đang hoạt động.");
  return buildRetailCustomerSnapshots(customer, billing);
}

export const RetailOrderService = {
  async quote(scope: RetailBranchScope, input: any) { return (await priceInput(scope, input)).pricing; },
  async list(scope: RetailBranchScope, query: any) {
    await expireHeldDrafts(scope, businessDateInVietnam(new Date()));
    const { filter, page, limit, skip } = buildOrderListQuery(scope, query);
    const [items, total] = await Promise.all([RetailOrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), RetailOrderModel.countDocuments(filter)]); return { items: await attachAfterSaleHistory(scope, items), total, page, limit };
  },
  async idempotency(scope: RetailBranchScope, key: string) {
    const attempt = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key: String(key || "").trim() }).lean();
    if (!attempt || attempt.branchId !== scope.branchId) return { status: "not_found" as const };
    if (attempt.operation !== "confirm-order" || !attempt.requestFingerprint) throw replayConflict();
    if (attempt.status !== "completed") return { status: "processing" as const };
    return { status: "completed" as const, ...await confirmedResult(scope, attempt) };
  },
  async detail(scope: RetailBranchScope, id: string, actor?: any, canManage = false) { if (!Types.ObjectId.isValid(id)) throw new Error("Mã đơn không hợp lệ."); const order: any = await RetailOrderModel.findOne({ _id: id, ...scope }).lean(); if (!order) throw new Error("Không tìm thấy đơn hàng."); if (order.status === "draft" && actor) assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage); return (await attachAfterSaleHistory(scope, [order]))[0]; },
  async createDraft(scope: RetailBranchScope, input: any, actor: any) {
    const currentBusinessDate = businessDateInVietnam(new Date());
    await expireHeldDrafts(scope, currentBusinessDate);
    const creator = actorId(actor);
    const key = String(input.idempotencyKey || "").trim();
    if (!key) throw retailError("Khóa tạo bản nháp là bắt buộc.", "DRAFT_KEY_REQUIRED", 400);
    const requestFingerprint = draftRequestFingerprint("create-draft", scope, actor, input);
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.operation !== "create-draft" || attempt.requestFingerprint !== requestFingerprint || attempt.status !== "completed") throw replayConflict();
      const order = await RetailOrderModel.findOne({ _id: attempt.orderId, ...scope, createdBy: creator, status: "draft", version: 0 }).session(session || null).lean();
      if (!order) throw retailError("Bản nháp gốc đã thay đổi hoặc không còn tồn tại. Vui lòng đối chiếu, không tạo đơn thay thế.", "DRAFT_REPLAY_CONFLICT");
      return order;
    };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = await mongoose.startSession();
      try {
        return await session.withTransaction(async () => {
          const existing = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
          if (existing) return replay(existing, session);
          await RetailIdempotencyModel.create([{ ...scope, key, operation: "create-draft", requestFingerprint, status: "processing" }], { session });
          const collaborator = await resolveCollaborator(scope.companyCode, input.collaboratorId);
          const used = await RetailOrderModel.find({ ...scope, status: "draft", createdBy: creator }).select("heldSlot").session(session).lean();
          assertHeldDraftCapacity(used.length);
          const occupied = new Set(used.map((item: any) => Number(item.heldSlot)));
          const slot = [1, 2, 3, 4, 5].find((slot) => !occupied.has(slot));
          if (!slot) throw retailError("Mỗi thu ngân chỉ được giữ tối đa 5 đơn.", "HELD_DRAFT_LIMIT");
          const { pricing } = await priceInput(scope, input, session);
          const customerSnapshot = await resolveOrderCustomerSnapshots(scope, input.customerId, input.billingProfileId);
          requireRetailPaymentCustomer(customerSnapshot?.customerId);
          const [order] = await RetailOrderModel.create([{ ...scope, collaboratorId: collaborator ? String(collaborator._id) : undefined, couponCode: pricing.couponCode, couponSnapshot: pricing.couponSnapshot, items: pricing.lines, subtotal: pricing.subtotal, orderDiscount: pricing.orderDiscount, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, shippingFee: pricing.shippingFee, grandTotal: pricing.grandTotal, totalCost: pricing.totalCost, payments: [], refunds: [], paidAmount: 0, refundedAmount: 0, dueAmount: pricing.grandTotal, paymentStatus: "unpaid", status: "draft", businessDate: currentBusinessDate, heldAt: new Date(), heldSlot: slot, salespersonId: String(input.salespersonId || creator), salespersonName: String(input.salespersonName || actorName(actor)), createdBy: creator, createdByName: actorName(actor), stockApplied: false, version: 0, ...(customerSnapshot || {}), dueDate: input.dueDate }], { session });
          await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed", orderId: String(order._id) } }, { session });
          return order;
        });
      } catch (error: any) {
        if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
          const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
          if (existing) return replay(existing);
        }
        if (!(error?.code === 11000 && error?.keyPattern?.heldSlot && error?.keyPattern?.createdBy && error?.keyPattern?.branchId && error?.keyPattern?.companyCode)) throw error;
      } finally { await session.endSession(); }
    }
    throw retailError("Mỗi thu ngân chỉ được giữ tối đa 5 đơn.", "HELD_DRAFT_LIMIT");
  },
  async updateDraft(scope: RetailBranchScope, id: string, input: any, actor: any, canManage = false) {
    const currentBusinessDate = businessDateInVietnam(new Date());
    await expireHeldDrafts(scope, currentBusinessDate);
    const expectedVersion = input.version, key = String(input.idempotencyKey || "").trim();
    if (!key || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw retailError("Khóa sửa nháp và phiên bản là bắt buộc.", "DRAFT_UPDATE_INVALID", 400);
    const requestFingerprint = draftRequestFingerprint("update-draft", scope, actor, input, id);
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "update-draft" || attempt.requestFingerprint !== requestFingerprint || attempt.status !== "completed") throw replayConflict();
      const order = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft", version: expectedVersion + 1 }).session(session || null).lean();
      if (!order) throw retailError("Bản nháp đã thay đổi sau lần lưu gốc. Vui lòng đối chiếu.", "DRAFT_REPLAY_CONFLICT");
      assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
      return order;
    };
    const prior = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (prior) return replay(prior);
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const prior = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
        if (prior) return replay(prior, session);
        await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, operation: "update-draft", requestFingerprint, status: "processing" }], { session });
        const existing: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft", version: expectedVersion }).session(session).lean();
        if (!existing) throw retailError("Đơn đã thay đổi hoặc không thể sửa.", "ORDER_VERSION_CONFLICT");
        assertHeldDraftAccess(String(existing.createdBy), actorId(actor), canManage);
        const collaborator = await resolveCollaborator(scope.companyCode, input.collaboratorId === undefined ? existing.collaboratorId : input.collaboratorId);
        const { pricing } = await priceInput(scope, input, session);
        const customerSnapshot = await resolveOrderCustomerSnapshots(scope, input.customerId, input.billingProfileId);
        const order = await RetailOrderModel.findOneAndUpdate({ _id: id, ...scope, status: "draft", version: expectedVersion }, { $set: { collaboratorId: collaborator ? String(collaborator._id) : null, couponCode: pricing.couponCode, couponSnapshot: pricing.couponSnapshot, items: pricing.lines, subtotal: pricing.subtotal, orderDiscount: pricing.orderDiscount, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, shippingFee: pricing.shippingFee, grandTotal: pricing.grandTotal, totalCost: pricing.totalCost, dueAmount: pricing.grandTotal, ...(customerSnapshot || { customerId: undefined, customerName: undefined, customerPhone: undefined, billingProfileId: undefined, customerSnapshot: undefined, billingSnapshot: undefined }), dueDate: input.dueDate }, $inc: { version: 1 } }, { returnDocument: "after", session });
        if (!order) throw retailError("Đơn đã được thay đổi ở màn hình khác.", "ORDER_VERSION_CONFLICT");
        await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed" } }, { session });
        return order;
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const prior = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (prior) return replay(prior);
      }
      throw error;
    } finally { await session.endSession(); }
  },
  async confirm(scope: RetailBranchScope, id: string, input: any, actor: any, shift: any = undefined, canManage = false) {
    const key = String(input.idempotencyKey || "").trim(); if (!key) throw new Error("Idempotency key là bắt buộc.");
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw retailError("Phiên bản đơn xác nhận là bắt buộc.", "ORDER_VERSION_REQUIRED", 400);
    const expectedGrandTotal = Number(input.expectedGrandTotal);
    if (!Number.isSafeInteger(expectedGrandTotal) || expectedGrandTotal < 0) throw new Error("Tổng tiền xác nhận không hợp lệ.");
    const requestPayments = normalizePayments(input.payments || [], expectedGrandTotal);
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ version: 1,
      companyCode: scope.companyCode, branchId: scope.branchId, orderId: id,
      operation: "confirm-order", actorId: actorId(actor), shiftId: String(shift?._id || ""),
      expectedVersion: input.expectedVersion, expectedGrandTotal, payments: requestPayments.payments,
    })).digest("hex");
    const replay = async (attempt: any, activeSession?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "confirm-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status !== "completed") throw retailError("Yêu cầu xác nhận đang được xử lý. Vui lòng thử lại sau.", "ORDER_IDEMPOTENCY_PROCESSING");
      const result = await confirmedResult(scope, attempt, activeSession);
      assertHeldDraftAccess(String(result.order.createdBy), actorId(actor), canManage);
      return result;
    };
    const keyFilter = { companyCode: scope.companyCode, key };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    const session = await mongoose.startSession(); let result: any;
    try { await session.withTransaction(async () => {
      const committed = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
      if (committed) { result = await replay(committed, session); return; }
      await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, requestFingerprint, operation: "confirm-order", status: "processing" }], { session });
      const draft: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft", version: input.expectedVersion }).session(session);
      if (!draft) throw retailError("Đơn đã thay đổi hoặc không thể xác nhận. Vui lòng tải lại và kiểm tra nội dung.", "ORDER_VERSION_CONFLICT");
      requireRetailPaymentCustomer(draft.customerId);
      assertHeldDraftAccess(String(draft.createdBy), actorId(actor), canManage);
      const { settings, pricing } = await priceInput(scope, draft.toObject(), session, true); if (Number(input.expectedGrandTotal) !== pricing.grandTotal) throw Object.assign(new Error("Tổng tiền đã thay đổi."), { code: "ORDER_TOTAL_MISMATCH", status: 409, details: { expected: Number(input.expectedGrandTotal), actual: pricing.grandTotal } });
      const normalized = normalizePayments(input.payments || [], pricing.grandTotal); const dueAmount = pricing.grandTotal - normalized.total;
      if (dueAmount > 0 && !draft.dueDate) throw new Error("Bán nợ cần khách hàng và hạn thanh toán.");
      const customerSnapshots = await resolveOrderCustomerSnapshots(scope, draft.customerId, draft.billingProfileId);
      const customer: any = customerSnapshots ? { name: customerSnapshots.customerName, phone: customerSnapshots.customerPhone } : null;
      const branch = await BranchModel.findOne({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).session(session).lean(); if (!branch) throw new Error("Chi nhánh bán hàng không hợp lệ.");
      const scopeKey = monthlyScope(shift?.businessDate || businessDateInVietnam(new Date())); const counter = await RetailOrderCounterModel.findOneAndUpdate({ ...scope, scope: scopeKey }, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true, session }); const orderCode = formatRetailDocumentCode(settings.orderPrefix, branch.code, scopeKey, counter!.seq);
      draft.paymentCode = retailPaymentCode(orderCode);
      if (pricing.couponSnapshot) await consumeCoupon(scope, pricing.couponSnapshot, session, draft.customerId);
      const stockSnapshot = await applyOrderStockOut(scope, String(draft._id), orderCode, pricing.lines, actorName(actor), settings.allowNegativeStock, session);
      pricing.lines = stockSnapshot.items;
      pricing.totalCost = stockSnapshot.totalCost;
      Object.assign(draft, { orderCode, shiftId: shift?._id ? String(shift._id) : undefined, businessDate: shift?.businessDate || businessDateInVietnam(new Date()), items: pricing.lines, ...pricing, ...(customerSnapshots || {}), customerName: customer?.name || draft.customerName, customerPhone: customer?.phone || draft.customerPhone, payments: normalized.payments.map((payment) => snapshotPayment(payment, shift, actor)), paidAmount: normalized.total, dueAmount, paymentStatus: paymentStatusFor(normalized.total, pricing.grandTotal, 0), status: dueAmount === 0 ? "completed" : "confirmed", stockApplied: true, confirmedAt: new Date(), completedAt: dueAmount === 0 ? new Date() : undefined, version: draft.version + 1 });
      await claimSerialsForOrder(scope, draft.items as any, String(draft._id), String(draft.customerId), actorId(actor), session, actorName(actor), { businessDate: draft.businessDate, orderCode }); await draft.save({ session });
      await enqueueOrderTierRefresh(scope, "confirm", draft, session);
      await awardOrderPoints(scope, draft, session);
      const invoice = await issueRetailInvoice(draft, settings.invoicePrefix, branch.code, scopeKey, actor, session);
      draft.commissionSnapshot = await snapshotRetail(draft, session);
      await draft.save({ session });
      if (draft.commissionSnapshot) await reconcileCommission("retail", String(draft._id), scope.companyCode, session);
      await publishRetailOrderEvent("confirmed", scope, draft, actor, { session });
      await RetailIdempotencyModel.updateOne({ companyCode: scope.companyCode, key }, { $set: { status: "completed", orderId: String(draft._id), invoiceId: String(invoice._id) } }, { session }); result = { order: draft, invoice };
    }); } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const prior = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (prior) return replay(prior);
      }
      throw error;
    } finally { await session.endSession(); }
    scheduleOrderTierRefreshAfterCommit(scope, "confirm", result.order);
    return result;
  },
  async collect(scope: RetailBranchScope, id: string, input: any, actor: any, shift?: any) {
    const key = String(input.idempotencyKey || "").trim();
    if (!key || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw retailError("Khóa thao tác và phiên bản đơn là bắt buộc.", "COLLECTION_INVALID", 400);
    let normalized: ReturnType<typeof normalizePayments>;
    try {
      normalized = normalizePayments(input.payments || [], Number.MAX_SAFE_INTEGER);
      if (!normalized.total) throw new Error("Số tiền thu phải lớn hơn 0.");
    } catch (error: any) { throw retailError(error.message, "COLLECTION_INVALID", 400); }
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ version: 1, operation: "collect-order",
      companyCode: scope.companyCode, branchId: scope.branchId, orderId: id, actorId: actorId(actor),
      shiftId: String(shift?._id || ""), expectedVersion: input.expectedVersion, payments: normalized.payments,
    })).digest("hex");
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "collect-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status !== "completed") throw retailError("Yêu cầu thu tiền đang được xử lý.", "ORDER_IDEMPOTENCY_PROCESSING");
      const order = await RetailOrderModel.findOne({ _id: id, ...scope }).session(session || null).lean();
      if (!order) throw replayConflict();
      return order;
    };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
        if (existing) return replay(existing, session);
        await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, operation: "collect-order", requestFingerprint, status: "processing" }], { session });
        const order: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "confirmed", version: input.expectedVersion }).session(session);
        if (!order) throw retailError("Đơn đã thay đổi hoặc không thể thu thêm. Vui lòng đối chiếu công nợ.", "ORDER_VERSION_CONFLICT");
        if (normalized.total > order.dueAmount) throw retailError("Số tiền thu vượt công nợ còn lại.", "COLLECTION_INVALID", 400);
        order.payments.push(...normalized.payments.map((payment) => snapshotPayment(payment, shift, actor)));
        order.paidAmount += normalized.total;
        order.dueAmount = order.grandTotal - order.paidAmount;
        order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount);
        if (order.dueAmount === 0) { order.status = "completed"; order.completedAt = new Date(); }
        order.version += 1;
        await order.save({ session });
        if (order.commissionSnapshot) await reconcileCommission("retail", String(order._id), scope.companyCode, session);
        await publishRetailOrderEvent("paid", scope, order, actor, { session, amount: normalized.total, transactionKey: key });
        await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed" } }, { session });
        return order;
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (existing) return replay(existing);
      }
      throw error;
    } finally { await session.endSession(); }
  },
  async cancel(scope: RetailBranchScope, id: string, input: any, actor: any, shift: any | undefined, canManage: boolean) {
    const reason = String(input.reason || "").trim();
    const key = String(input.idempotencyKey || "").trim();
    if (!reason || !key || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw retailError("Lý do, khóa thao tác và phiên bản đơn là bắt buộc.", "CANCELLATION_INVALID", 400);
    let refunds: ReturnType<typeof normalizePayments>;
    try { refunds = normalizePayments(input.refunds || [], Number.MAX_SAFE_INTEGER); }
    catch (error: any) { throw retailError(error.message, "CANCELLATION_INVALID", 400); }
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ version: 1, operation: "cancel-order",
      companyCode: scope.companyCode, branchId: scope.branchId, orderId: id, actorId: actorId(actor),
      shiftId: String(shift?._id || ""), expectedVersion: input.expectedVersion, reason, refunds: refunds.payments,
    })).digest("hex");
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "cancel-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status !== "completed") throw retailError("Yêu cầu hủy đang được xử lý.", "ORDER_IDEMPOTENCY_PROCESSING");
      if (attempt.cancelledFromStatus === "completed" && !canManage) throw retailError("Chỉ quản lý được hủy đơn hoàn tất.", "CANCELLATION_FORBIDDEN", 403);
      const order = attempt.cancelledFromStatus === "draft" ? attempt.cancelledDraft : await RetailOrderModel.findOne({ _id: id, ...scope, status: "cancelled" }).session(session || null).lean();
      if (!order || String(order._id) !== id || order.companyCode !== scope.companyCode || order.branchId !== scope.branchId || order.status !== "cancelled" || !["draft", "confirmed", "completed"].includes(attempt.cancelledFromStatus)) throw replayConflict();
      if (attempt.cancelledFromStatus === "draft") assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
      return order;
    };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
        if (existing) { result = await replay(existing, session); return; }
        await RetailIdempotencyModel.create([{ ...scope, key, operation: "cancel-order", orderId: id, requestFingerprint, status: "processing" }], { session });
        const order: any = await RetailOrderModel.findOne({ _id: id, ...scope, version: input.expectedVersion, status: { $in: ["draft", "confirmed", "completed"] } }).session(session);
        if (!order) throw retailError("Đơn đã thay đổi hoặc không thể hủy. Vui lòng đối chiếu đơn gốc.", "ORDER_VERSION_CONFLICT");
        const cancelledFromStatus = order.status;
        if (order.status === "draft") assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
        if (order.status === "completed" && !canManage) throw Object.assign(new Error("Chỉ quản lý được hủy đơn hoàn tất."), { status: 403 });
        if (await RetailAfterSaleModel.exists({ ...scope, orderId: String(order._id) }).session(session)) throw retailError("Đơn đã trả hàng hoặc thu mua lại. Vui lòng xử lý phần hàng còn lại bằng phiếu trả hàng.", "ORDER_HAS_AFTER_SALES");
        const remainingRefund = order.paidAmount - order.refundedAmount;
        if (refunds.total !== remainingRefund) throw retailError("Phải ghi nhận đúng số tiền hoàn còn lại khi hủy đơn.", "CANCELLATION_INVALID", 400);
        if (order.status === "draft") {
          if (order.stockApplied || order.paidAmount || order.refundedAmount) throw replayConflict();
          result = { ...order.toObject(), status: "cancelled", cancelReason: reason, cancelledAt: new Date(), version: order.version + 1 };
          await RetailOrderModel.deleteOne({ _id: id, ...scope, status: "draft", version: input.expectedVersion }, { session });
          await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed", cancelledFromStatus, cancelledDraft: result } }, { session });
          return;
        }
        if (order.stockApplied && !order.stockRevertedAt) { const receipt = await revertOrderStock(scope, String(order._id), order.orderCode, order.items, actorName(actor), session, { order, actorId: actorId(actor), reason }); order.restockReceiptId = String(receipt._id); order.restockReceiptCode = receipt.receiptCode; await releaseSerialsForOrder(scope, String(order._id), actorId(actor), actorName(actor), session, { id: String(receipt._id), warehouseId: receipt.warehouseId }); order.stockRevertedAt = new Date(); }
        if (order.couponSnapshot && order.status !== "draft") await releaseCoupon(scope, order.couponSnapshot.id, session);
        await enqueueOrderTierRefresh(scope, "cancel", order, session);
        await revertOrderPointsOnCancel(scope, order, actor, session);
        order.refunds.push(...refunds.payments.map((item: any) => ({ method: item.method, amount: item.amount, reference: item.reference, refundedAt: new Date(), refundedBy: actorId(actor), refundedByName: actorName(actor), shiftId: shift?._id ? String(shift._id) : undefined, businessDate: shift?.businessDate || businessDateInVietnam(new Date()), reason })));
        order.refundedAmount += refunds.total; order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount); order.status = "cancelled"; order.cancelReason = reason; order.cancelledAt = new Date(); order.version += 1;
        await order.save({ session });
        if (order.commissionSnapshot) await reconcileCommission("retail", String(order._id), scope.companyCode, session);
        await publishRetailOrderEvent("cancelled", scope, order, actor, { session });
        await RetailInvoiceModel.updateOne({ orderId: String(order._id), ...scope, status: "issued" }, { $set: { status: "void", voidedAt: new Date(), voidReason: reason } }, { session });
        await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed", cancelledFromStatus } }, { session });
        result = order;
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (existing) return replay(existing);
      }
      throw error;
    } finally { await session.endSession(); }
    if (result.stockApplied) scheduleOrderTierRefreshAfterCommit(scope, "cancel", result);
    return result;
  },
  async deleteCancelled(scope: RetailBranchScope, id: string) {
    if (await RetailOrderModel.exists({ _id: id, ...scope, stockApplied: true })) throw retailError("Đơn đã phát sinh xuất/nhập kho phải được giữ lại để tra cứu.", "ORDER_HAS_STOCK_HISTORY");
    const result = await RetailOrderModel.deleteOne({ _id: id, ...scope, status: "cancelled" });
    if (result.deletedCount !== 1) throw new Error("Chỉ được xóa đơn đã hủy.");
    return { id };
  },
};
