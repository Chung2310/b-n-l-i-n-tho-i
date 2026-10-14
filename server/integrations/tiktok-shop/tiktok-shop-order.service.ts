/* eslint-disable @typescript-eslint/no-explicit-any -- TikTok order fields vary across API markets. */
import mongoose from "mongoose";
import { BranchModel } from "../../model/branch.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductPriceModel } from "../../model/product-price.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { SerialUnitModel } from "../../modules/inventory/serials/serial-unit.model";
import { ensureDefaultWarehouse } from "../../modules/inventory/warehouse/warehouse.service";
import { RetailOrderCounterModel } from "../../modules/retail/models/retail-order-counter.model";
import { RetailOrderModel } from "../../modules/retail/models/retail-order.model";
import { applyOrderStockOut } from "../../modules/retail/services/retail-stock.service";
import { claimSerialsForOrder } from "../../modules/retail/services/retail-serial-order.service";
import { issueRetailInvoice } from "../../modules/retail/services/retail-invoice.service";
import { publishRetailOrderEvent } from "../../modules/retail/services/retail-order-events";
import { getResolvedRetailSettings } from "../../modules/retail/services/retail-settings.service";
import { businessDateInVietnam } from "../../modules/retail/services/cashier-shift.service";
import { TikTokShopConnectionModel } from "./tiktok-shop-connection.model";
import { TikTokShopProductModel } from "./tiktok-shop-product.model";
import { callTikTokShopApi } from "./tiktok-shop.client";
import { validTikTokShopAccessToken } from "./tiktok-shop.service";

const actor = { id: "tiktok-shop", displayName: "TikTok Shop" };
const normalizedSku = (value: unknown) => String(value || "").trim().toUpperCase();
const stringValue = (...values: unknown[]) => values.find((value) => typeof value === "string" && value.trim())?.toString().trim() || "";

function money(value: any): number | undefined {
  const raw = value && typeof value === "object" ? (value.amount ?? value.value ?? value.total_amount) : value;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const number = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(number) || number < 0) return undefined;
  const rounded = Math.round(number);
  return Number.isSafeInteger(rounded) ? rounded : undefined;
}

function orderItems(detail: any, cachedProducts: any[], variants: any[], catalog: any[], prices: any[]) {
  const remoteLines = Array.isArray(detail?.line_items) ? detail.line_items : Array.isArray(detail?.sku_order_list) ? detail.sku_order_list : [];
  if (!remoteLines.length) throw new Error("TikTok order does not contain line items.");
  const cachedBySkuId = new Map<string, any>();
  const cachedBySellerSku = new Map<string, any>();
  for (const product of cachedProducts) for (const sku of product.skus || []) {
    if (sku.skuId) cachedBySkuId.set(String(sku.skuId), sku);
    if (sku.sellerSku) cachedBySellerSku.set(normalizedSku(sku.sellerSku), sku);
  }
  const variantById = new Map(variants.map((variant: any) => [String(variant._id), variant]));
  const catalogById = new Map(catalog.map((product: any) => [String(product._id), product]));
  const priceById = new Map(prices.map((price: any) => [String(price.variantId), price]));

  return remoteLines.map((line: any) => {
    const quantity = Number(line.quantity ?? line.sku_quantity ?? 0);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("TikTok order has an invalid item quantity.");
    const skuId = stringValue(line.sku_id, line.skuId, line.sku?.id);
    const sellerSku = normalizedSku(stringValue(line.seller_sku, line.sellerSku, line.sku?.seller_sku));
    const channelSku = (skuId && cachedBySkuId.get(skuId)) || (sellerSku && cachedBySellerSku.get(sellerSku));
    const variantId = String(channelSku?.localVariantId || "");
    const variant: any = variantById.get(variantId);
    if (!channelSku || !variant) throw new Error(`TikTok SKU ${sellerSku || skuId || "unknown"} is not linked to an active local SKU.`);
    const product: any = catalogById.get(String(variant.productId));
    const price: any = priceById.get(variantId);
    if (!product || !price) throw new Error(`TikTok SKU ${variant.sku} has no active local product price for the mapped branch.`);

    const lineTotal = money(line.sku_subtotal_after_discount ?? line.line_total ?? line.subtotal)
      ?? ((money(line.sale_price ?? line.price) ?? money(channelSku.priceAmount) ?? Number(price.sellingPrice)) * quantity);
    if (!Number.isSafeInteger(lineTotal) || lineTotal < 0) throw new Error(`TikTok SKU ${variant.sku} has an invalid order amount.`);
    let unitPrice = money(line.sale_price ?? line.price) ?? money(channelSku.priceAmount) ?? Number(price.sellingPrice);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice * quantity < lineTotal) unitPrice = Math.ceil(lineTotal / quantity);
    const discountAmount = unitPrice * quantity - lineTotal;
    return {
      productId: String(variant._id), sku: String(variant.sku), productName: stringValue(line.product_name, line.productName, product.name, variant.displayName),
      unit: String(variant.unitCode || "cái"), category: String(product.categoryCode || ""), brand: String(product.brandCode || ""),
      quantity, unitPrice, unitCost: Number(price.costPrice || 0), trackingMode: variant.trackingMode,
      variantId: String(variant._id), discountAmount, lineTotal,
    };
  });
}

async function assignTrackedUnits(scope: { companyCode: string; branchId: string }, items: any[], session: mongoose.ClientSession) {
  const warehouse = await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  const variantIds = [...new Set(items.filter((item) => ["serial", "unit_barcode"].includes(item.trackingMode)).map((item) => String(item.variantId)))];
  const variants: any[] = variantIds.length ? await ProductVariantModel.find({ _id: { $in: variantIds }, companyCode: scope.companyCode }).select("_id productId").session(session).lean() : [];
  const productByVariant = new Map(variants.map((variant) => [String(variant._id), String(variant.productId)]));
  for (const item of items) {
    if (item.trackingMode !== "serial" && item.trackingMode !== "unit_barcode") continue;
    const units: any[] = await SerialUnitModel.find({
      companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(warehouse._id),
      productId: productByVariant.get(String(item.variantId)), variantId: item.variantId, status: "in_stock",
    }).sort({ createdAt: 1, _id: 1 }).limit(item.quantity).select("serialNumber internalBarcode").session(session).lean();
    if (units.length !== item.quantity) throw Object.assign(new Error(`Không đủ IMEI/mã vạch khả dụng cho SKU ${item.sku}.`), { statusCode: 409 });
    if (item.trackingMode === "serial") {
      item.serialNumbers = units.map((unit) => String(unit.serialNumber));
      item.internalBarcodes = [...new Set(units.map((unit) => String(unit.internalBarcode || "")).filter(Boolean))];
    } else {
      item.internalBarcodes = units.map((unit) => String(unit.internalBarcode));
    }
  }
}

export async function syncTikTokShopOrderStatusChange(event: any) {
  const payload = event.payload || {};
  const status = String(payload.orderStatus || "").toUpperCase();
  if (status !== "AWAITING_SHIPMENT") return { ignored: true, reason: "order-not-ready-for-invoicing" };

  const connection: any = await TikTokShopConnectionModel.findOne({ openId: String(payload.sellerOpenId) }).select("+accessTokenEncrypted +refreshTokenEncrypted");
  const shop = connection?.shops?.find((item: any) => String(item.cipher) === String(payload.shopCipher) && (!payload.shopId || String(item.id) === String(payload.shopId)));
  if (!connection || !shop) throw new Error("TikTok seller or shop connection could not be resolved.");
  const branchId = String(shop.retailBranchId || "").trim();
  if (!branchId) throw new Error(`TikTok shop ${shop.name || shop.id} has no retail branch configured.`);
  const scope = { companyCode: String(connection.companyCode), branchId };
  const existing = await RetailOrderModel.findOne({ ...scope, salesChannel: "tiktok-shop", externalShopCipher: shop.cipher, externalOrderId: String(payload.orderId) }).lean();
  if (existing) return { ignored: true, reason: "already-imported", orderId: String(existing._id) };

  const accessToken = await validTikTokShopAccessToken(connection);
  const detailData: any = await callTikTokShopApi({
    path: "/order/202309/orders", accessToken,
    query: { shop_cipher: shop.cipher, ids: String(payload.orderId) },
  });
  const detail = Array.isArray(detailData?.orders) ? detailData.orders.find((row: any) => String(row.order_id) === String(payload.orderId))
    : detailData?.order || detailData;
  if (!detail) throw new Error(`TikTok order ${payload.orderId} was not found in Get Order Detail.`);
  const detailStatus = String(detail.order_status || detail.status || status).toUpperCase();
  if (detailStatus !== "AWAITING_SHIPMENT") return { ignored: true, reason: "order-status-changed", status: detailStatus };

  const lines = Array.isArray(detail.line_items) ? detail.line_items : Array.isArray(detail.sku_order_list) ? detail.sku_order_list : [];
  const productIds = [...new Set(lines.map((line: any) => stringValue(line.product_id, line.productId)).filter(Boolean))];
  const skuIds = [...new Set(lines.map((line: any) => stringValue(line.sku_id, line.skuId)).filter(Boolean))];
  const sellerSkus = [...new Set(lines.map((line: any) => normalizedSku(stringValue(line.seller_sku, line.sellerSku))).filter(Boolean))];
  const cachedProducts = await TikTokShopProductModel.find({
    companyCode: scope.companyCode, connectionId: String(connection._id), shopCipher: shop.cipher,
    $or: [
      ...(productIds.length ? [{ tiktokProductId: { $in: productIds } }] : []),
      ...(skuIds.length ? [{ "skus.skuId": { $in: skuIds } }] : []),
      ...(sellerSkus.length ? [{ "skus.sellerSku": { $in: sellerSkus } }] : []),
    ],
  }).lean();
  const linkedVariantIds = [...new Set(cachedProducts.flatMap((product: any) => (product.skus || []).map((sku: any) => String(sku.localVariantId || "")).filter(Boolean)))];
  const variants: any[] = await ProductVariantModel.find({ _id: { $in: linkedVariantIds }, companyCode: scope.companyCode, status: "active" }).lean();
  const catalogIds = [...new Set(variants.map((variant) => String(variant.productId)))];
  const [catalog, prices] = await Promise.all([
    ProductCatalogModel.find({ _id: { $in: catalogIds }, companyCode: scope.companyCode, status: "active" }).lean(),
    ProductPriceModel.find({ companyCode: scope.companyCode, branchId, variantId: { $in: linkedVariantIds }, status: "active" }).lean(),
  ]);
  const items = orderItems(detail, cachedProducts, variants, catalog, prices);
  const subtotal = items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(subtotal)) throw new Error("TikTok order subtotal exceeds the supported VND amount range.");
  const payment = detail.payment_info || detail.payment || {};
  const shippingFee = money(payment.shipping_fee ?? payment.shipping_fee_after_discount ?? detail.shipping_fee) ?? 0;
  const platformTax = money(payment.tax ?? payment.tax_amount ?? detail.tax_amount) ?? 0;
  const remoteTotal = money(payment.total_amount ?? payment.total_paid ?? detail.total_amount ?? detail.order_amount);
  const grandTotal = remoteTotal ?? subtotal + shippingFee + platformTax;
  const taxAmount = platformTax;
  const orderDiscount = subtotal + shippingFee + taxAmount - grandTotal;
  if (![grandTotal, orderDiscount, taxAmount, shippingFee].every(Number.isSafeInteger) || grandTotal <= 0 || orderDiscount < 0) {
    throw new Error("TikTok order totals do not reconcile with item, shipping, and tax amounts.");
  }
  const taxRate = subtotal > 0 ? Math.min(100, Math.max(0, taxAmount / subtotal * 100)) : 0;
  const paymentMethod = String(payment.payment_method || detail.payment_method || "").toUpperCase();
  const remotePaymentStatus = String(payment.payment_status || detail.payment_status || "").toUpperCase();
  const isCashOnDelivery = /(^|_)COD($|_)|CASH.*DELIVERY|DELIVERY.*CASH/.test(paymentMethod);
  const isPaid = !isCashOnDelivery && !["UNPAID", "PENDING", "NOT_PAID"].includes(remotePaymentStatus);
  const paidAmount = isPaid ? grandTotal : 0;
  const dueAmount = grandTotal - paidAmount;
  const eventDate = new Date((Number(payload.eventTimestamp) || Math.floor(Date.now() / 1000)) * 1000);
  const createdAt = Number(detail.create_time || detail.createTime) > 0 ? new Date(Number(detail.create_time || detail.createTime) * 1000) : eventDate;
  const businessDate = businessDateInVietnam(createdAt);
  const scopeKey = businessDate.replace("-", "").slice(0, 6);
  const settings = await getResolvedRetailSettings(scope);
  const branch: any = await BranchModel.findOne({ _id: branchId, companyCode: scope.companyCode, isActive: true }).lean();
  if (!branch) throw new Error("Mapped retail branch is unavailable.");

  const session = await mongoose.startSession();
  let createdOrder: any;
  let createdInvoice: any;
  try {
    await session.withTransaction(async () => {
      const current = await RetailOrderModel.findOne({ ...scope, salesChannel: "tiktok-shop", externalShopCipher: shop.cipher, externalOrderId: String(payload.orderId) }).session(session).lean();
      if (current) { createdOrder = current; return; }
      const orderCounter = await RetailOrderCounterModel.findOneAndUpdate({ ...scope, scope: scopeKey }, { $inc: { seq: 1 } }, { returnDocument: "after", upsert: true, session });
      const orderCode = `${String(settings.orderPrefix || "DH").toUpperCase()}-${String(branch.code).toUpperCase()}-${scopeKey}-${String(orderCounter!.seq).padStart(6, "0")}`;
      await assignTrackedUnits(scope, items, session);
      const orderId = String(new mongoose.Types.ObjectId());
      const stock = await applyOrderStockOut(scope, orderId, orderCode, items, actor.displayName, settings.allowNegativeStock, session);
      const now = new Date();
      const order = new RetailOrderModel({
        _id: orderId,
        ...scope, orderCode, salesChannel: "tiktok-shop", externalOrderId: String(payload.orderId), externalShopId: String(shop.id || ""), externalShopCipher: String(shop.cipher), externalOrderStatus: detailStatus,
        customerName: String(detail.buyer_username || detail.recipient_address?.name || "Khách TikTok Shop"),
        customerPhone: String(detail.recipient_address?.phone_number || ""),
        items: stock.items, subtotal, orderDiscount, taxRate, taxAmount, shippingFee, grandTotal, totalCost: stock.totalCost,
        payments: isPaid ? [{ method: "transfer", amount: grandTotal, reference: `TikTok:${String(payload.orderId)}`, paidAt: eventDate, recordedAt: now, receivedBy: actor.id, receivedByName: actor.displayName, settlementStatus: "unassigned", businessDate }] : [],
        refunds: [], paidAmount, refundedAmount: 0, dueAmount, paymentStatus: isPaid ? "paid" : "unpaid", status: isPaid ? "completed" : "confirmed", businessDate,
        confirmedAt: eventDate, completedAt: isPaid ? eventDate : undefined, salespersonId: actor.id, salespersonName: actor.displayName, createdBy: actor.id, createdByName: actor.displayName,
        stockApplied: true, version: 1, note: `Đơn TikTok Shop: ${String(payload.orderId)}`,
      });
      await claimSerialsForOrder(scope, order.items as any, String(order._id), "", actor.id, session, actor.displayName, { businessDate, orderCode });
      await order.save({ session });
      createdInvoice = await issueRetailInvoice(order as any, settings.invoicePrefix, branch.code, scopeKey, actor, session);
      await publishRetailOrderEvent("confirmed", scope, order, actor, { session });
      createdOrder = order;
    });
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.externalOrderId) return { ignored: true, reason: "already-imported" };
    throw error;
  } finally {
    await session.endSession();
  }
  if (!createdInvoice) return { ignored: true, reason: "already-imported", orderId: String(createdOrder?._id || "") };
  return { imported: true, orderId: String(createdOrder?._id || ""), orderCode: createdOrder?.orderCode, invoiceId: String(createdInvoice?._id || "") };
}
