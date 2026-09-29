import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Keep inventory/order/invoice persistence real; isolate downstream notification/tier integrations.
vi.mock("../retail/services/retail-order-events", () => ({ publishRetailOrderEvent: vi.fn(async () => undefined) }));
vi.mock("../retail/services/retail-customer-tier.service", () => ({ enqueueTierRefresh: vi.fn(), processTierRefreshBySourceKey: vi.fn(async () => undefined) }));
vi.mock("../customer-management/contracts", () => ({ getCustomerBrief: vi.fn(async (_scope, customerId) => ({ customerId, name: "Customer", status: "active", type: "individual" })), getBillingProfile: vi.fn() }));
vi.mock("../customer-management/services/customer-settings.service", () => ({ CustomerSettingsService: { getSettings: vi.fn(async () => ({ pointsPolicy: { enabled: false } })) } }));
vi.mock("../partners/commission-snapshot", () => ({ resolveCollaborator: vi.fn(), snapshotRetail: vi.fn(async () => null) }));

import { BranchModel } from "../../model/branch.model";
import { CompanyModel } from "../../model/company.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { ProductPriceModel } from "../../model/product-price.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../model/stock-log.model";
import { GoodsReceiptModel } from "../../model/goods-receipt.model";
import { RetailOrderModel } from "../retail/models/retail-order.model";
import { RetailOrderCounterModel } from "../retail/models/retail-order-counter.model";
import { RetailInvoiceCounterModel } from "../retail/models/retail-invoice-counter.model";
import { RetailInvoiceModel } from "../retail/models/retail-invoice.model";
import { RetailIdempotencyModel } from "../retail/models/retail-idempotency.model";
import { RetailSettingsModel } from "../retail/models/retail-settings.model";
import { RetailAfterSaleModel } from "../retail/models/retail-after-sale.model";
import { CustomerPointLedgerModel } from "../customer-management/models/customer-point-ledger.model";
import { SerialUnitModel } from "./serials/serial-unit.model";
import { SerialEventModel } from "./serials/serial-event.model";
import { RetailOrderService } from "../retail/services/retail-order.service";
import { RetailAfterSaleService } from "../retail/services/retail-after-sale.service";
import { publishRetailOrderEvent } from "../retail/services/retail-order-events";
import { snapshotRetail } from "../partners/commission-snapshot";
import { resolveSaleCost, resolveReturnCost } from "../finance/services/cost-resolution";
import { financeReport } from "../finance/services/management.service";

const id = () => new mongoose.Types.ObjectId().toString();
const branchId = id(), warehouseId = id(), productId = id(), variantId = id(), orderId = id();
const scope = { companyCode: "RETAILCOST", branchId };
const actor = { id: "cashier", displayName: "Cashier" };
const models = [BranchModel, CompanyModel, WarehouseModel, ProductCatalogModel, ProductVariantModel, ProductPriceModel, InventoryBalanceModel, InventoryLedgerEntryModel, StockLogModel, GoodsReceiptModel, RetailOrderModel, RetailOrderCounterModel, RetailInvoiceModel, RetailInvoiceCounterModel, RetailIdempotencyModel, RetailSettingsModel, RetailAfterSaleModel, CustomerPointLedgerModel, SerialUnitModel, SerialEventModel];
let replica: MongoMemoryReplSet;
const balance = () => InventoryBalanceModel.findOne({ warehouseId, variantId }).lean();
const order = () => RetailOrderModel.findById(orderId).lean();
const confirmInput = (extra: any = {}) => ({ idempotencyKey: "confirm-1", expectedVersion: 0, expectedGrandTotal: 400, payments: [{ method: "cash", amount: 400, tenderedAmount: 400 }], ...extra });
const confirm = (extra: any = {}) => RetailOrderService.confirm(scope, orderId, confirmInput(extra), actor);
const returnInput = (extra: any = {}) => ({ type: "return", orderId, items: [{ orderLineIndex: 0, quantity: 1 }], reason: "Unused", paymentMethod: "cash", idempotencyKey: "return-1", ...extra });
const cancelInput = (extra: any = {}) => ({ reason: "Cancelled", refunds: [{ method: "cash", amount: 400 }], idempotencyKey: "cancel-1", expectedVersion: 1, ...extra });
const cancel = (extra: any = {}) => RetailOrderService.cancel(scope, orderId, cancelInput(extra), actor, undefined, true);
async function debtSale() {
  await RetailOrderModel.updateOne({ _id: orderId }, { dueDate: "2026-12-31" });
  await RetailOrderService.confirm(scope, orderId, confirmInput({ payments: [] }), actor);
}
const collectInput = (extra: any = {}) => ({ idempotencyKey: "collect-1", expectedVersion: 1, payments: [{ method: "cash", amount: 100 }], ...extra });
const collect = (extra: any = {}) => RetailOrderService.collect(scope, orderId, collectInput(extra), actor);
const draftCustomerId = id();
const createInput = (extra: any = {}) => ({ idempotencyKey: "create-1", customerId: draftCustomerId, items: [{ productId: variantId, quantity: 2, discount: { type: "amount", value: 0 } }], orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, ...extra });
const createDraft = (extra: any = {}) => RetailOrderService.createDraft(scope, createInput(extra), actor);
const updateInput = (extra: any = {}) => createInput({ idempotencyKey: "update-1", version: 0, ...extra });
const updateDraft = (extra: any = {}) => RetailOrderService.updateDraft(scope, orderId, updateInput(extra), actor);
async function trackedSale(mode: "serial" | "unit_barcode" = "serial") {
  await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: mode });
  await RetailOrderModel.updateOne({ _id: orderId }, mode === "serial" ? { "items.0.serialNumbers": ["SN1", "SN2"] } : { "items.0.internalBarcodes": ["BC-SN1", "BC-SN2"] });
  await InventoryBalanceModel.updateOne({ warehouseId }, { quantity: 2 });
  await SerialUnitModel.create(["SN1", "SN2"].map((serialNumber) => ({ ...scope, warehouseId, productId, variantId, sku: "SKU", productName: "Product", serialNumber, normalizedSerialNumber: serialNumber, internalBarcode: `BC-${serialNumber}`, normalizedInternalBarcode: `BC-${serialNumber}`, status: "in_stock" as const, createdBy: actor.id, updatedBy: actor.id })));
  await confirm();
}
async function expectCancellationUnchanged() {
  expect(await order()).toMatchObject({ status: "completed", refundedAmount: 0, totalCost: 200.5 });
  expect((await balance())?.quantity).toBe(0);
  expect(await GoodsReceiptModel.countDocuments()).toBe(0);
  expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(0);
  expect(await SerialEventModel.countDocuments({ eventType: "sale_cancelled" })).toBe(0);
  expect((await RetailInvoiceModel.findOne().lean())?.status).toBe("issued");
}

describe("retail cost follows the committed stock ledger", () => {
  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replica.getUri());
    await Promise.all(models.map((model: any) => model.init()));
  }, 60000);
  beforeEach(async () => {
    vi.restoreAllMocks(); vi.clearAllMocks();
    await Promise.all(models.map((model: any) => model.deleteMany({})));
    await CompanyModel.collection.insertOne({ code: scope.companyCode, name: "Test Company" } as any);
    await BranchModel.create({ _id: branchId, companyCode: scope.companyCode, code: "MAIN", name: "Main", isActive: true });
    await WarehouseModel.create({ _id: warehouseId, ...scope, code: "MAIN", name: "Main", isDefault: true, isActive: true });
    await ProductCatalogModel.create({ _id: productId, companyCode: scope.companyCode, productCode: "P", name: "Product", normalizedName: "product", productType: "physical", categoryCode: "P", baseUnitCode: "PCS", status: "active", createdBy: actor.id, updatedBy: actor.id });
    await ProductVariantModel.create({ _id: variantId, companyCode: scope.companyCode, productId, sku: "SKU", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: actor.id, updatedBy: actor.id });
    await ProductPriceModel.create({ ...scope, productId, variantId, sku: "SKU", sellingPrice: 200, costPrice: 999, status: "active", createdBy: actor.id, updatedBy: actor.id });
    await InventoryBalanceModel.create({ ...scope, warehouseId, productId, variantId, sku: "SKU", quantity: 10, averageCost: 100.25, reservedQuantity: 0, version: 0 });
    await RetailOrderModel.create({ _id: orderId, ...scope, customerId: id(), customerName: "Customer", items: [{ productId: variantId, sku: "SKU", productName: "Product", unit: "PCS", quantity: 2, unitPrice: 200, unitCost: 999, discountAmount: 0, lineTotal: 400 }], subtotal: 400, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 400, totalCost: 1998, dueAmount: 400, status: "draft", salespersonId: actor.id, salespersonName: actor.displayName, createdBy: actor.id, createdByName: actor.displayName });
  });
  afterAll(async () => { vi.restoreAllMocks(); await mongoose.disconnect(); await replica?.stop(); });

  it("confirmation freezes fractional stock cost before invoice and downstream consumers", async () => {
    await confirm();
    const saved = await order();
    const entry = await InventoryLedgerEntryModel.findOne({ direction: "out" }).lean();
    expect(saved).toMatchObject({ status: "completed", grandTotal: 400, totalCost: 200.5 });
    expect(saved?.items[0]).toMatchObject({ unitCost: 100.25, stockWarehouseId: warehouseId, stockLedgerId: String(entry?._id) });
    expect((await balance())?.quantity).toBe(8);
    expect(vi.mocked(snapshotRetail).mock.calls[0][0].totalCost).toBe(200.5);
    expect((await RetailInvoiceModel.findOne().lean())?.snapshot.grandTotal).toBe(400);
  });

  it("concurrent draft creation retries return one draft and one held slot", async () => {
    const results = await Promise.all([createDraft(), createDraft(), createDraft()]);
    expect(new Set(results.map((draft) => String(draft!._id))).size).toBe(1);
    expect(await RetailOrderModel.countDocuments({ heldSlot: { $exists: true } })).toBe(1);
    expect(await RetailIdempotencyModel.countDocuments({ operation: "create-draft" })).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(10);
  });

  it.each([{ shippingFee: 1 }, { customerId: id() }, { items: [{ productId: variantId, quantity: 1 }] }])("draft key rejects changed content: %j", async (extra) => {
    await createDraft();
    await expect(createDraft(extra)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect(await RetailOrderModel.countDocuments({ heldSlot: { $exists: true } })).toBe(1);
  });

  it("draft keys validate branch, actor and operation", async () => {
    await createDraft();
    await expect(RetailOrderService.createDraft({ ...scope, branchId: id() }, createInput(), actor)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    await expect(RetailOrderService.createDraft(scope, createInput(), { ...actor, id: "other" })).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    await confirm();
    await expect(createDraft({ idempotencyKey: "confirm-1" })).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
  });

  it.each(["edited", "deleted", "cancelled"])("does not replace a %s draft on replay", async (kind) => {
    const created = await createDraft();
    if (kind === "edited") await RetailOrderModel.updateOne({ _id: created!._id }, { $inc: { version: 1 } });
    if (kind === "deleted") await RetailOrderModel.deleteOne({ _id: created!._id });
    if (kind === "cancelled") await RetailOrderModel.updateOne({ _id: created!._id }, { status: "cancelled" });
    await expect(createDraft()).rejects.toMatchObject({ code: "DRAFT_REPLAY_CONFLICT" });
    expect(await RetailIdempotencyModel.countDocuments({ operation: "create-draft" })).toBe(1);
  });

  it("draft persistence and key rollback together", async () => {
    const update = vi.spyOn(RetailIdempotencyModel, "updateOne").mockRejectedValueOnce(new Error("key persistence failed"));
    await expect(createDraft()).rejects.toThrow("key persistence failed");
    update.mockRestore();
    expect(await RetailOrderModel.countDocuments({ heldSlot: { $exists: true } })).toBe(0);
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    await createDraft();
    expect(await RetailOrderModel.countDocuments({ heldSlot: { $exists: true } })).toBe(1);
  });

  it("different draft requests compete safely for five held slots", async () => {
    await RetailOrderModel.deleteMany({});
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => createDraft({ idempotencyKey: `create-${index}` })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "HELD_DRAFT_LIMIT" } });
    expect(await RetailOrderModel.countDocuments()).toBe(5);
    expect(await RetailIdempotencyModel.countDocuments()).toBe(5);
  });

  it("does not swallow an unrelated unique failure during draft creation", async () => {
    const failure = Object.assign(new Error("unrelated duplicate"), { code: 11000, keyPattern: { companyCode: 1, orderCode: 1 } });
    const create = vi.spyOn(RetailOrderModel, "create").mockRejectedValueOnce(failure);
    await expect(createDraft()).rejects.toBe(failure);
    create.mockRestore();
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
  });

  it("draft creation still rejects coupon/manual discount stacking inside its transaction", async () => {
    await expect(createDraft({ couponCode: "SALE", orderDiscount: { type: "amount", value: 10 } })).rejects.toThrow("không cộng dồn");
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
  });

  it("a rejected create can correct its payload under the same key", async () => {
    await expect(createDraft({ shippingFee: -1 })).rejects.toThrow();
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    await createDraft({ shippingFee: 0 });
    await expect(createDraft({ shippingFee: 1 })).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect(await RetailOrderModel.countDocuments({ heldSlot: { $exists: true } })).toBe(1);
  });

  it("concurrent matching draft updates increment the version only once", async () => {
    const results = await Promise.all([updateDraft(), updateDraft(), updateDraft()]);
    expect(results.map((result) => result!.version)).toEqual([1, 1, 1]);
    expect((await order())?.version).toBe(1);
    expect(await RetailIdempotencyModel.countDocuments({ operation: "update-draft" })).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });

  it.each([{ shippingFee: 1 }, { version: 1 }, { customerId: id() }])("update key rejects changed payload: %j", async (extra) => {
    await updateDraft();
    await expect(updateDraft(extra)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect((await order())?.version).toBe(1);
  });

  it("different update keys cannot both change the same version", async () => {
    const results = await Promise.allSettled([updateDraft(), updateDraft({ idempotencyKey: "update-2" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "ORDER_VERSION_CONFLICT" } });
    expect((await order())?.version).toBe(1);
  });

  it("update replay does not return a later edit or a confirmed order", async () => {
    await updateDraft();
    await updateDraft({ idempotencyKey: "update-2", version: 1 });
    await expect(updateDraft()).rejects.toMatchObject({ code: "DRAFT_REPLAY_CONFLICT" });
    await confirm({ expectedVersion: 2 });
    await expect(updateDraft({ idempotencyKey: "update-2", version: 1 })).rejects.toMatchObject({ code: "DRAFT_REPLAY_CONFLICT" });
  });

  it("update replay checks scope, actor and current authority", async () => {
    await RetailOrderModel.updateOne({ _id: orderId }, { createdBy: "another" });
    await RetailOrderService.updateDraft(scope, orderId, updateInput(), actor, true);
    await expect(updateDraft()).rejects.toMatchObject({ status: 403 });
    await expect(RetailOrderService.updateDraft({ ...scope, branchId: id() }, orderId, updateInput(), actor, true)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    await expect(RetailOrderService.updateDraft(scope, orderId, updateInput(), { ...actor, id: "different" }, true)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
  });

  it("failed update-key persistence rolls back the draft and permits retry", async () => {
    const update = vi.spyOn(RetailIdempotencyModel, "updateOne").mockRejectedValueOnce(new Error("key failed"));
    await expect(updateDraft()).rejects.toThrow("key failed");
    update.mockRestore();
    expect((await order())?.version).toBe(0);
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    await updateDraft();
    expect((await order())?.version).toBe(1);
  });

  it.each([{ idempotencyKey: "" }, { version: "0" }, { version: -1 }])("rejects unkeyed/unversioned draft updates: %j", async (extra) => {
    await expect(updateDraft(extra)).rejects.toMatchObject({ code: "DRAFT_UPDATE_INVALID" });
    expect((await order())?.version).toBe(0);
  });

  it("rolls back order, invoice, idempotency record and stock after a downstream failure", async () => {
    vi.mocked(publishRetailOrderEvent).mockRejectedValueOnce(new Error("event persistence failed"));
    await expect(confirm()).rejects.toThrow("event persistence failed");
    expect(await order()).toMatchObject({ status: "draft", totalCost: 1998, stockApplied: false });
    expect((await balance())?.quantity).toBe(10);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await RetailInvoiceModel.countDocuments()).toBe(0);
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    await confirm();
    expect((await order())?.totalCost).toBe(200.5);
  });

  it("replays confirmation with the original frozen cost after prices change", async () => {
    await confirm();
    await InventoryBalanceModel.updateOne({ warehouseId }, { averageCost: 300 });
    await ProductPriceModel.updateOne({ variantId }, { costPrice: 888 });
    const result = await confirm();
    expect(result.order.totalCost).toBe(200.5);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
    expect((await balance())?.quantity).toBe(8);
  });

  it.each([
    ["branch", { ...scope, branchId: id() }, orderId, {}, actor, undefined],
    ["order", scope, id(), {}, actor, undefined],
    ["total", scope, orderId, { expectedGrandTotal: 401 }, actor, undefined],
    ["payment", scope, orderId, { payments: [{ method: "transfer", amount: 400, reference: "REF" }] }, actor, undefined],
    ["tendered", scope, orderId, { payments: [{ method: "cash", amount: 400, tenderedAmount: 500 }] }, actor, undefined],
    ["actor", scope, orderId, {}, { ...actor, id: "other" }, undefined],
    ["shift", scope, orderId, {}, actor, { _id: id() }],
  ])("confirmation key rejects changed %s without posting again", async (_name, requestScope, requestId, extra, requestActor, shift) => {
    await confirm();
    await expect(RetailOrderService.confirm(requestScope as any, requestId as string, confirmInput(extra), requestActor, shift)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT", status: 409 });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
    expect(await RetailInvoiceModel.countDocuments()).toBe(1);
    expect((await balance())?.quantity).toBe(8);
  });

  it("concurrent matching confirmations replay one committed order and invoice", async () => {
    const results = await Promise.all([confirm(), confirm(), confirm()]);
    expect(new Set(results.map((result) => String(result.order._id))).size).toBe(1);
    expect(new Set(results.map((result) => String(result.invoice._id))).size).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
    expect(await RetailIdempotencyModel.countDocuments()).toBe(1);
  });

  it.each([undefined, "0", -1, 0.5, null])("requires an explicit nonnegative integer confirmation version: %s", async (expectedVersion) => {
    await expect(confirm({ expectedVersion })).rejects.toMatchObject({ code: "ORDER_VERSION_REQUIRED", status: 400 });
    expect((await order())?.status).toBe("draft");
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });

  it("blocks stale confirmation even when the edited draft total is unchanged", async () => {
    const customerId = id();
    await RetailOrderModel.updateOne({ _id: orderId }, { $set: { customerId }, $inc: { version: 1 } });
    await expect(confirm()).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT", status: 409 });
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    expect(await RetailInvoiceModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(10);
    await confirm({ expectedVersion: 1 });
    expect(await order()).toMatchObject({ customerId, status: "completed", version: 2 });
  });

  it("transaction retry does not silently confirm a draft edited after its snapshot read", async () => {
    const original = RetailOrderModel.findOne.bind(RetailOrderModel);
    vi.spyOn(RetailOrderModel, "findOne").mockImplementationOnce(((...args: any[]) => ({ session: async (session: any) => {
      const draft = await original(args[0]).session(session);
      await RetailOrderModel.updateOne({ _id: orderId }, { $set: { customerName: "Changed elsewhere" }, $inc: { version: 1 } });
      return draft;
    } })) as any);
    await expect(confirm()).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
    expect(await order()).toMatchObject({ status: "draft", version: 1 });
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    expect(await RetailInvoiceModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(10);
  });

  it("replay requires the original expected version, not the latest order version", async () => {
    await confirm();
    await confirm();
    await expect(confirm({ expectedVersion: 1 })).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
    expect(await RetailInvoiceModel.countDocuments()).toBe(1);
  });

  it("concurrent conflicting confirmations accept only one payment request", async () => {
    const results = await Promise.allSettled([400, 500].map((tenderedAmount) => confirm({ payments: [{ method: "cash", amount: 400, tenderedAmount }] })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "ORDER_IDEMPOTENCY_CONFLICT" } });
    expect(await RetailInvoiceModel.countDocuments()).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
  });

  it("confirmation normalizes defaults but still checks noncash references", async () => {
    const input = confirmInput({ payments: [{ method: "transfer", amount: 400, reference: " REF " }] });
    await RetailOrderService.confirm(scope, orderId, input, actor);
    await RetailOrderService.confirm(scope, orderId, { ...input, payments: [{ method: "transfer", amount: 400, reference: "REF" }] }, actor);
    await expect(RetailOrderService.confirm(scope, orderId, { ...input, payments: [{ method: "transfer", amount: 400, reference: "OTHER" }] }, actor)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
  });

  it("replay rechecks manager access to another cashier's order", async () => {
    await RetailOrderModel.updateOne({ _id: orderId }, { createdBy: "other-cashier" });
    const input = confirmInput();
    await RetailOrderService.confirm(scope, orderId, input, actor, undefined, true);
    await expect(RetailOrderService.confirm(scope, orderId, input, actor, undefined, false)).rejects.toMatchObject({ code: "HELD_DRAFT_FORBIDDEN", status: 403 });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
  });

  it("hides processing keys outside their branch and rejects branchless legacy replay", async () => {
    await confirm();
    await RetailIdempotencyModel.updateOne({}, { status: "processing" });
    expect(await RetailOrderService.idempotency(scope, "confirm-1")).toEqual({ status: "processing" });
    expect(await RetailOrderService.idempotency({ ...scope, branchId: id() }, "confirm-1")).toEqual({ status: "not_found" });
    await expect(confirm()).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_PROCESSING" });
    await RetailIdempotencyModel.updateOne({}, { status: "completed", $unset: { branchId: 1 } });
    expect(await RetailOrderService.idempotency(scope, "confirm-1")).toEqual({ status: "not_found" });
    await expect(confirm()).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
  });

  it.each(["operation", "legacy", "invoice", "order"])("rejects confirmation replay with broken %s evidence", async (kind) => {
    await confirm();
    if (kind === "operation") await RetailIdempotencyModel.updateOne({}, { operation: "collect" });
    if (kind === "legacy") await RetailIdempotencyModel.updateOne({}, { $unset: { requestFingerprint: 1 } });
    if (kind === "invoice") await RetailInvoiceModel.updateOne({}, { orderId: id() });
    if (kind === "order") await RetailOrderModel.updateOne({ _id: orderId }, { branchId: id() });
    await expect(confirm()).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
  });

  it("key status hides another branch and never reports completed with missing documents", async () => {
    await confirm();
    expect(await RetailOrderService.idempotency({ ...scope, branchId: id() }, "confirm-1")).toEqual({ status: "not_found" });
    expect(await RetailOrderService.idempotency({ ...scope, companyCode: "OTHER" }, "confirm-1")).toEqual({ status: "not_found" });
    expect(await RetailOrderService.idempotency(scope, "confirm-1")).toMatchObject({ status: "completed", order: { orderCode: expect.any(String) }, invoice: { orderId } });
    await RetailInvoiceModel.deleteMany({});
    await expect(RetailOrderService.idempotency(scope, "confirm-1")).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
  });

  it("does not turn unrelated unique failures into confirmation success", async () => {
    const error = Object.assign(new Error("invoice number duplicate"), { code: 11000, keyPattern: { companyCode: 1, invoiceNo: 1 } });
    vi.mocked(publishRetailOrderEvent).mockRejectedValueOnce(error);
    await expect(confirm()).rejects.toBe(error);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    await confirm();
    expect(await RetailInvoiceModel.countDocuments()).toBe(1);
  });

  it("replays a partial collection and then a full collection without double payment", async () => {
    await debtSale();
    await collect(); await collect();
    expect(await order()).toMatchObject({ paidAmount: 100, dueAmount: 300, version: 2 });
    const rest = { idempotencyKey: "collect-2", expectedVersion: 2, payments: [{ method: "transfer", amount: 300, reference: "BANK" }] };
    await collect(rest); await collect(rest);
    expect(await order()).toMatchObject({ paidAmount: 400, dueAmount: 0, status: "completed", version: 3 });
    expect((await order())?.payments).toHaveLength(2);
    expect(vi.mocked(publishRetailOrderEvent).mock.calls.filter((call) => call[0] === "paid")).toHaveLength(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
  });

  it("concurrent matching collections post one payment", async () => {
    await debtSale();
    const results = await Promise.all([collect(), collect(), collect()]);
    expect(results.map((result) => result?.paidAmount)).toEqual([100, 100, 100]);
    expect((await order())?.payments).toHaveLength(1);
  });

  it("different keys competing on one order version cannot both collect", async () => {
    await debtSale();
    const results = await Promise.allSettled([collect(), collect({ idempotencyKey: "collect-2" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "ORDER_VERSION_CONFLICT" } });
    expect((await order())?.paidAmount).toBe(100);
    expect(await RetailIdempotencyModel.countDocuments({ operation: "collect-order" })).toBe(1);
  });

  it.each([
    ["amount", { payments: [{ method: "cash", amount: 101 }] }],
    ["method", { payments: [{ method: "transfer", amount: 100 }] }],
    ["version", { expectedVersion: 2 }],
    ["tender", { payments: [{ method: "cash", amount: 100, tenderedAmount: 200 }] }],
  ])("rejects a collection key with changed %s", async (_name, extra) => {
    await debtSale(); await collect();
    await expect(collect(extra)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect((await order())?.paidAmount).toBe(100);
  });

  it("collection keys check branch, order, actor, shift and operation", async () => {
    await debtSale(); await collect();
    await expect(RetailOrderService.collect({ ...scope, branchId: id() }, orderId, collectInput(), actor)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    await expect(RetailOrderService.collect(scope, id(), collectInput(), actor)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    await expect(RetailOrderService.collect(scope, orderId, collectInput(), { ...actor, id: "other" })).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    await expect(RetailOrderService.collect(scope, orderId, collectInput(), actor, { _id: id() })).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    await expect(collect({ idempotencyKey: "confirm-1" })).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect((await order())?.paidAmount).toBe(100);
  });

  it.each([
    { idempotencyKey: "" }, { expectedVersion: undefined }, { expectedVersion: "1" },
    { payments: [] }, { payments: [{ method: "cash", amount: 401 }] },
  ])("rejects invalid collection without keeping the key: %j", async (extra) => {
    await debtSale();
    await expect(collect(extra)).rejects.toMatchObject({ code: "COLLECTION_INVALID" });
    expect((await order())?.paidAmount).toBe(0);
    expect(await RetailIdempotencyModel.countDocuments({ operation: "collect-order" })).toBe(0);
  });

  it("collection event failure rolls back money and key so retry can succeed", async () => {
    await debtSale();
    vi.mocked(publishRetailOrderEvent).mockRejectedValueOnce(new Error("event failure"));
    await expect(collect()).rejects.toThrow("event failure");
    expect(await order()).toMatchObject({ paidAmount: 0, dueAmount: 400, version: 1 });
    expect(await RetailIdempotencyModel.countDocuments({ operation: "collect-order" })).toBe(0);
    await collect();
    expect((await order())?.paidAmount).toBe(100);
  });

  it("replays after-sale requests without a second refund or receipt", async () => {
    await confirm();
    const first: any = await RetailAfterSaleService.create(scope, returnInput(), actor);
    const retry: any = await RetailAfterSaleService.create(scope, returnInput({ reason: " Unused ", paymentReference: "", items: [{ quantity: "1", orderLineIndex: "0", condition: "good", note: "" }] }), actor);
    expect(String(retry._id)).toBe(String(first._id));
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect(await RetailAfterSaleModel.countDocuments()).toBe(1);
    expect((await balance())?.quantity).toBe(9);
    expect((await order())?.refunds).toHaveLength(1);
  });

  it.each([
    ["branch", {}, { ...scope, branchId: id() }, actor, undefined],
    ["order", { orderId: id() }, scope, actor, undefined],
    ["operation", { type: "buyback" }, scope, actor, undefined],
    ["quantity", { items: [{ orderLineIndex: 0, quantity: 2 }] }, scope, actor, undefined],
    ["reason", { reason: "Different" }, scope, actor, undefined],
    ["payment", { paymentMethod: "transfer" }, scope, actor, undefined],
    ["reference", { paymentReference: "REF" }, scope, actor, undefined],
    ["condition", { items: [{ orderLineIndex: 0, quantity: 1, condition: "poor" }] }, scope, actor, undefined],
    ["actor", {}, scope, { ...actor, id: "other" }, undefined],
    ["shift", {}, scope, actor, { _id: id() }],
  ])("rejects reuse of an after-sale key with changed %s", async (_name, extra, requestScope, requestActor, shift) => {
    await confirm();
    await RetailAfterSaleService.create(scope, returnInput(), actor);
    await expect(RetailAfterSaleService.create(requestScope as any, returnInput(extra), requestActor, shift)).rejects.toMatchObject({ status: 409, code: "AFTER_SALE_IDEMPOTENCY_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await order())?.refunds).toHaveLength(1);
    expect((await balance())?.quantity).toBe(9);
  });

  it("buyback replay checks the agreed purchase amount", async () => {
    await confirm();
    const input = returnInput({ type: "buyback", items: [{ orderLineIndex: 0, quantity: 1, unitAmount: 150 }] });
    const first: any = await RetailAfterSaleService.create(scope, input, actor);
    const retry: any = await RetailAfterSaleService.create(scope, input, actor);
    expect(String(retry._id)).toBe(String(first._id));
    await expect(RetailAfterSaleService.create(scope, { ...input, items: [{ orderLineIndex: 0, quantity: 1, unitAmount: 151 }] }, actor)).rejects.toMatchObject({ code: "AFTER_SALE_IDEMPOTENCY_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await balance())?.quantity).toBe(9);
  });

  it.each(["serial", "unit_barcode"] as const)("partially returns %s and leaves the other machine sold", async (mode) => {
    await trackedSale(mode);
    const items = [{ orderLineIndex: 0, quantity: 1, ...(mode === "serial" ? { serialNumbers: ["SN1"] } : { internalBarcodes: ["BC-SN1"] }) }];
    const result: any = await RetailAfterSaleService.create(scope, returnInput({ items }), actor);
    expect(await SerialUnitModel.findOne({ serialNumber: "SN1" }).lean()).toMatchObject({ status: "in_stock", currentDocumentId: result.receiptId });
    expect(await SerialUnitModel.findOne({ serialNumber: "SN2" }).lean()).toMatchObject({ status: "sold", soldOrderId: orderId });
    expect((await balance())?.quantity).toBe(1);
    expect(await order()).toMatchObject({ totalCost: 100.25, refundedAmount: 200 });
  });

  it.each([
    { warehouseId: "other" }, { productId: "other" }, { variantId: "other" }, { sku: "OTHER" },
    { soldBranchId: "other" }, { currentDocumentType: "repair-ticket" }, { currentDocumentId: "other" },
  ])("rolls back a return when selected machine identity changed: %j", async (patch) => {
    await trackedSale();
    await SerialUnitModel.updateOne({ serialNumber: "SN2" }, patch);
    await expect(RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 0, quantity: 2, serialNumbers: ["SN1", "SN2"] }] }), actor)).rejects.toMatchObject({ code: "AFTER_SALE_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
    expect(await SerialUnitModel.countDocuments({ status: "sold" })).toBe(2);
    expect(await SerialEventModel.countDocuments({ eventType: "sales_return" })).toBe(0);
  });

  it.each(["return", "buyback"])("requires original sale event for %s", async (type) => {
    await trackedSale();
    const unit = await SerialUnitModel.findOne({ serialNumber: "SN1" }).lean();
    await SerialEventModel.deleteMany({ serialUnitId: String(unit!._id) });
    const input = returnInput({ type, items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"], unitAmount: 75 }] });
    await expect(RetailAfterSaleService.create(scope, input, actor)).rejects.toMatchObject({ code: "AFTER_SALE_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
  });

  it("rejects a newer lifecycle event even if the unit still says sold", async () => {
    await trackedSale();
    const unit = await SerialUnitModel.findOne({ serialNumber: "SN1" }).lean();
    await SerialEventModel.create({ ...scope, serialUnitId: String(unit!._id), serialNumber: "SN1", eventType: "repair_returned", fromStatus: "repairing", toStatus: "sold", documentType: "repair-ticket", documentId: id(), actorId: actor.id, actorName: actor.displayName, occurredAt: new Date(Date.now() + 1000) });
    await expect(RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"] }] }), actor)).rejects.toMatchObject({ code: "AFTER_SALE_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
  });

  it("rolls back when a conditional serial restoration no longer matches", async () => {
    await trackedSale();
    vi.spyOn(SerialUnitModel, "findOneAndUpdate").mockResolvedValueOnce(null);
    await expect(RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"] }] }), actor)).rejects.toMatchObject({ code: "AFTER_SALE_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
  });

  it("buys back a tracked machine into the new default warehouse at agreed cost", async () => {
    await trackedSale();
    await WarehouseModel.updateOne({ _id: warehouseId }, { isDefault: false });
    const destination = await WarehouseModel.create({ ...scope, code: "NEW", name: "New", isDefault: true, isActive: true });
    const doc: any = await RetailAfterSaleService.create(scope, returnInput({ type: "buyback", items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"], unitAmount: 75 }] }), actor);
    expect(await SerialUnitModel.findOne({ serialNumber: "SN1" }).lean()).toMatchObject({ status: "in_stock", warehouseId: String(destination._id), currentDocumentId: doc.receiptId });
    expect(await InventoryBalanceModel.findOne({ warehouseId: String(destination._id), variantId }).lean()).toMatchObject({ quantity: 1, averageCost: 75 });
    expect(await order()).toMatchObject({ totalCost: 200.5, refundedAmount: 0 });
  });

  it("rejects a barcode from another machine on the same sold line", async () => {
    await trackedSale();
    await expect(RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"], internalBarcodes: ["BC-SN2"] }] }), actor)).rejects.toMatchObject({ code: "AFTER_SALE_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
  });

  it("rolls back return posting when its serial event fails and permits retry", async () => {
    await trackedSale();
    const input = returnInput({ items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"] }] });
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("return event failed"));
    await expect(RetailAfterSaleService.create(scope, input, actor)).rejects.toThrow("return event failed");
    await expectCancellationUnchanged();
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
    expect(await SerialUnitModel.countDocuments({ status: "sold" })).toBe(2);
    await RetailAfterSaleService.create(scope, input, actor);
    expect(await SerialEventModel.countDocuments({ eventType: "sales_return" })).toBe(1);
  });

  it("serial return replay verifies the requested machine", async () => {
    await trackedSale();
    const input = returnInput({ items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"] }] });
    await RetailAfterSaleService.create(scope, input, actor);
    await RetailAfterSaleService.create(scope, input, actor);
    await expect(RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN2"] }] }), actor)).rejects.toMatchObject({ code: "AFTER_SALE_IDEMPOTENCY_CONFLICT" });
    expect(await SerialEventModel.countDocuments({ eventType: "sales_return" })).toBe(1);
    expect((await balance())?.quantity).toBe(1);
  });

  it("does not expose a matching key from another company", async () => {
    await confirm();
    await RetailAfterSaleService.create(scope, returnInput(), actor);
    await expect(RetailAfterSaleService.create({ ...scope, companyCode: "OTHER" }, returnInput(), actor)).rejects.toMatchObject({ code: "ORDER_NOT_ELIGIBLE" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
  });

  it("does not swallow an unrelated unique-index failure", async () => {
    await confirm();
    const error = Object.assign(new Error("duplicate document code"), { code: 11000, keyPattern: { companyCode: 1, code: 1 } });
    const create = vi.spyOn(RetailAfterSaleModel, "create").mockRejectedValueOnce(error);
    await expect(RetailAfterSaleService.create(scope, returnInput(), actor)).rejects.toBe(error);
    create.mockRestore();
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(8);
  });

  it("fails closed when an old after-sale key has no fingerprint", async () => {
    await confirm();
    await RetailAfterSaleService.create(scope, returnInput(), actor);
    await RetailAfterSaleModel.updateOne({}, { $unset: { requestFingerprint: 1 } });
    await expect(RetailAfterSaleService.create(scope, returnInput(), actor)).rejects.toMatchObject({ code: "AFTER_SALE_IDEMPOTENCY_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
  });

  it("concurrent matching after-sale requests return one committed result", async () => {
    await confirm();
    const results: any[] = await Promise.all(Array.from({ length: 3 }, () => RetailAfterSaleService.create(scope, returnInput(), actor)));
    expect(new Set(results.map((result) => String(result._id))).size).toBe(1);
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await order())?.refunds).toHaveLength(1);
    expect((await balance())?.quantity).toBe(9);
  });

  it("concurrent different after-sale requests cannot share a key", async () => {
    await confirm();
    const results = await Promise.allSettled([1, 2].map((quantity) => RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 0, quantity }] }), actor)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "AFTER_SALE_IDEMPOTENCY_CONFLICT" } });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await order())?.refunds).toHaveLength(1);
  });

  it("a failed after-sale transaction releases the key for a retry", async () => {
    await confirm();
    const save = vi.spyOn(RetailOrderModel.prototype, "save").mockRejectedValueOnce(new Error("order save failed"));
    await expect(RetailAfterSaleService.create(scope, returnInput(), actor)).rejects.toThrow("order save failed");
    save.mockRestore();
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(8);
    await RetailAfterSaleService.create(scope, returnInput(), actor);
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await balance())?.quantity).toBe(9);
  });

  it("partial and full returns preserve sale cost despite later price and average changes", async () => {
    await confirm();
    await InventoryBalanceModel.updateOne({ warehouseId }, { averageCost: 300 });
    await ProductPriceModel.updateOne({ variantId }, { costPrice: 888 });
    const first: any = await RetailAfterSaleService.create(scope, returnInput(), actor);
    expect(first.items[0].unitCost).toBe(100.25);
    expect((await order())?.totalCost).toBe(100.25);
    const second: any = await RetailAfterSaleService.create(scope, returnInput({ idempotencyKey: "return-2" }), actor);
    expect(second.items[0].unitCost).toBe(100.25);
    expect((await order())?.totalCost).toBe(0);
    expect((await balance())?.averageCost).toBeCloseTo(260.05);
    expect(await GoodsReceiptModel.countDocuments()).toBe(2);
  });

  it("restores returned stock and serials to the original warehouse after the default changes", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await RetailOrderModel.updateOne({ _id: orderId }, { "items.0.serialNumbers": ["SN1", "SN2"] });
    await SerialUnitModel.create(["SN1", "SN2"].map((serialNumber) => ({ ...scope, warehouseId, productId, variantId, sku: "SKU", productName: "Product", serialNumber, normalizedSerialNumber: serialNumber, internalBarcode: `BC-${serialNumber}`, normalizedInternalBarcode: `BC-${serialNumber}`, status: "in_stock" as const, createdBy: actor.id, updatedBy: actor.id })));
    await confirm();
    await WarehouseModel.updateOne({ _id: warehouseId }, { isDefault: false });
    await WarehouseModel.create({ ...scope, code: "NEW", name: "New", isDefault: true, isActive: true });
    const doc: any = await RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 0, quantity: 1, serialNumbers: ["SN1"] }] }), actor);
    expect((await GoodsReceiptModel.findById(doc.receiptId).lean())?.warehouseId).toBe(warehouseId);
    expect(await SerialUnitModel.findOne({ serialNumber: "SN1" }).lean()).toMatchObject({ status: "in_stock", warehouseId });
    expect((await balance())?.quantity).toBe(9);
  });

  it("cancellation uses original cost and source identity even if the variant is removed", async () => {
    await confirm();
    await ProductVariantModel.deleteMany({});
    await WarehouseModel.updateOne({ _id: warehouseId }, { isDefault: false });
    await WarehouseModel.create({ ...scope, code: "NEW", name: "New", isDefault: true, isActive: true });
    const result = await cancel();
    expect(result.status).toBe("cancelled");
    expect(await GoodsReceiptModel.findOne().lean()).toMatchObject({ warehouseId, subtotal: 200.5 });
    expect((await balance())?.quantity).toBe(10);
    expect((await RetailInvoiceModel.findOne().lean())?.status).toBe("void");
  });

  it("fails closed on a missing source ledger without altering refunds or stock", async () => {
    await confirm();
    await InventoryLedgerEntryModel.deleteMany({});
    await expect(RetailAfterSaleService.create(scope, returnInput(), actor)).rejects.toMatchObject({ code: "RETAIL_STOCK_SOURCE_CONFLICT" });
    await expect(cancel()).rejects.toMatchObject({ code: "RETAIL_STOCK_SOURCE_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
    expect((await order())?.refundedAmount).toBe(0);
    expect((await balance())?.quantity).toBe(8);
  });

  it("rejects historical cost or source-link mismatches instead of silently repairing them", async () => {
    await confirm();
    await RetailOrderModel.updateOne({ _id: orderId }, { "items.0.unitCost": 999 });
    await expect(RetailAfterSaleService.create(scope, returnInput(), actor)).rejects.toMatchObject({ code: "RETAIL_STOCK_SOURCE_CONFLICT" });
    await RetailOrderModel.updateOne({ _id: orderId }, { "items.0.unitCost": 100.25, "items.0.stockLedgerId": id() });
    await expect(RetailAfterSaleService.create(scope, returnInput(), actor)).rejects.toMatchObject({ code: "RETAIL_STOCK_SOURCE_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
  });

  it("rejects mismatched net cost and prior return costs", async () => {
    await confirm();
    await RetailAfterSaleService.create(scope, returnInput(), actor);
    await RetailOrderModel.updateOne({ _id: orderId }, { totalCost: 99 });
    await expect(RetailAfterSaleService.create(scope, returnInput({ idempotencyKey: "return-2" }), actor)).rejects.toMatchObject({ code: "RETAIL_STOCK_SOURCE_CONFLICT" });
    await RetailOrderModel.updateOne({ _id: orderId }, { totalCost: 100.25 });
    await RetailAfterSaleModel.updateOne({}, { "items.0.unitCost": 99 });
    await expect(RetailAfterSaleService.create(scope, returnInput({ idempotencyKey: "return-2" }), actor)).rejects.toMatchObject({ code: "RETAIL_STOCK_SOURCE_CONFLICT" });
    expect((await balance())?.quantity).toBe(9);
  });

  it("buyback is valued at the agreed purchase amount without reversing the original sale cost", async () => {
    await confirm();
    const doc: any = await RetailAfterSaleService.create(scope, returnInput({ type: "buyback", items: [{ orderLineIndex: 0, quantity: 1, unitAmount: 75 }] }), actor);
    expect(doc.items[0].unitCost).toBe(75);
    expect((await GoodsReceiptModel.findById(doc.receiptId).lean())?.subtotal).toBe(75);
    expect((await order())?.totalCost).toBe(200.5);
  });

  it("preserves legitimate zero cost through confirmation, return and finance resolution", async () => {
    await InventoryBalanceModel.updateOne({ warehouseId }, { averageCost: 0 });
    await confirm();
    const saved = await order();
    const entries = await InventoryLedgerEntryModel.find({ direction: "out" }).lean();
    expect(saved?.totalCost).toBe(0);
    expect(resolveSaleCost(saved, saved!.items[0], 0, entries, []).cost).toBe(0);
    const doc: any = await RetailAfterSaleService.create(scope, returnInput(), actor);
    const persisted: any = await RetailAfterSaleModel.findById(doc._id).lean();
    expect(persisted.items[0].stockLedgerId).toBe(String(entries[0]._id));
    expect(resolveReturnCost(persisted, persisted.items[0], entries)).toBe(0);
    expect((await GoodsReceiptModel.findById(doc.receiptId).lean())?.subtotal).toBe(0);
  });

  it("keeps duplicate-SKU order lines tied to their exact source indexes", async () => {
    const draft = await order();
    await RetailOrderModel.updateOne({ _id: orderId }, { items: [
      { ...draft!.items[0], quantity: 1, lineTotal: 200 },
      { ...draft!.items[0], quantity: 1, lineTotal: 200 },
    ] });
    await confirm();
    const saved = await order();
    expect(saved!.items[0].stockLedgerId).not.toBe(saved!.items[1].stockLedgerId);
    await RetailAfterSaleService.create(scope, returnInput({ items: [{ orderLineIndex: 1, quantity: 1 }] }), actor);
    expect((await order())?.totalCost).toBe(100.25);
    expect((await balance())?.quantity).toBe(9);
  });

  it("finance resolves a zero-cost return even when the original sale is outside the report period", async () => {
    await InventoryBalanceModel.updateOne({ warehouseId }, { averageCost: 0 });
    await confirm();
    const doc: any = await RetailAfterSaleService.create(scope, returnInput(), actor);
    await RetailOrderModel.updateOne({ _id: orderId }, { businessDate: "2026-08-01" });
    await RetailAfterSaleModel.updateOne({ _id: doc._id }, { businessDate: "2026-09-01" });
    const report = await financeReport(scope, { from: "2026-09-01", to: "2026-09-30" });
    expect(report.lines).toHaveLength(1);
    expect(report.summary).toMatchObject({ missingCostCount: 0, revenue: -200, cost: 0, grossProfit: -200 });
  });

  it("rejects an unavailable original warehouse rather than moving returns to the new default", async () => {
    await confirm();
    await WarehouseModel.updateOne({ _id: warehouseId }, { isActive: false, isDefault: false });
    await WarehouseModel.create({ ...scope, code: "NEW", name: "New", isDefault: true, isActive: true });
    await expect(RetailAfterSaleService.create(scope, returnInput(), actor)).rejects.toThrow();
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect(await RetailAfterSaleModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(8);
  });

  it.each(["serial", "unit_barcode"] as const)("cancels the complete %s set with original warehouse and audited events", async (mode) => {
    await trackedSale(mode);
    await WarehouseModel.updateOne({ _id: warehouseId }, { isDefault: false });
    await WarehouseModel.create({ ...scope, code: "NEW", name: "New", isDefault: true, isActive: true });
    const result = await cancel();
    expect(result.status).toBe("cancelled");
    expect((await balance())?.quantity).toBe(2);
    expect(await SerialUnitModel.countDocuments({ status: "in_stock", warehouseId, currentDocumentId: result.restockReceiptId, soldOrderId: { $exists: false } })).toBe(2);
    expect(await SerialEventModel.countDocuments({ eventType: "sale_cancelled", documentId: result.restockReceiptId, actorId: actor.id })).toBe(2);
  });

  it.each([
    { status: "repairing" }, { branchId: "other" }, { warehouseId: "other" },
    { productId: "other" }, { variantId: "other" }, { sku: "OTHER" },
    { soldOrderId: "other" }, { currentDocumentId: "other" },
  ])("rejects cancellation when a sold machine changed: %j", async (patch) => {
    await trackedSale();
    await SerialUnitModel.updateOne({ serialNumber: "SN2" }, patch);
    await expect(cancel()).rejects.toMatchObject({ code: "SALE_CANCEL_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
    expect((await SerialUnitModel.findOne({ serialNumber: "SN1" }).lean())?.status).toBe("sold");
  });

  it("rejects a missing or extra linked machine instead of returning a partial set", async () => {
    await trackedSale();
    const unit = await SerialUnitModel.findOne({ serialNumber: "SN2" }).lean();
    await SerialUnitModel.deleteOne({ _id: unit!._id });
    await expect(cancel()).rejects.toMatchObject({ code: "SALE_CANCEL_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
    await SerialUnitModel.collection.insertOne(unit! as any);
    await SerialUnitModel.create({ ...unit, _id: new mongoose.Types.ObjectId(), serialNumber: "EXTRA", normalizedSerialNumber: "EXTRA", internalBarcode: "BC-EXTRA", normalizedInternalBarcode: "BC-EXTRA" });
    await expect(cancel()).rejects.toMatchObject({ code: "SALE_CANCEL_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
  });

  it.each([
    { "items.0.serialNumbers": ["SN1", "SN1"] },
    { "items.0.serialNumbers": ["SN1"] },
    { "items.0.internalBarcodes": ["BC-SN1", "WRONG"] },
  ])("rejects an incomplete or inconsistent identifier snapshot: %j", async (patch) => {
    await trackedSale();
    await RetailOrderModel.updateOne({ _id: orderId }, patch);
    await expect(cancel()).rejects.toMatchObject({ code: "SALE_CANCEL_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
  });

  it("requires the latest unit event to be the original sale", async () => {
    await trackedSale();
    const unit = await SerialUnitModel.findOne({ serialNumber: "SN2" }).lean();
    await SerialEventModel.create({ ...scope, serialUnitId: String(unit!._id), serialNumber: "SN2", eventType: "repair_returned", fromStatus: "repairing", toStatus: "sold", documentType: "repair-ticket", documentId: id(), actorId: actor.id, actorName: actor.displayName, occurredAt: new Date(Date.now() + 1000) });
    await expect(cancel()).rejects.toMatchObject({ code: "SALE_CANCEL_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
    await SerialEventModel.deleteMany({ serialUnitId: String(unit!._id) });
    await expect(cancel()).rejects.toMatchObject({ code: "SALE_CANCEL_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
  });

  it("rolls back receipt, stock, refund and unit restoration when its event fails", async () => {
    await trackedSale();
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("serial event failed"));
    await expect(cancel()).rejects.toThrow("serial event failed");
    await expectCancellationUnchanged();
    expect(await SerialUnitModel.countDocuments({ status: "sold" })).toBe(2);
  });

  it("fails the whole cancellation when a conditional unit update does not match", async () => {
    await trackedSale();
    vi.spyOn(SerialUnitModel, "findOneAndUpdate").mockResolvedValueOnce(null);
    await expect(cancel()).rejects.toMatchObject({ code: "SALE_CANCEL_SERIAL_CONFLICT" });
    await expectCancellationUnchanged();
  });

  it("two simultaneous cancellations restore the full set only once", async () => {
    await trackedSale();
    const results = await Promise.allSettled([cancel(), cancel()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect(await SerialEventModel.countDocuments({ eventType: "sale_cancelled" })).toBe(2);
    expect((await balance())?.quantity).toBe(2);
  });

  it("replays cancellation without another refund, receipt or cancellation event", async () => {
    await confirm();
    const first = await cancel();
    const retry = await cancel();
    expect(String(retry._id)).toBe(String(first._id));
    expect((await order())?.refunds).toHaveLength(1);
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect(vi.mocked(publishRetailOrderEvent).mock.calls.filter((call) => call[0] === "cancelled")).toHaveLength(1);
  });

  it.each([
    { reason: "Different" }, { expectedVersion: 2 },
    { refunds: [{ method: "cash", amount: 399 }] },
    { refunds: [{ method: "transfer", amount: 400, reference: "REF" }] },
  ])("rejects cancellation key reuse with changed payload: %j", async (extra) => {
    await confirm(); await cancel();
    await expect(cancel(extra)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
    expect((await order())?.refunds).toHaveLength(1);
  });

  it("cancellation replay checks scope, order, actor, shift and current manager authority", async () => {
    await confirm(); await cancel();
    for (const [requestScope, requestId, requestActor, shift, manager] of [
      [{ ...scope, branchId: id() }, orderId, actor, undefined, true],
      [scope, id(), actor, undefined, true],
      [scope, orderId, { ...actor, id: "other" }, undefined, true],
      [scope, orderId, actor, { _id: id() }, true],
    ] as const) {
      await expect(RetailOrderService.cancel(requestScope, requestId, cancelInput(), requestActor, shift, manager)).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    }
    await expect(RetailOrderService.cancel(scope, orderId, cancelInput(), actor, undefined, false)).rejects.toMatchObject({ status: 403 });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
  });

  it("competing cancellation keys on one version post only once", async () => {
    await confirm();
    const results = await Promise.allSettled([cancel(), cancel({ idempotencyKey: "cancel-2" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "ORDER_VERSION_CONFLICT" } });
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
  });

  it("a collection makes a stale cancellation fail before refunding", async () => {
    await debtSale(); await collect();
    await expect(cancel({ refunds: [] })).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect((await order())?.refundedAmount).toBe(0);
    await cancel({ expectedVersion: 2, refunds: [{ method: "cash", amount: 100 }] });
    expect((await order())?.refundedAmount).toBe(100);
  });

  it("draft deletion and cancellation replay result commit together", async () => {
    const input = { expectedVersion: 0, refunds: [] };
    const [first, second] = await Promise.all([cancel(input), cancel(input)]);
    expect(String(second._id)).toBe(String(first._id));
    expect(first.status).toBe("cancelled");
    expect(await order()).toBeNull();
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    expect(await RetailIdempotencyModel.countDocuments({ operation: "cancel-order", status: "completed" })).toBe(1);
  });

  it("failed draft cancellation persistence restores the draft and frees the key", async () => {
    const update = vi.spyOn(RetailIdempotencyModel, "updateOne").mockRejectedValueOnce(new Error("key failure"));
    await expect(cancel({ expectedVersion: 0, refunds: [] })).rejects.toThrow("key failure");
    update.mockRestore();
    expect((await order())?.status).toBe("draft");
    expect(await RetailIdempotencyModel.countDocuments()).toBe(0);
    await cancel({ expectedVersion: 0, refunds: [] });
    expect(await order()).toBeNull();
  });

  it.each([{ idempotencyKey: "" }, { expectedVersion: undefined }, { refunds: [] }])("rejects incomplete cancellation without stock or money changes: %j", async (extra) => {
    await confirm();
    await expect(cancel(extra)).rejects.toMatchObject({ code: "CANCELLATION_INVALID" });
    expect((await order())?.status).toBe("completed");
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
  });

  it("event failure rolls back cancellation key, invoice, refund and receipt", async () => {
    await confirm();
    vi.mocked(publishRetailOrderEvent).mockRejectedValueOnce(new Error("event failure"));
    await expect(cancel()).rejects.toThrow("event failure");
    expect(await RetailIdempotencyModel.countDocuments({ operation: "cancel-order" })).toBe(0);
    expect((await order())?.refundedAmount).toBe(0);
    expect((await RetailInvoiceModel.findOne().lean())?.status).toBe("issued");
    expect(await GoodsReceiptModel.countDocuments()).toBe(0);
    await cancel();
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
  });
});
