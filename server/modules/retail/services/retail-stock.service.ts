import { createRetailRestockReceipt } from "./retail-restock-receipt.service";
import type { ClientSession } from "mongoose";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import type { RetailBranchScope } from "../contracts";
import type { RetailOrderItem } from "../interfaces/retail-order.interface";
import { ProductVariantModel } from "../../../model/product-variant.model";

export async function applyOrderStockOut(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, allowNegativeStock: boolean, session: ClientSession) {
  const variantIds = items.map((item) => String(item.productId));
  const variants = await ProductVariantModel.find({ companyCode: scope.companyCode, _id: { $in: variantIds } }).session(session).lean();
  const variantMap = new Map(variants.map((v: any) => [String(v._id), v]));

  const mappedItems = items.map((item) => {
    const variant: any = variantMap.get(String(item.productId));
    return {
      ...((item as any).toObject?.() || item),
      productId: variant ? String(variant.productId) : item.productId,
      ...(variant ? { variantId: String(variant._id) } : { legacyProductId: item.productId }),
    };
  });

  await writeStockMovement({
    ...scope,
    direction: "out",
    purpose: "sale",
    sourceType: "retail-order",
    sourceId: orderId,
    sourceCode: orderCode,
    idempotencyKey: `order:${orderId}:out`,
    operatorName,
    items: mappedItems,
    allowNegativeStock,
    reason: `Đơn bán lẻ ${orderCode}`,
    session,
  });
}

export async function revertOrderStock(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, session: ClientSession, context?: { order: any; actorId: string; reason: string }) {
  const variantIds = items.map((item) => String(item.productId));
  const variants = await ProductVariantModel.find({ companyCode: scope.companyCode, _id: { $in: variantIds } }).session(session).lean();
  const variantMap = new Map(variants.map((v: any) => [String(v._id), v]));

  const mappedItems = items.map((item) => {
    const variant: any = variantMap.get(String(item.productId));
    return {
      ...((item as any).toObject?.() || item),
      productId: variant ? String(variant.productId) : item.productId,
      ...(variant ? { variantId: String(variant._id) } : { legacyProductId: item.productId }),
    };
  });

  return createRetailRestockReceipt(scope, {
    kind: "sales_cancel", sourceId: orderId, sourceCode: orderCode,
    order: context?.order || { _id: orderId, orderCode }, items: mappedItems,
    actorId: context?.actorId || operatorName, actorName: operatorName,
    reason: context?.reason || `Hủy đơn bán lẻ ${orderCode}`, idempotencyKey: `order:${orderId}:revert`,
  }, session);
}
