import { RepairPartRequestModel } from "../repair/repair-part-request.model";
vi.mock("../repair/services/repair-notify.service", () => ({ dispatchRepairNotification: async () => undefined }));
vi.mock("../repair/services/repair-events", () => ({ publishRepairTicketEvent: async () => undefined }));
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BranchModel } from "../../model/branch.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductCatalogLegacyMappingModel } from "../../model/product-catalog-legacy-mapping.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../model/stock-log.model";
import { RepairPartModel } from "../repair/repair-part.model";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { revokeRepairPartRequest, reconcileRepairPart, issueRepairPart, returnRepairPart } from "../repair/repair-part.service";
import { cancelRepairTicket, transitionRepairTicket } from "../repair/repair-ticket.service";

const id = () => new mongoose.Types.ObjectId().toString();
const branchId = id(), warehouseId = id(), productId = id(), variantId = id(), ticketId = id();
const scope = { companyCode: "REPAIRSTOCK", branchId };
const actor = { id: "technician", name: "Technician" };
const input = (extra: any = {}) => ({ productId, sku: "PART", productName: "Part", quantity: 1, unitCost: 999, unitPrice: 200, idempotencyKey: "part-1", ...extra });
const models = [RepairPartRequestModel, BranchModel, WarehouseModel, ProductCatalogModel, ProductVariantModel, ProductCatalogLegacyMappingModel, InventoryBalanceModel, InventoryLedgerEntryModel, StockLogModel, RepairPartModel, RepairTicketModel];
let replica: MongoMemoryReplSet;
const balance = () => InventoryBalanceModel.findOne({ warehouseId, variantId }).lean();
const ticket = () => RepairTicketModel.findById(ticketId).lean();
const issue = (extra: any = {}) => issueRepairPart(scope, ticketId, input(extra), actor);

describe("repair stock and source documents commit together", () => {
  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replica.getUri());
    await Promise.all(models.map((model: any) => model.init()));
  }, 60000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(models.map((model: any) => model.deleteMany({})));
    await BranchModel.create({ _id: branchId, companyCode: scope.companyCode, code: "MAIN", name: "Main", isActive: true });
    await WarehouseModel.create({ _id: warehouseId, ...scope, code: "MAIN", name: "Main", isDefault: true, isActive: true });
    await ProductCatalogModel.create({ _id: productId, companyCode: scope.companyCode, productCode: "PART", name: "Part", normalizedName: "part", productType: "physical", categoryCode: "PART", baseUnitCode: "PCS", status: "active", createdBy: actor.id, updatedBy: actor.id });
    await ProductVariantModel.create({ _id: variantId, companyCode: scope.companyCode, productId, sku: "PART", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: actor.id, updatedBy: actor.id });
    await InventoryBalanceModel.create({ ...scope, warehouseId, productId, variantId, sku: "PART", quantity: 10, reservedQuantity: 0, averageCost: 100, version: 0 });
    await RepairTicketModel.create({ _id: ticketId, ...scope, ticketCode: "SC-1", customerId: "KH-1", customerName: "Customer", customerPhone: "0901234567", device: { name: "Phone", condition: "Broken" }, coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: new Date() }, symptom: "Screen", status: "approved", receivedAt: new Date(), createdBy: actor.id, createdByName: actor.name });
  });
  afterAll(async () => { vi.restoreAllMocks(); await mongoose.disconnect(); await replica?.stop(); });

  it("freezes actual inventory cost and keeps ticket amounts aligned", async () => {
    const part: any = await issue({ quantity: 2 });
    expect(part.unitCost).toBe(100);
    expect(part.warehouseId).toBe(warehouseId);
    expect(part.variantId).toBe(variantId);
    expect(part.issueLedgerId).toBeTruthy();
    expect((await balance())?.quantity).toBe(8);
    expect(await ticket()).toMatchObject({ partCost: 200, partRevenue: 400, totalAmount: 400, dueAmount: 400 });
  });

  it("rolls back ledger, balance and part if ticket amount persistence fails", async () => {
    vi.spyOn(RepairTicketModel.prototype, "save").mockRejectedValueOnce(new Error("ticket save failed"));
    await expect(issue()).rejects.toThrow("ticket save failed");
    expect((await balance())?.quantity).toBe(10);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await StockLogModel.countDocuments()).toBe(0);
    expect(await RepairPartModel.countDocuments()).toBe(0);
    expect((await ticket())?.partsVersion).toBe(0);
  });

  it("rolls back stock when part persistence fails", async () => {
    vi.spyOn(RepairPartModel, "create").mockRejectedValueOnce(new Error("part save failed"));
    await expect(issue()).rejects.toThrow("part save failed");
    expect((await balance())?.quantity).toBe(10);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });

  it("coalesces concurrent retries and rejects payload or scope reuse", async () => {
    const parts = await Promise.all([issue(), issue()]);
    expect(String(parts[0]._id)).toBe(String(parts[1]._id));
    expect(await RepairPartModel.countDocuments()).toBe(1);
    expect((await balance())?.quantity).toBe(9);
    await expect(issue({ quantity: 2 })).rejects.toMatchObject({ statusCode: 409 });
    await expect(issueRepairPart({ ...scope, branchId: id() }, ticketId, input(), actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(issueRepairPart(scope, id(), input(), actor)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("serializes concurrent parts so totals include both", async () => {
    await Promise.all([issue(), issue({ idempotencyKey: "part-2", quantity: 2 })]);
    expect((await balance())?.quantity).toBe(7);
    expect(await ticket()).toMatchObject({ partCost: 300, partRevenue: 600, totalAmount: 600 });
  });

  it("serializes free manual parts and cancellation without orphaning an issue", async () => {
    await Promise.all([issue({ manual: true, unitCost: 0, unitPrice: 0 }), issue({ manual: true, unitCost: 0, unitPrice: 0, idempotencyKey: "free-2" })]);
    expect((await ticket())?.partsVersion).toBe(2);
    const results = await Promise.allSettled([issue({ idempotencyKey: "race" }), cancelRepairTicket(scope, ticketId, "Cancelled", actor)]);
    expect(results[1].status).toBe("fulfilled");
    expect((await ticket())?.status).toBe("cancelled");
    expect(await RepairPartModel.countDocuments({ status: "issued" })).toBe(0);
    expect((await balance())?.quantity).toBe(10);
  });

  it("rejects orphaned historical stock replay instead of creating a new part", async () => {
    await issue();
    await RepairPartModel.deleteMany({});
    await expect(issue()).rejects.toMatchObject({ statusCode: 409 });
    expect((await balance())?.quantity).toBe(9);
    expect(await RepairPartModel.countDocuments()).toBe(0);
  });

  it("returns at original cost and warehouse despite a changed default and average", async () => {
    const part: any = await issue({ quantity: 2 });
    await InventoryBalanceModel.updateOne({ warehouseId }, { averageCost: 300 });
    await WarehouseModel.updateOne({ _id: warehouseId }, { isDefault: false });
    await WarehouseModel.create({ ...scope, code: "NEW", name: "New", isDefault: true, isActive: true });
    await returnRepairPart(scope, ticketId, String(part._id), "Unused", actor);
    expect(await balance()).toMatchObject({ quantity: 10, averageCost: 260 });
    const entry = await InventoryLedgerEntryModel.findOne({ direction: "in" }).lean();
    expect(entry).toMatchObject({ warehouseId, unitCost: 100, quantity: 2 });
    expect(await ticket()).toMatchObject({ partCost: 0, totalAmount: 0 });
    expect(await RepairPartModel.findById(part._id).lean()).toMatchObject({ status: "returned", updatedBy: actor.id });
  });

  it("rolls back a return if part status fails to save", async () => {
    const part: any = await issue();
    vi.spyOn(RepairPartModel.prototype, "save").mockRejectedValueOnce(new Error("return save failed"));
    await expect(returnRepairPart(scope, ticketId, String(part._id), "Unused", actor)).rejects.toThrow("return save failed");
    expect((await balance())?.quantity).toBe(9);
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(0);
    expect((await RepairPartModel.findById(part._id).lean())?.status).toBe("issued");
    expect((await ticket())?.partCost).toBe(100);
  });

  it("replays same-reason concurrent returns without adding stock twice", async () => {
    const part: any = await issue();
    await Promise.all([1, 2].map(() => returnRepairPart(scope, ticketId, String(part._id), "Unused", actor)));
    expect((await balance())?.quantity).toBe(10);
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(1);
    await expect(returnRepairPart(scope, ticketId, String(part._id), "Other", actor)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("fails closed on historical missing or mismatched source ledgers", async () => {
    const part: any = await issue();
    await InventoryLedgerEntryModel.updateOne({ direction: "out" }, { quantity: 2 });
    await expect(returnRepairPart(scope, ticketId, String(part._id), "Unused", actor)).rejects.toMatchObject({ statusCode: 409 });
    await InventoryLedgerEntryModel.deleteMany({});
    await expect(returnRepairPart(scope, ticketId, String(part._id), "Unused", actor)).rejects.toMatchObject({ statusCode: 409 });
    expect((await balance())?.quantity).toBe(9);
  });

  it("cancels all parts and the ticket atomically, and safely retries cancellation", async () => {
    await issue();
    await issue({ idempotencyKey: "part-2", quantity: 2 });
    const result = await cancelRepairTicket(scope, ticketId, "Cancelled", actor);
    expect(result).toMatchObject({ status: "cancelled", partCost: 0, totalAmount: 0 });
    expect((await balance())?.quantity).toBe(10);
    await cancelRepairTicket(scope, ticketId, "Cancelled", actor);
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(2);
  });

  it("rolls back the entire cancellation if the second return cannot be reconciled", async () => {
    await issue();
    await issue({ idempotencyKey: "part-2" });
    // Cancellation returns newest first, so break the older part after the first return succeeds.
    await InventoryLedgerEntryModel.deleteOne({ idempotencyKey: "part-1" });
    await expect(cancelRepairTicket(scope, ticketId, "Cancelled", actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await ticket()).toMatchObject({ status: "approved", partCost: 200 });
    expect((await balance())?.quantity).toBe(8);
    expect(await RepairPartModel.countDocuments({ status: "issued" })).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(0);
  });

  it("keeps manual warranty parts out of stock and preserves an approved quote", async () => {
    await RepairTicketModel.updateOne({ _id: ticketId }, { quotedAmount: 500, customerApprovedAt: new Date() });
    const part: any = await issue({ manual: true, billing: "warranty_shop", unitCost: 50 });
    expect(await ticket()).toMatchObject({ partCost: 50, partRevenue: 0, totalAmount: 500 });
    await returnRepairPart(scope, ticketId, String(part._id), "Unused", actor);
    expect(await ticket()).toMatchObject({ partCost: 0, totalAmount: 500 });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(10);
  });

  it("routes generic cancellation through the same stock transaction", async () => {
    await issue();
    await transitionRepairTicket(scope, ticketId, "cancelled", actor, "Cancelled");
    expect((await balance())?.quantity).toBe(10);
    expect(await RepairPartModel.countDocuments({ status: "issued" })).toBe(0);
  });

  it("does not report an old incomplete cancellation as a successful retry", async () => {
    await issue();
    await RepairTicketModel.updateOne({ _id: ticketId }, { status: "cancelled", statusHistory: [{ to: "cancelled", note: "Cancelled", at: new Date(), by: actor.id, byName: actor.name }] });
    await expect(cancelRepairTicket(scope, ticketId, "Cancelled", actor)).rejects.toMatchObject({ statusCode: 409 });
    expect((await balance())?.quantity).toBe(9);
  });

  it("validates tracking, SKU, scope and stock before accepting a part", async () => {
    await expect(issue({ sku: "WRONG" })).rejects.toThrow();
    await expect(issue({ quantity: 11 })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(issue({ serialNumbers: ["IMEI"] })).rejects.toMatchObject({ statusCode: 400 });
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await expect(issue()).rejects.toMatchObject({ statusCode: 409 });
    expect(await RepairPartModel.countDocuments()).toBe(0);
    expect((await balance())?.quantity).toBe(10);
  });

  it("uses explicit scoped legacy mappings without mixing product identifiers", async () => {
    const legacyProductId = id();
    await ProductCatalogLegacyMappingModel.create({ companyCode: scope.companyCode, legacyProductId, legacyBranchId: branchId, productId, variantId, migratedAt: new Date(), createdBy: actor.id, updatedBy: actor.id });
    const part: any = await issue({ productId: legacyProductId });
    expect(part.productId).toBe(productId);
    expect(part.variantId).toBe(variantId);
    await ProductCatalogLegacyMappingModel.updateOne({ legacyProductId }, { legacyBranchId: id() });
    await expect(issue({ productId: legacyProductId, idempotencyKey: "another" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each(["done", "delivered", "returned", "cancelled"])("rejects direct part returns on %s tickets without changing stock or amounts", async status => {
    const part: any = await issue();
    await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { status } });
    const before = await ticket();
    await expect(returnRepairPart(scope, ticketId, String(part._id), "Unused", actor)).rejects.toMatchObject({ code: "REPAIR_PART_RETURN_STATE" });
    expect(await ticket()).toEqual(before); expect((await balance())?.quantity).toBe(9);
    expect(await RepairPartModel.findById(part._id).lean()).toMatchObject({ status: "issued" });
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(0);
  });
  it("rolls back a return that would lower the total below money already collected", async () => {
    const part: any = await issue();
    await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { status: "repairing", paidAmount: 150, dueAmount: 50 } });
    await expect(returnRepairPart(scope, ticketId, String(part._id), "Unused", actor)).rejects.toMatchObject({ code: "REPAIR_AMOUNT_CONFLICT" });
    expect(await ticket()).toMatchObject({ totalAmount: 200, paidAmount: 150, dueAmount: 50, partCost: 100 });
    expect((await balance())?.quantity).toBe(9);
    expect(await RepairPartModel.findById(part._id).lean()).toMatchObject({ status: "issued" });
    expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(0);
  });
  it("allows an earlier part-return replay after the ticket was completed", async () => {
    const part: any = await issue(); await returnRepairPart(scope, ticketId, String(part._id), "Unused", actor);
    await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { status: "done" } });
    await returnRepairPart(scope, ticketId, String(part._id), "Unused", actor);
    expect((await balance())?.quantity).toBe(10); expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(1);
  });
  it("serializes a part return against repair completion", async () => {
    const part: any = await issue(); await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { status: "repairing" } });
    const results = await Promise.allSettled([returnRepairPart(scope, ticketId, String(part._id), "Unused", actor), transitionRepairTicket(scope, ticketId, "done", actor)]);
    expect(results[1].status).toBe("fulfilled"); const returned = results[0].status === "fulfilled";
    expect(await ticket()).toMatchObject({ status: "done", totalAmount: returned ? 0 : 200, dueAmount: returned ? 0 : 200 });
    expect((await balance())?.quantity).toBe(returned ? 10 : 9);
  });

  it("reconciles issue and return read-only after closure", async () => {
    const req = { kind: "issue" as const, input: input() };
    expect((await reconcileRepairPart(scope, ticketId, req, actor)).status).toBe("not_found");
    const part: any = await issue();
    expect((await reconcileRepairPart(scope, ticketId, req, actor)).status).toBe("completed");
    const ret = { kind: "return" as const, partId: String(part._id), reason: "unused" };
    expect((await reconcileRepairPart(scope, ticketId, ret, actor)).status).toBe("not_found");
    await returnRepairPart(scope, ticketId, String(part._id), "unused", actor);
    await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { status: "done" } });
    const before = { ticket: await ticket(), balance: await balance(), parts: await RepairPartModel.find().lean(), ledger: await InventoryLedgerEntryModel.find().lean() };
    expect((await reconcileRepairPart(scope, ticketId, req, actor)).status).toBe("completed");
    expect((await reconcileRepairPart(scope, ticketId, ret, actor)).status).toBe("completed");
    expect({ ticket: await ticket(), balance: await balance(), parts: await RepairPartModel.find().lean(), ledger: await InventoryLedgerEntryModel.find().lean() }).toEqual(before);
  });
  it("binds issue and return retries to the recorded actor", async () => {
    const part: any = await issue(); const other = { ...actor, id: "other" };
    await expect(issueRepairPart(scope, ticketId, input(), other)).rejects.toMatchObject({ statusCode: 409 });
    await expect(reconcileRepairPart(scope, ticketId, { kind: "issue", input: input() }, other)).rejects.toMatchObject({ statusCode: 409 });
    await returnRepairPart(scope, ticketId, String(part._id), "unused", actor);
    await expect(returnRepairPart(scope, ticketId, String(part._id), "unused", other)).rejects.toMatchObject({ statusCode: 409 });
    await expect(reconcileRepairPart(scope, ticketId, { kind: "return", partId: String(part._id), reason: "unused" }, other)).rejects.toMatchObject({ statusCode: 409 });
    expect((await balance())?.quantity).toBe(10);
  });
  it.each(["missing", "cost", "quantity", "price"])("does not confirm damaged %s issue evidence", async changed => {
    await issue();
    if (changed === "missing") await InventoryLedgerEntryModel.deleteMany({});
    if (changed === "cost") await InventoryLedgerEntryModel.updateMany({}, { $set: { unitCost: 1 } });
    if (changed === "quantity") await RepairPartModel.updateMany({}, { $set: { quantity: 2 } });
    if (changed === "price") await RepairPartModel.updateMany({}, { $set: { unitPrice: 1 } });
    expect((await reconcileRepairPart(scope, ticketId, { kind: "issue", input: input() }, actor)).status).toBe("conflict");
  });
  it("does not confirm missing return ledger or changed reason", async () => {
    const part: any = await issue(); await returnRepairPart(scope, ticketId, String(part._id), "unused", actor);
    const req = { kind: "return" as const, partId: String(part._id), reason: "unused" };
    await expect(reconcileRepairPart(scope, ticketId, { ...req, reason: "different" }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await InventoryLedgerEntryModel.deleteMany({ direction: "in" });
    expect((await reconcileRepairPart(scope, ticketId, req, actor)).status).toBe("conflict");
  });
  it("keeps reconciliation inside company and branch", async () => {
    await issue();
    for (const wrong of [{ ...scope, branchId: id() }, { ...scope, companyCode: "OTHER" }]) await expect(reconcileRepairPart(wrong, ticketId, { kind: "issue", input: input() }, actor)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("reconciles manual parts without inventing warehouse entries", async () => {
    const data = input({ manual: true }); const part: any = await issueRepairPart(scope, ticketId, data, actor);
    expect((await reconcileRepairPart(scope, ticketId, { kind: "issue", input: data }, actor)).status).toBe("completed");
    await returnRepairPart(scope, ticketId, String(part._id), "unused", actor);
    expect((await reconcileRepairPart(scope, ticketId, { kind: "return", partId: String(part._id), reason: "unused" }, actor)).status).toBe("completed");
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });

  const revokeIssue = (extra: any = {}) => revokeRepairPartRequest(scope, ticketId, { kind: "issue", input: input(extra) }, actor);
  it("revokes a missing issue without touching stock and permits a new key", async () => {
    const before = { ticket: await ticket(), balance: await balance() };
    expect((await revokeIssue()).status).toBe("revoked"); expect((await revokeIssue()).status).toBe("revoked");
    expect((await reconcileRepairPart(scope, ticketId, { kind: "issue", input: input() }, actor)).status).toBe("revoked");
    await expect(issue()).rejects.toMatchObject({ code: "REPAIR_PART_REQUEST_REVOKED" });
    expect({ ticket: await ticket(), balance: await balance() }).toEqual(before);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0); expect(await RepairPartModel.countDocuments()).toBe(0);
    await issue({ idempotencyKey: "replacement" }); expect((await balance())?.quantity).toBe(9);
  });
  it("revokes legacy returns, then accepts a corrected keyed return exactly once", async () => {
    const part: any = await issue(); const partId = String(part._id);
    const request = { kind: "return" as const, partId, reason: "wrong" };
    expect((await revokeRepairPartRequest(scope, ticketId, request, actor)).status).toBe("revoked");
    await expect(returnRepairPart(scope, ticketId, partId, "wrong", actor)).rejects.toMatchObject({ code: "REPAIR_PART_REQUEST_REVOKED" });
    expect((await balance())?.quantity).toBe(9);
    await returnRepairPart(scope, ticketId, partId, "corrected", actor, undefined, "new-key");
    await returnRepairPart(scope, ticketId, partId, "corrected", actor, undefined, "new-key");
    expect((await reconcileRepairPart(scope, ticketId, { kind: "return", partId, reason: "corrected", idempotencyKey: "new-key" }, actor)).status).toBe("completed");
    expect((await reconcileRepairPart(scope, ticketId, request, actor)).status).toBe("revoked");
    expect((await balance())?.quantity).toBe(10); expect(await InventoryLedgerEntryModel.countDocuments({ direction: "in" })).toBe(1);
  });
  it("does not let revoking a user return block cancellation's own return", async () => {
    const part: any = await issue();
    await revokeRepairPartRequest(scope, ticketId, { kind: "return", partId: String(part._id), reason: "wrong" }, actor);
    await cancelRepairTicket(scope, ticketId, "cancel", actor);
    expect((await balance())?.quantity).toBe(10); expect((await ticket())?.status).toBe("cancelled");
  });
  it.each(["issue", "return"])("does not reverse an already completed %s", async kind => {
    const part: any = await issue(); const partId = String(part._id);
    if (kind === "return") await returnRepairPart(scope, ticketId, partId, "unused", actor, undefined, "r1");
    const before = { ticket: await ticket(), balance: await balance(), parts: await RepairPartModel.find().lean(), ledger: await InventoryLedgerEntryModel.find().lean() };
    const request: any = kind === "issue" ? { kind, input: input() } : { kind, partId, reason: "unused", idempotencyKey: "r1" };
    expect((await revokeRepairPartRequest(scope, ticketId, request, actor)).status).toBe("completed");
    expect({ ticket: await ticket(), balance: await balance(), parts: await RepairPartModel.find().lean(), ledger: await InventoryLedgerEntryModel.find().lean() }).toEqual(before);
  });
  it.each(["payload", "actor", "scope"])("keeps revocation bound to its original %s", async changed => {
    await revokeIssue();
    await expect(revokeRepairPartRequest(changed === "scope" ? { ...scope, branchId: id() } : scope, ticketId, { kind: "issue", input: input(changed === "payload" ? { quantity: 2 } : {}) }, changed === "actor" ? { ...actor, id: "other" } : actor)).rejects.toMatchObject({ statusCode: changed === "scope" ? 404 : 409 });
    expect(await RepairPartRequestModel.countDocuments()).toBe(1);
  });
  it("rolls back a failed revocation and accepts the original issue", async () => {
    vi.spyOn(RepairPartRequestModel.prototype, "save").mockRejectedValueOnce(new Error("injected"));
    await expect(revokeIssue()).rejects.toThrow("injected"); expect(await RepairPartRequestModel.countDocuments()).toBe(0);
    await issue(); expect((await balance())?.quantity).toBe(9);
  });
  it("does not poison a legacy issue key on mismatched revocation", async () => {
    await issue(); await RepairPartRequestModel.deleteMany({});
    await expect(revokeIssue({ quantity: 2 })).rejects.toMatchObject({ statusCode: 409 });
    expect(await RepairPartRequestModel.countDocuments()).toBe(0); expect((await revokeIssue()).status).toBe("completed");
  });
  it.each(["issue", "return"])("refuses to revoke orphaned %s stock evidence", async kind => {
    const part: any = await issue(); const partId = String(part._id);
    if (kind === "issue") await RepairPartModel.deleteMany({});
    else { await returnRepairPart(scope, ticketId, partId, "unused", actor); await RepairPartModel.updateOne({ _id: partId }, { $set: { status: "issued" } }); }
    await RepairPartRequestModel.deleteMany({});
    await expect(revokeRepairPartRequest(scope, ticketId, kind === "issue" ? { kind, input: input() } : { kind: "return", partId, reason: "unused" }, actor)).rejects.toMatchObject({ code: "REPAIR_PART_REQUEST_CONFLICT" });
    expect(await RepairPartRequestModel.countDocuments()).toBe(0);
  });
  it("requires an active caller transaction", async () => {
    const session = await mongoose.startSession();
    try { await expect(revokeRepairPartRequest(scope, ticketId, { kind: "issue", input: input() }, actor, session)).rejects.toMatchObject({ statusCode: 503 }); }
    finally { await session.endSession(); }
    expect(await RepairPartRequestModel.countDocuments()).toBe(0);
  });
  it.each([ ["issue", "post"], ["issue", "revoke"], ["return", "post"], ["return", "revoke"] ])("serializes %s with delayed %s", async (kind, delayed) => {
    const partId = kind === "return" ? String((await issue() as any)._id) : "";
    const request: any = kind === "issue" ? { kind, input: input() } : { kind, partId, reason: "unused", idempotencyKey: "r1" };
    const post = () => kind === "issue" ? issue() : returnRepairPart(scope, ticketId, partId, "unused", actor, undefined, "r1");
    const revoke = () => revokeRepairPartRequest(scope, ticketId, request, actor);
    const original = RepairPartRequestModel.findOneAndUpdate.bind(RepairPartRequestModel);
    let entered!: () => void, release!: () => void;
    const reached = new Promise<void>(resolve => { entered = resolve; }), pause = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(RepairPartRequestModel, "findOneAndUpdate").mockImplementationOnce((async (...args: any[]) => { entered(); await pause; return (original as any)(...args); }) as any);
    const pending = (delayed === "post" ? post() : revoke()).then(value => ({ value, error: null as any }), error => ({ value: null, error }));
    await reached; try { await (delayed === "post" ? revoke() : post()); } finally { release(); }
    const result = await pending;
    if (delayed === "post") expect(result.error).toMatchObject({ code: "REPAIR_PART_REQUEST_REVOKED" });
    else { expect(result.error).toBeNull(); expect(result.value).toMatchObject({ status: "completed" }); }
    expect((await balance())?.quantity).toBe(kind === "issue" ? delayed === "post" ? 10 : 9 : delayed === "post" ? 9 : 10);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(kind === "issue" ? delayed === "post" ? 0 : 1 : delayed === "post" ? 1 : 2);
  });
});
