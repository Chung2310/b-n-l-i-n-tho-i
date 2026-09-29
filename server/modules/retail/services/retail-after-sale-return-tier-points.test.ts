import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { RetailAfterSaleService } from "./retail-after-sale.service";
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
import { CustomerModel } from "../../customer-management/models/customer.model";
import { CustomerPointLedgerModel } from "../../customer-management/models/customer-point-ledger.model";
import { CustomerSettingsModel } from "../../customer-management/models/customer-settings.model";
import { RetailCustomerTierJobModel } from "../models/retail-customer-tier-job.model";
import { RetailCustomerTierHistoryModel } from "../models/retail-customer-tier-history.model";
import { RepairTicketModel } from "../../repair/repair-ticket.model";

const scope = { companyCode: "TIER_PTS_TEST", branchId: new Types.ObjectId().toString() };
const actor = { id: "cashier", displayName: "Thu ngân" };
const models: mongoose.Model<any>[] = [
  RetailAfterSaleModel,
  RetailOrderModel,
  GoodsReceiptModel,
  ProductVariantModel,
  InventoryBalanceModel,
  InventoryLedgerEntryModel,
  WarehouseModel,
  SerialUnitModel,
  SerialEventModel,
  StockLogModel,
  CustomerModel,
  CustomerPointLedgerModel,
  CustomerSettingsModel,
  RetailCustomerTierJobModel,
  RetailCustomerTierHistoryModel,
  RepairTicketModel,
];

let repl: MongoMemoryReplSet;
let customer: any;
let order: any;
let variantId: string;
let warehouseId: string;

beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  for (const model of models) await model.init();
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

beforeEach(async () => {
  for (const model of models) await model.deleteMany({});

  await CustomerSettingsModel.create({
    companyCode: scope.companyCode,
    tierEvaluationMetric: "gross_profit",
    customerTiers: [
      { code: "standard", name: "Thành viên", minGrossProfit: 0 },
      { code: "silver", name: "Hạng Bạc", minGrossProfit: 500_000 },
      { code: "gold", name: "Hạng Vàng", minGrossProfit: 1_000_000 },
    ],
    pointsPolicy: {
      enabled: true,
      grossProfitPerPoint: 10000, // 10.000đ lãi gộp = 1 điểm
      pointRedeemValue: 1000,
    },
  });

  customer = await CustomerModel.create({
    companyCode: scope.companyCode,
    customerCode: "KH-001",
    name: "Nguyen Van A",
    phone: "0988776655",
    normalizedPhone: "0988776655",
    tier: { code: "gold", name: "Hạng Vàng", minGrossProfit: 1_000_000 },
    tierGrossProfit: 1_200_000,
    tierTotalSales: 3_000_000,
    pointsBalance: 120, // 120 điểm
    totalPointsEarned: 120,
    totalPointsRedeemed: 0,
    status: "active",
    source: "manual",
    createdBy: "admin",
    createdByName: "Admin",
  });

  const productId = new Types.ObjectId();
  const variantObjectId = new Types.ObjectId();
  variantId = String(variantObjectId);
  await ProductVariantModel.collection.insertOne({
    _id: variantObjectId,
    companyCode: scope.companyCode,
    productId: String(productId),
    sku: "IPHONE-15",
    status: "active",
  } as any);

  const warehouse = await WarehouseModel.create({
    ...scope,
    code: "MAIN",
    name: "Kho bán hàng",
    isDefault: true,
    isActive: true,
    kind: "selling",
  });
  warehouseId = String(warehouse._id);

  await InventoryBalanceModel.create({
    ...scope,
    warehouseId,
    productId: String(productId),
    variantId,
    sku: "IPHONE-15",
    quantity: 0,
    averageCost: 15_000_000,
  });

  // Đơn hàng: 2 chiếc iPhone, bán 20tr/chiếc = 40tr. Giá vốn 15tr/chiếc = 30tr.
  // Lợi nhuận gộp ban đầu = 10tr.
  order = await RetailOrderModel.create({
    ...scope,
    orderCode: "DH-10001",
    customerId: String(customer._id),
    customerName: customer.name,
    customerPhone: customer.phone,
    status: "completed",
    paymentStatus: "paid",
    stockApplied: true,
    businessDate: "2026-09-29",
    items: [
      {
        productId: variantId,
        sku: "IPHONE-15",
        productName: "iPhone 15",
        unit: "cái",
        quantity: 2,
        unitPrice: 20_000_000,
        unitCost: 15_000_000,
        discountAmount: 0,
        lineTotal: 40_000_000,
        trackingMode: "serial",
        serialNumbers: ["SN-01", "SN-02"],
      },
    ],
    subtotal: 40_000_000,
    orderDiscount: 0,
    taxRate: 0,
    taxAmount: 0,
    shippingFee: 0,
    grandTotal: 40_000_000,
    totalCost: 30_000_000,
    paidAmount: 40_000_000,
    refundedAmount: 0,
    dueAmount: 0,
    salespersonId: actor.id,
    salespersonName: actor.displayName,
    createdBy: actor.id,
    createdByName: actor.displayName,
  });

  await InventoryLedgerEntryModel.create({ ...scope, warehouseId, productId: String(productId), variantId, sku: "IPHONE-15", productName: "iPhone 15", direction: "out", purpose: "sale", quantity: 2, quantityDelta: -2, unitCost: 15_000_000, unitPrice: 20_000_000, sourceType: "retail-order", sourceId: String(order._id), sourceLine: 0, idempotencyKey: `order:${order._id}:out`, operatorName: actor.displayName });

  await SerialUnitModel.create([
    {
      ...scope,
      warehouseId,
      productId: String(productId),
      variantId,
      sku: "IPHONE-15",
      productName: "iPhone 15",
      internalBarcode: "BC-SN01",
      normalizedInternalBarcode: "BC-SN01",
      serialNumber: "SN-01",
      normalizedSerialNumber: "SN-01",
      status: "sold" as const,
      soldOrderId: String(order._id),
      createdBy: actor.id,
      updatedBy: actor.id,
    },
    {
      ...scope,
      warehouseId,
      productId: String(productId),
      variantId,
      sku: "IPHONE-15",
      productName: "iPhone 15",
      internalBarcode: "BC-SN02",
      normalizedInternalBarcode: "BC-SN02",
      serialNumber: "SN-02",
      normalizedSerialNumber: "SN-02",
      status: "sold" as const,
      soldOrderId: String(order._id),
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  ]);

  await SerialUnitModel.updateMany({}, { $set: { soldBranchId: scope.branchId, currentDocumentType: "retail-order", currentDocumentId: String(order._id) } });
  const units = await SerialUnitModel.find().lean();
  await SerialEventModel.create(units.map((unit) => ({ ...scope, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "sold", fromStatus: "in_stock", toStatus: "sold", documentType: "retail-order", documentId: String(order._id), actorId: actor.id, actorName: actor.displayName })));

  // Ghi nhận đơn hàng đã tích 100 điểm khi mua (10tr lãi gộp / 100k = 100 điểm)
  await CustomerPointLedgerModel.create({
    companyCode: scope.companyCode,
    branchId: scope.branchId,
    customerId: String(customer._id),
    transactionCode: "PNT-EARN-01",
    type: "EARN_ORDER",
    points: 100,
    balanceBefore: 20,
    balanceAfter: 120,
    sourceType: "retail_order",
    sourceId: String(order._id),
    sourceCode: order.orderCode,
    reason: "Tích điểm đơn hàng DH-10001",
    createdAt: new Date(),
  });
});

describe("RetailAfterSaleService - Trả hàng trừ điểm phân hạng & điểm thưởng", () => {
  it("trả hàng 1 phần: thu hồi điểm thưởng theo tỷ lệ, giảm giá vốn và kích hoạt cập nhật phân hạng", async () => {
    // Trả 1 chiếc iPhone (giá 20tr, giá vốn 15tr)
    const returnInput = {
      type: "return",
      orderId: String(order._id),
      items: [
        {
          orderLineIndex: 0,
          quantity: 1,
          serialNumbers: ["SN-01"],
          condition: "good",
        },
      ],
      paymentMethod: "cash",
      reason: "Khách đổi ý trả hàng 1 máy",
      idempotencyKey: "ret-part-1",
    };

    const doc: any = await RetailAfterSaleService.create(scope, returnInput, actor);
    expect(doc).toBeDefined();

    // 1. Kiểm tra đơn hàng được cập nhật refundedAmount và totalCost
    const updatedOrder = await RetailOrderModel.findById(order._id).lean();
    expect(updatedOrder?.refundedAmount).toBe(20_000_000);
    expect(updatedOrder?.totalCost).toBe(15_000_000); // 30tr - 15tr = 15tr

    // 2. Kiểm tra điểm thưởng khách hàng bị trừ 50% (50 điểm trên 100 điểm ban đầu)
    const updatedCustomer = await CustomerModel.findById(customer._id).lean();
    expect(updatedCustomer?.pointsBalance).toBe(70); // 120 - 50 = 70 điểm
    expect(updatedCustomer?.totalPointsEarned).toBe(70); // 120 - 50 = 70 điểm

    // 3. Kiểm tra sổ cái điểm thưởng có giao dịch REFUND_REVERT
    const revertLedger = await CustomerPointLedgerModel.findOne({
      companyCode: scope.companyCode,
      sourceId: String(order._id),
      type: "REFUND_REVERT",
    }).lean();
    expect(revertLedger).toBeDefined();
    expect(revertLedger?.points).toBe(-50);
    expect(revertLedger?.balanceAfter).toBe(70);

    // 4. Đợi tier refresh hoàn tất
    await expect.poll(async () => (await RetailCustomerTierJobModel.findOne({ sourceKey: `retail-after-sale:${doc._id}:tier-return` }).lean())?.status, { timeout: 10000 }).toBe("completed");

    // Khách hàng còn lại 1 đơn: doanh số net = 20tr, lợi nhuận gộp = 20tr - 15tr = 5tr
    // Với 5tr lãi gộp >= 1tr (Gold threshold), khách giữ Gold, nhưng tierGrossProfit và tierTotalSales được cập nhật chính xác
    const refreshedCustomer = await CustomerModel.findById(customer._id).lean();
    expect(refreshedCustomer?.tierGrossProfit).toBe(5_000_000);
    expect(refreshedCustomer?.tierTotalSales).toBe(20_000_000);
  });

  it("trả hàng toàn bộ: thu hồi toàn bộ điểm thưởng đã tích và hạ hạng thành viên nếu không đủ điều kiện", async () => {
    // Trả toàn bộ 2 chiếc iPhone (giá 40tr)
    const returnInput = {
      type: "return",
      orderId: String(order._id),
      items: [
        {
          orderLineIndex: 0,
          quantity: 2,
          serialNumbers: ["SN-01", "SN-02"],
          condition: "good",
        },
      ],
      paymentMethod: "cash",
      reason: "Khách trả toàn bộ đơn hàng",
      idempotencyKey: "ret-full-1",
    };

    const doc: any = await RetailAfterSaleService.create(scope, returnInput, actor);
    expect(doc).toBeDefined();

    // 1. Kiểm tra đơn hàng: refundedAmount = 40tr, totalCost = 0
    const updatedOrder = await RetailOrderModel.findById(order._id).lean();
    expect(updatedOrder?.refundedAmount).toBe(40_000_000);
    expect(updatedOrder?.totalCost).toBe(0);
    expect(updatedOrder?.paymentStatus).toBe("refunded");

    // 2. Thu hồi toàn bộ 100 điểm đã tích
    const updatedCustomer = await CustomerModel.findById(customer._id).lean();
    expect(updatedCustomer?.pointsBalance).toBe(20); // 120 - 100 = 20
    expect(updatedCustomer?.totalPointsEarned).toBe(20);

    // 3. Đợi tier refresh hoàn tất
    await expect.poll(async () => (await RetailCustomerTierJobModel.findOne({ sourceKey: `retail-after-sale:${doc._id}:tier-return` }).lean())?.status, { timeout: 10000 }).toBe("completed");

    // Doanh số net = 0, lãi gộp = 0 -> khách bị hạ về hạng Standard (Thành viên)
    const downgradedCustomer = await CustomerModel.findById(customer._id).lean();
    expect(downgradedCustomer?.tierGrossProfit).toBe(0);
    expect(downgradedCustomer?.tierTotalSales).toBe(0);
    expect(downgradedCustomer?.tier?.code).toBe("standard");
  });
});
