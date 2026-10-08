// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailShiftsApi } from "../api/retailShifts.api";
import RetailShiftWorkspace from "./RetailShiftWorkspace";

vi.mock("../hooks/useRetailScope", () => ({
  useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" } }),
}));
vi.mock("../../../services/socketService", () => ({
  socketService: {
    on: vi.fn(() => vi.fn()),
    onStatusChange: vi.fn(() => vi.fn()),
  },
}));
vi.mock("../api/retailShifts.api", () => ({
  retailShiftsApi: {
    current: vi.fn(), list: vi.fn(), detail: vi.fn(), open: vi.fn(), close: vi.fn(), reconcile: vi.fn(),
  },
}));

const shift = {
  _id: "shift-1", shiftCode: "POS-B1-1", cashierId: "cashier-1", cashierName: "Lan",
  openingFloat: 100_000, businessDate: "2026-10-07", status: "closed" as const,
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailShiftsApi.current).mockResolvedValue(null);
  vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [shift], total: 1, page: 1, limit: 20 });
  vi.mocked(retailShiftsApi.detail).mockResolvedValue({
    shift,
    orders: [{
      _id: "order-1", orderCode: "DH-001", shiftId: shift._id, status: "completed", paymentStatus: "paid",
      items: [{ productId: "product-1", sku: "SKU-1", productName: "Áo thun", unit: "cái", quantity: 1, unitPrice: 250_000, discountAmount: 0, lineTotal: 250_000 }],
      subtotal: 250_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 250_000,
      paidAmount: 250_000, dueAmount: 0, version: 1, createdBy: "cashier-1", createdByName: "Lan",
      payments: [{ method: "transfer", amount: 250_000, shiftId: shift._id }],
    }],
  });
});

describe("RetailShiftWorkspace session details", () => {
  it("opens an employee session detail from the history list", async () => {
    render(<RetailShiftWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));

    expect(await screen.findByRole("dialog", { name: "Chi tiết phiên POS-B1-1" })).toBeTruthy();
    expect(screen.getByText("Áo thun")).toBeTruthy();
    expect(screen.getAllByText("Chuyển khoản").length).toBeGreaterThan(0);
    expect(retailShiftsApi.detail).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "shift-1");
  });
});
