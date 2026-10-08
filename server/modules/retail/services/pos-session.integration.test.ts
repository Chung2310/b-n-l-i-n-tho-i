import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CashierShiftService, closeExpiredRetailPosSessions, nextVietnameseMidnight, posSessionOperationalEndsAt } from "./cashier-shift.service";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailSettingsModel } from "../models/retail-settings.model";
import { emitToCompany } from "../../../socket";
import { WarehouseModel } from "../../../model/warehouse.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { retailOrderController } from "../controllers/retail-order.controller";
vi.mock("../../../socket", () => ({ emitToCompany: vi.fn() }));

const scope = { companyCode: "POS_TEST", branchId: "branch-1" };
const actor = { id: "cashier-1", displayName: "Thu ngân" };
let repl: MongoMemoryReplSet;
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all([CashierShiftModel.init(), RetailOrderModel.init(), RetailSettingsModel.init(), WarehouseModel.init(), SerialUnitModel.init()]);
}, 120_000);
afterAll(async () => { await mongoose.disconnect(); await repl?.stop(); });
beforeEach(async () => {
  await Promise.all([CashierShiftModel.deleteMany({}), RetailOrderModel.deleteMany({}), WarehouseModel.deleteMany({}), SerialUnitModel.deleteMany({})]);
  vi.clearAllMocks();
});

it("opens manually without an employee schedule and prevents duplicate cashier/terminal sessions", async () => {
  const shift = await CashierShiftService.open(scope, { openingFloat: 100, terminalId: "t1" }, actor);
  expect(shift.status).toBe("open");
  expect(shift.operationalEndsAt).toEqual(posSessionOperationalEndsAt(shift.businessDate));
  await expect(CashierShiftService.open(scope, { openingFloat: 0, terminalId: "t2" }, actor)).rejects.toMatchObject({ code: "SHIFT_ALREADY_OPEN" });
  await expect(CashierShiftService.open(scope, { openingFloat: 0, terminalId: "t1" }, { ...actor, id: "cashier-2" })).rejects.toMatchObject({ code: "SHIFT_ALREADY_OPEN" });
  expect(await CashierShiftService.current(scope, actor, "t2")).toBeNull();
  await expect(CashierShiftService.operational(scope, actor, new Date(), "t2", String(shift._id))).rejects.toMatchObject({ code: "SHIFT_NOT_OPEN" });
});

it("manual close snapshots actual cash and broadcasts only after closing", async () => {
  const shift = await CashierShiftService.open(scope, { openingFloat: 100, terminalId: "t1" }, actor);
  const id = String(shift._id);
  await RetailOrderModel.create({ ...scope, shiftId: id, businessDate: shift.businessDate, status: "completed", items: [],
    subtotal: 250, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 250, totalCost: 0,
    salespersonId: actor.id, salespersonName: actor.displayName, createdBy: actor.id, createdByName: actor.displayName,
    payments: [{ method: "cash", amount: 250, paidAt: new Date(), receivedBy: actor.id, receivedByName: actor.displayName, shiftId: id, businessDate: shift.businessDate }],
    refunds: [{ method: "cash", amount: 50, refundedAt: new Date(), refundedBy: actor.id, refundedByName: actor.displayName, shiftId: id, businessDate: shift.businessDate, reason: "Hoàn tiền" }],
  });
  const closed = await CashierShiftService.close(scope, id, { countedCash: 300 }, actor);
  expect(closed).toMatchObject({ status: "closed", closingMode: "manual", expectedCash: 300, varianceAmount: 0 });
  expect(await CashierShiftService.current(scope, actor, "t1")).toBeNull();
  expect(emitToCompany).toHaveBeenCalledWith(scope.companyCode, "pos:session:closed", expect.objectContaining({ sessionId: id }));
});

it("concurrent midnight sweeps close once, preserve blind count, and allow one reconciliation", async () => {
  const shift = await CashierShiftService.open(scope, { openingFloat: 100, terminalId: "t1" }, actor);
  const midnight = nextVietnameseMidnight(shift.businessDate);
  vi.mocked(emitToCompany).mockClear();
  await Promise.all([closeExpiredRetailPosSessions(midnight), closeExpiredRetailPosSessions(midnight)]);
  const closed = await CashierShiftModel.findById(shift._id).lean();
  expect(closed).toMatchObject({ status: "closed", closingMode: "midnight", expectedCash: 100, closedAt: midnight });
  expect(closed?.countedCash).toBeUndefined();
  expect(vi.mocked(emitToCompany).mock.calls.filter((call) => call[1] === "pos:session:closed")).toHaveLength(1);
  const pending = await CashierShiftService.list(scope, { pendingReconciliation: "true" });
  expect(pending.total).toBe(1);
  await CashierShiftService.reconcile(scope, String(shift._id), { countedCash: 100 }, actor);
  expect((await CashierShiftService.list(scope, { pendingReconciliation: "true" })).total).toBe(0);
  await expect(CashierShiftService.reconcile(scope, String(shift._id), { countedCash: 100 }, actor)).rejects.toMatchObject({ code: "SHIFT_ALREADY_CLOSED" });
});

it("Vietnam midnight rolls over the year correctly", () => {
  expect(nextVietnameseMidnight("2026-12-31").toISOString()).toBe("2026-12-31T17:00:00.000Z");
});

it("POS serial lookup restricts stock and warehouse and strips supplier/customer data", async () => {
  const warehouse = await WarehouseModel.create({ ...scope, code: "MAIN", name: "Kho bán hàng", kind: "selling", isDefault: true, isActive: true });
  for (const [serial, status, warehouseId] of [["AVAILABLE", "in_stock", String(warehouse._id)], ["SOLD", "sold", String(warehouse._id)], ["OTHER", "in_stock", "other-warehouse"]] as const) {
    await SerialUnitModel.create({ ...scope, productId: "p1", sku: "PHONE", productName: "Điện thoại", warehouseId, serialNumber: serial, normalizedSerialNumber: serial,
      internalBarcode: serial, normalizedInternalBarcode: serial, status, createdBy: actor.id, updatedBy: actor.id,
      customerId: "private-customer", supplierWarranty: { supplierId: "private-supplier", supplierName: "Supplier", receiptId: "private-receipt" },
    });
  }
  let response: any;
  const res: any = { json: (data: any) => { response = data; }, status: (status: number) => { throw new Error(`Unexpected status ${status}`); } };
  await retailOrderController.saleSerials({ user: { ...actor, ...scope, role: "pos_cashier" }, query: { status: "sold", forSale: "false", warehouseId: "other-warehouse", productId: "p1" } } as any, res);
  expect(response.data.items).toHaveLength(1);
  expect(response.data.items[0].serialNumber).toBe("AVAILABLE");
  expect(response.data.items[0]).not.toHaveProperty("supplierWarranty");
  expect(response.data.items[0]).not.toHaveProperty("customerId");
});
