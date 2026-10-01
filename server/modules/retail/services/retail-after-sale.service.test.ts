import { RetailAfterSaleRequestModel } from "../models/retail-after-sale-request.model";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { RetailAfterSaleService } from "./retail-after-sale.service";
import { attachAfterSaleHistory } from "./retail-after-sale-history";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { StockLogModel } from "../../../model/stock-log.model";
import { revertOrderStock } from "./retail-stock.service";
import { backfillRetailRestockReceipts } from "./retail-restock-backfill.service";

const scope = { companyCode: "AFTER_SALE_TEST", branchId: new Types.ObjectId().toString() };
const actor = { id: "cashier", displayName: "Thu ngân" };
const models: mongoose.Model<any>[] = [RetailAfterSaleRequestModel, RetailAfterSaleModel, RetailOrderModel, GoodsReceiptModel, ProductVariantModel, InventoryBalanceModel, InventoryLedgerEntryModel, WarehouseModel, SerialUnitModel, SerialEventModel, StockLogModel];
let repl: MongoMemoryReplSet;
let order: any;
let variantId: string;
let warehouseId: string;

beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  for (const model of models) await model.init();
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await repl?.stop(); });
beforeEach(async () => {
  for (const model of models) await model.deleteMany({});
  const productId = new Types.ObjectId();
  const variantObjectId = new Types.ObjectId();
  variantId = String(variantObjectId);
  await ProductVariantModel.collection.insertOne({ _id: variantObjectId, companyCode: scope.companyCode, productId: String(productId), sku: "PHONE", status: "active" } as any);
  const warehouse = await WarehouseModel.create({ ...scope, code: "MAIN", name: "Kho bán hàng", isDefault: true, isActive: true, kind: "selling" });
  warehouseId = String(warehouse._id);
  await InventoryBalanceModel.create({ ...scope, warehouseId, productId: String(productId), variantId, sku: "PHONE", quantity: 0, averageCost: 60 });
  order = await RetailOrderModel.create({ ...scope, orderCode: "DH-TEST", customerId: "customer", customerName: "An", status: "completed", paymentStatus: "paid", stockApplied: true,
    items: [{ productId: variantId, sku: "PHONE", productName: "Điện thoại", unit: "máy", quantity: 2, unitPrice: 100, unitCost: 60, discountAmount: 0, lineTotal: 200, trackingMode: "serial", serialNumbers: ["SN1", "SN2"] }],
    subtotal: 200, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 200, totalCost: 120, paidAmount: 200, dueAmount: 0, salespersonId: actor.id, salespersonName: actor.displayName, createdBy: actor.id, createdByName: actor.displayName,
  });
  await InventoryLedgerEntryModel.create({ ...scope, warehouseId, productId: String(productId), variantId, sku: "PHONE", productName: "Điện thoại", direction: "out", purpose: "sale", quantity: 2, quantityDelta: -2, unitCost: 60, unitPrice: 100, sourceType: "retail-order", sourceId: String(order._id), sourceLine: 0, idempotencyKey: `order:${order._id}:out`, operatorName: actor.displayName });
  await SerialUnitModel.create(["SN1", "SN2"].map((serial) => ({ ...scope, warehouseId, productId: String(productId), variantId, sku: "PHONE", productName: "Điện thoại", internalBarcode: `BC-${serial}`, normalizedInternalBarcode: `BC-${serial}`, serialNumber: serial, normalizedSerialNumber: serial, status: "sold" as const, soldOrderId: String(order._id), createdBy: actor.id, updatedBy: actor.id })));
  await SerialUnitModel.updateMany({}, { $set: { soldBranchId: scope.branchId, currentDocumentType: "retail-order", currentDocumentId: String(order._id) } });
  const units = await SerialUnitModel.find().lean();
  await SerialEventModel.create(units.map((unit) => ({ ...scope, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "sold", fromStatus: "in_stock", toStatus: "sold", documentType: "retail-order", documentId: String(order._id), actorId: actor.id, actorName: actor.displayName })));
});

function input(type = "return", serial = "SN1", key = "request-1") {
  return { type, orderId: String(order._id), items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: [serial], unitAmount: 40, condition: "good" }], reason: "Khách trả máy", paymentMethod: "cash", idempotencyKey: key };
}

describe("after-sale receipts and stock", () => {
  it("posts one receipt and stock movement, persists status and replays without duplicating stock", async () => {
    const doc: any = await RetailAfterSaleService.create(scope, input(), actor);
    const receipt = await GoodsReceiptModel.findById(doc.receiptId).lean();
    expect(receipt).toMatchObject({ status: "confirmed", receiptKind: "sales_return", orderId: String(order._id), subtotal: 60, customerName: "An" });
    expect(receipt?.items[0]).toMatchObject({ variantId, quantity: 1, serialNumbers: ["SN1"], unitDetails: [{ internalBarcode: "BC-SN1", serialNumber: "SN1" }] });
    expect(await InventoryLedgerEntryModel.findOne({ direction: "in" }).lean()).toMatchObject({ sourceType: "goods-receipt", sourceId: doc.receiptId, quantityDelta: 1 });
    expect(await SerialUnitModel.findOne({ serialNumber: "SN1" }).lean()).toMatchObject({ status: "in_stock", currentDocumentId: doc.receiptId });
    expect(await RetailOrderModel.findById(order._id).lean()).toMatchObject({ afterSaleStatus: "partially_returned", refundedAmount: 100 });
    const replay: any = await RetailAfterSaleService.create(scope, input(), actor);
    expect(String(replay._id)).toBe(String(doc._id));
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(1);
  });

  it("combines partial returns and buybacks with correct cost and full status", async () => {
    await RetailAfterSaleService.create(scope, input(), actor);
    const doc: any = await RetailAfterSaleService.create(scope, input("buyback", "SN2", "request-2"), actor);
    expect(await GoodsReceiptModel.findById(doc.receiptId).lean()).toMatchObject({ receiptKind: "buyback", subtotal: 40 });
    const saved = await RetailOrderModel.findById(order._id).lean();
    expect(saved).toMatchObject({ afterSaleStatus: "mixed_full", refundedAmount: 100 });
    const [detailed] = await attachAfterSaleHistory(scope, [saved]);
    expect(detailed.afterSaleSummary).toMatchObject({ status: "mixed_full", returnedQuantity: 1, boughtBackQuantity: 1 });
    expect(detailed.afterSales).toHaveLength(2);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(2);
    await expect(RetailAfterSaleService.create(scope, input("return", "SN2", "request-3"), actor)).rejects.toThrow(/hết số lượng/);
  });

  it("rolls back the receipt, money, stock and history if a serial cannot be restored", async () => {
    await SerialUnitModel.updateOne({ serialNumber: "SN1" }, { $set: { status: "in_stock" } });
    await expect(RetailAfterSaleService.create(scope, input(), actor)).rejects.toMatchObject({ code: "AFTER_SALE_SERIAL_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(0);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(0);
    expect((await RetailOrderModel.findById(order._id).lean())?.refundedAmount).toBe(0);
  });

  it("rejects duplicate order lines before posting anything", async () => {
    const request = input();
    request.items.push({ ...request.items[0], serialNumbers: ["SN2"] });
    await expect(RetailAfterSaleService.create(scope, request, actor)).rejects.toThrow(/trùng/);
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
  });

  it("handles concurrent requests for the same serial only once", async () => {
    const results = await Promise.allSettled([RetailAfterSaleService.create(scope, input(), actor), RetailAfterSaleService.create(scope, input("buyback", "SN1", "other-key"), actor)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(1);
  });

  it("creates a linked receipt when cancelling an order with stock", async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const receipt = await revertOrderStock(scope, String(order._id), order.orderCode, order.items, actor.displayName, session, { order, actorId: actor.id, reason: "Hủy bán" });
        expect(receipt.receiptKind).toBe("sales_cancel");
        expect(receipt.orderCode).toBe(order.orderCode);
      });
    } finally { await session.endSession(); }
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(2);
  });

  it("backfills an old document from its ledger without adding stock again", async () => {
    const doc: any = await RetailAfterSaleService.create(scope, input(), actor);
    await GoodsReceiptModel.deleteMany({});
    await RetailAfterSaleModel.updateOne({ _id: doc._id }, { $unset: { receiptId: 1, receiptCode: 1 } });
    await InventoryLedgerEntryModel.updateMany({ direction: "in" }, { $set: { sourceType: "retail-after-sale", sourceId: String(doc._id), sourceCode: doc.code } });
    expect(await backfillRetailRestockReceipts(scope)).toMatchObject([{ status: "ready" }]);
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect(await backfillRetailRestockReceipts(scope, true)).toMatchObject([{ status: "created" }]);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(1);
    expect(await backfillRetailRestockReceipts(scope, true)).toEqual([]);
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
  });

  it("does not backfill a historical document with missing stock entries", async () => {
    const doc: any = await RetailAfterSaleService.create(scope, input(), actor);
    await GoodsReceiptModel.deleteMany({});
    await RetailAfterSaleModel.updateOne({ _id: doc._id }, { $unset: { receiptId: 1, receiptCode: 1 } });
    await InventoryLedgerEntryModel.deleteMany({});
    expect(await backfillRetailRestockReceipts(scope, true)).toMatchObject([{ status: "needs_review" }]);
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(1);
  });
});
