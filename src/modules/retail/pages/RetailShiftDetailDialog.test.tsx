// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailShiftsApi } from "../api/retailShifts.api";
import RetailShiftDetailDialog from "./RetailShiftDetailDialog";

vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { detail: vi.fn() } }));

const shift = {
  _id: "shift-1", shiftCode: "POS-B1-1", cashierId: "cashier-1", cashierName: "Lan",
  openingFloat: 100_000, businessDate: "2026-10-07", status: "closed" as const,
};
const order = {
  _id: "order-1", orderCode: "DH-001", shiftId: shift._id, status: "completed" as const,
  paymentStatus: "partial" as const, customerName: "Khách A", createdAt: "2026-10-07T02:00:00.000Z",
  items: [{ productId: "product-1", sku: "SKU-1", productName: "Áo thun", unit: "cái", quantity: 2, unitPrice: 300_000, discountAmount: 0, lineTotal: 600_000 }],
  subtotal: 600_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 600_000,
  paidAmount: 400_000, refundedAmount: 50_000, dueAmount: 200_000, version: 1, createdBy: "cashier-1", createdByName: "Lan",
  payments: [{ method: "cash" as const, amount: 400_000, shiftId: shift._id }],
  refunds: [{ method: "cash" as const, amount: 50_000, shiftId: shift._id }],
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailShiftsApi.detail).mockResolvedValue({ shift, orders: [order] });
});

describe("RetailShiftDetailDialog", () => {
  it("shows sales, product quantities, and payment and refund totals for the selected shift", async () => {
    render(<RetailShiftDetailDialog scope={{ companyCode: "ACME", branchId: "B1" }} shift={shift} onClose={vi.fn()} />);

    expect(await screen.findByText("1 đơn bán trong phiên")).toBeTruthy();
    expect(screen.getAllByText("600.000 ₫").length).toBeGreaterThan(0);
    expect(screen.getByText("Áo thun")).toBeTruthy();
    expect(screen.getByText("SKU-1")).toBeTruthy();
    expect(screen.getAllByText("Tiền mặt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("400.000 ₫").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50.000 ₫").length).toBeGreaterThan(0);
    expect(screen.getByText("DH-001")).toBeTruthy();
    expect(screen.getByText("Khách A")).toBeTruthy();
  });

  it("excludes cancelled orders from sales and product totals", async () => {
    vi.mocked(retailShiftsApi.detail).mockResolvedValue({
      shift,
      orders: [order, {
        ...order, _id: "order-cancelled", orderCode: "DH-002", status: "cancelled", grandTotal: 900_000,
        items: [{ ...order.items[0], productName: "Hàng đã hủy", sku: "SKU-X", quantity: 3, lineTotal: 900_000 }],
        payments: [], refunds: [],
      }],
    });
    render(<RetailShiftDetailDialog scope={{ companyCode: "ACME", branchId: "B1" }} shift={shift} onClose={vi.fn()} />);

    expect(await screen.findByText("1 đơn bán trong phiên")).toBeTruthy();
    expect(screen.queryByText("Hàng đã hủy")).toBeNull();
    expect(screen.getAllByText("600.000 ₫").length).toBeGreaterThan(0);
  });
});
