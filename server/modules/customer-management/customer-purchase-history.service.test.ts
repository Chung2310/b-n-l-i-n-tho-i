import assert from "node:assert/strict";
import { test } from "vitest";
import { CustomerError } from "./customer-errors";
import { createCustomerPurchaseHistoryService } from "./customer-purchase-history.service";

const scope = { companyCode: "IGEN" };
const customerId = "507f1f77bcf86cd799439011";

test("returns a newest-first safe purchase history and calculates only settled-order totals", async () => {
  let receivedFilter: Record<string, unknown> | undefined;
  let receivedSort: Record<string, unknown> | undefined;
  const service = createCustomerPurchaseHistoryService({
    customer: async () => ({ _id: customerId }),
    orders: async (filter, sort) => {
      receivedFilter = filter;
      receivedSort = sort;
      return [
        { _id: "draft", orderCode: "DH-3", status: "draft", businessDate: "2026-08-21", grandTotal: 900, paidAmount: 0, dueAmount: 0, items: [{ quantity: 4 }], salespersonName: "Linh", internalOnly: true },
        { _id: "complete", orderCode: "DH-2", status: "completed", businessDate: "2026-08-20", grandTotal: 300, paidAmount: 300, dueAmount: 0, items: [{ quantity: 1 }, { quantity: 2 }], salespersonName: "An" },
        { _id: "confirmed", orderCode: "DH-1", status: "confirmed", businessDate: "2026-08-19", grandTotal: 200, paidAmount: 50, dueAmount: 150, items: [{ quantity: 2 }], salespersonName: "Binh" },
        { _id: "cancelled", orderCode: "DH-0", status: "cancelled", businessDate: "2026-08-18", grandTotal: 100, paidAmount: 100, dueAmount: 0, items: [{ quantity: 1 }], salespersonName: "Cuong" },
      ];
    },
  });

  const result = await service.get(scope, customerId, "branch-a");

  assert.deepEqual(receivedFilter, { companyCode: "IGEN", branchId: "branch-a", customerId });
  assert.deepEqual(receivedSort, { businessDate: -1, _id: -1 });
  assert.deepEqual(result.summary, {
    orderCount: 4,
    purchaseCount: 4,
    repairCount: 0,
    warrantyCount: 0,
    buybackCount: 0,
    returnCount: 0,
    totalPurchased: 500,
    totalRepair: 0,
    totalBuyback: 0,
    totalRefunded: 0,
    totalPaid: 350,
    currentDebt: 150,
    lastPurchaseAt: "2026-08-20",
  });
  assert.equal(result.items.length, 4);
  assert.equal(result.items[0].orderCode, "DH-3");
  assert.equal(result.items[0].recordType, "purchase");
  assert.equal(result.items[0].grandTotal, 900);
  assert.equal(result.items[0].itemCount, 4);
  assert.equal(result.items[0].items?.[0]?.quantity, 4);
  assert.equal(result.items[1].orderCode, "DH-2");
  assert.equal(result.items[1].grandTotal, 300);
  assert.equal(result.items[1].itemCount, 3);
  assert.equal(result.items[2].orderCode, "DH-1");
  assert.equal(result.items[2].grandTotal, 200);
  assert.equal(result.items[2].dueAmount, 150);
  assert.equal(result.items[3].orderCode, "DH-0");
  assert.equal(result.items[3].grandTotal, 100);
});

test("returns unified purchase, repair, buyback and return timeline", async () => {
  const service = createCustomerPurchaseHistoryService({
    customer: async () => ({ _id: customerId }),
    orders: async () => [
      { _id: "order-1", orderCode: "DH-001", status: "completed", businessDate: "2026-08-10", grandTotal: 10_000_000, paidAmount: 10_000_000, dueAmount: 0, items: [{ quantity: 1, productName: "iPhone 14" }], salespersonName: "Thu ngân" },
    ],
    repairs: async () => [
      { _id: "rep-1", ticketCode: "SC-001", status: "done", receivedAt: new Date("2026-08-15"), totalAmount: 500_000, paidAmount: 500_000, dueAmount: 0, device: { name: "iPhone 11", serialNumber: "SN123" }, symptom: "Thay pin", technicianName: "Thợ A" },
    ],
    afterSales: async () => [
      { _id: "as-1", code: "TH-001", type: "return", status: "completed", businessDate: "2026-08-20", totalAmount: 2_000_000, items: [{ quantity: 1, productName: "Tai nghe" }], orderCode: "DH-001", reason: "Khách đổi ý", createdByName: "NV Tiếp tân" },
      { _id: "as-2", code: "TM-001", type: "buyback", status: "completed", businessDate: "2026-08-05", totalAmount: 3_000_000, items: [{ quantity: 1, productName: "Apple Watch S6" }], reason: "Thu mua máy cũ", createdByName: "NV Tiếp tân" },
    ],
  });

  const result = await service.get(scope, customerId, "branch-a");

  assert.equal(result.summary.orderCount, 4);
  assert.equal(result.summary.purchaseCount, 1);
  assert.equal(result.summary.repairCount, 1);
  assert.equal(result.summary.returnCount, 1);
  assert.equal(result.summary.buybackCount, 1);
  assert.equal(result.summary.totalPurchased, 10_000_000);
  assert.equal(result.summary.totalRepair, 500_000);
  assert.equal(result.summary.totalRefunded, 2_000_000);
  assert.equal(result.summary.totalBuyback, 3_000_000);

  // Newest first: 2026-08-20 (return) -> 2026-08-15 (repair) -> 2026-08-10 (purchase) -> 2026-08-05 (buyback)
  assert.equal(result.items[0].orderCode, "TH-001");
  assert.equal(result.items[0].recordType, "return");
  assert.equal(result.items[1].orderCode, "SC-001");
  assert.equal(result.items[1].recordType, "repair");
  assert.equal(result.items[2].orderCode, "DH-001");
  assert.equal(result.items[2].recordType, "purchase");
  assert.equal(result.items[3].orderCode, "TM-001");
  assert.equal(result.items[3].recordType, "buyback");
});

test("requires a branch and returns CUSTOMER_NOT_FOUND outside the company scope", async () => {
  const service = createCustomerPurchaseHistoryService({ customer: async () => null, orders: async () => [] });

  await assert.rejects(() => service.get(scope, customerId, ""), (error: unknown) => error instanceof CustomerError && error.code === "CUSTOMER_BRANCH_REQUIRED");
  await assert.rejects(() => service.get(scope, customerId, "branch-a"), (error: unknown) => error instanceof CustomerError && error.code === "CUSTOMER_NOT_FOUND" && error.status === 404);
});

test("rejects malformed customer IDs before repository lookup", async () => {
  let customerLookedUp = false;
  const service = createCustomerPurchaseHistoryService({
    customer: async () => { customerLookedUp = true; return null; },
    orders: async () => [],
  });

  await assert.rejects(() => service.get(scope, "not-an-object-id", "branch-a"), (error: unknown) => error instanceof CustomerError && error.code === "CUSTOMER_ID_INVALID" && error.status === 400);
  assert.equal(customerLookedUp, false);
});

test("uses company-only scope for customer lookup and branch scope only for orders", async () => {
  let customerScope: unknown;
  let orderFilter: unknown;
  const service = createCustomerPurchaseHistoryService({
    customer: async (receivedScope) => { customerScope = receivedScope; return { _id: customerId }; },
    orders: async (filter) => { orderFilter = filter; return []; },
  });

  await service.get({ companyCode: "IGEN" }, customerId, "branch-a");

  assert.deepEqual(customerScope, { companyCode: "IGEN" });
  assert.deepEqual(orderFilter, { companyCode: "IGEN", branchId: "branch-a", customerId });
});

test("returns warranty tickets and serial unit warranty items", async () => {
  const service = createCustomerPurchaseHistoryService({
    customer: async () => ({ _id: customerId }),
    orders: async () => [],
    repairs: async () => [
      {
        _id: "rep-bh-1",
        ticketCode: "BH-001",
        ticketType: "warranty",
        status: "in_progress",
        receivedAt: new Date("2026-08-22"),
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        device: { name: "iPad Air 5", serialNumber: "IPA-999" },
        symptom: "Lỗi màn hình bảo hành chính hãng",
      },
    ],
    warranties: async () => [
      {
        _id: "unit-1",
        serialNumber: "IPA-999",
        productName: "iPad Air 5 64GB",
        sku: "IPAD-AIR-5",
        status: "sold",
        soldAt: new Date("2026-01-10"),
        warrantyExpiresAt: new Date("2027-01-10"),
        orderCode: "DH-099",
      },
    ],
  });

  const result = await service.get(scope, customerId, "branch-a");

  assert.equal(result.summary.warrantyCount, 2);
  assert.equal(result.items.length, 2);

  // BH ticket
  const bhTicket = result.items.find((i) => i.recordType === "warranty" && i.orderCode === "BH-001");
  assert.ok(bhTicket);
  assert.equal(bhTicket?.typeLabel, "Bảo hành");
  assert.equal(bhTicket?.deviceInfo, "iPad Air 5 - IPA-999");

  // SerialUnit warranty
  const serialWarranty = result.items.find((i) => i.recordType === "warranty" && i.orderCode === "BH-DH-099");
  assert.ok(serialWarranty);
  assert.equal(serialWarranty?.typeLabel, "Bảo hành");
  assert.equal(serialWarranty?.status, "active");
  assert.equal(serialWarranty?.statusLabel, "Còn bảo hành");
  assert.equal(serialWarranty?.warrantyInfo?.serialNumber, "IPA-999");
});

