// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "../customerApi";
import CustomerPurchaseHistoryPanel from "./CustomerPurchaseHistoryPanel";

vi.mock("../customerApi", () => ({ customerApi: { purchaseHistory: vi.fn() } }));

const history = {
  summary: { orderCount: 2, totalPurchased: 150000, totalPaid: 120000, currentDebt: 30000, lastPurchaseAt: "2026-08-20T00:00:00.000Z" },
  items: [{ _id: "order123", orderCode: "SO-001", status: "confirmed", businessDate: "2026-08-20T00:00:00.000Z", grandTotal: 150000, paidAmount: 120000, dueAmount: 30000, itemCount: 3, salespersonName: "Minh" }],
};

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("CustomerPurchaseHistoryPanel", () => {
  it("asks for a branch without requesting history", () => {
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" />);

    expect(screen.getByText("Vui lòng chọn chi nhánh để xem lịch sử mua hàng.")).toBeTruthy();
    expect(customerApi.purchaseHistory).not.toHaveBeenCalled();
  });

  it("shows loading then branch-scoped summary and orders", async () => {
    let resolveHistory!: (value: typeof history) => void;
    vi.mocked(customerApi.purchaseHistory).mockReturnValueOnce(new Promise((resolve) => { resolveHistory = resolve; }));
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(screen.getByText("Đang tải lịch sử mua hàng...")).toBeTruthy();
    expect(customerApi.purchaseHistory).toHaveBeenCalledWith("c1", { companyCode: "IGEN", branchId: "B1" });
    resolveHistory(history);

    await waitFor(() => expect(screen.getByText("Số đơn")).toBeTruthy());
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("Tổng đã mua")).toBeTruthy();
    expect(screen.getAllByText(/150\.000\s*₫/).length).toBeGreaterThan(0);
    expect(screen.getByText("SO-001")).toBeTruthy();
    expect(screen.getByText(/Đã xác nhận/)).toBeTruthy();
    expect(screen.getByText(/3 sản phẩm/)).toBeTruthy();
    expect(screen.getByText(/Nhân viên: Minh/)).toBeTruthy();
  });

  it("shows all transaction types (mua hàng, sửa chữa, bán lại, đổi trả) with correct badges", async () => {
    const multiHistory = {
      summary: { orderCount: 4, purchaseCount: 1, repairCount: 1, buybackCount: 1, returnCount: 1, totalPurchased: 10000000, totalRepair: 500000, totalPaid: 10500000, currentDebt: 0 },
      items: [
        { _id: "1", orderCode: "DH-001", recordType: "purchase" as const, typeLabel: "Mua hàng", status: "completed", grandTotal: 10000000, paidAmount: 10000000, dueAmount: 0, itemCount: 1, salespersonName: "Minh" },
        { _id: "2", orderCode: "SC-001", recordType: "repair" as const, typeLabel: "Sửa chữa", status: "done", grandTotal: 500000, paidAmount: 500000, dueAmount: 0, itemCount: 1, salespersonName: "Thợ A", description: "iPhone 11 - Thay pin" },
        { _id: "3", orderCode: "TM-001", recordType: "buyback" as const, typeLabel: "Bán lại / Thu mua", status: "completed", grandTotal: 3000000, paidAmount: 3000000, dueAmount: 0, itemCount: 1, salespersonName: "Tiếp tân", description: "Thu mua iPhone X" },
        { _id: "4", orderCode: "TH-001", recordType: "return" as const, typeLabel: "Đổi trả hàng", status: "completed", grandTotal: 2000000, paidAmount: 2000000, dueAmount: 0, itemCount: 1, salespersonName: "Tiếp tân", description: "Đổi trả tai nghe" },
      ],
    };
    vi.mocked(customerApi.purchaseHistory).mockResolvedValueOnce(multiHistory);
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(await screen.findByText("DH-001")).toBeTruthy();
    expect(screen.getByText("SC-001")).toBeTruthy();
    expect(screen.getByText("TM-001")).toBeTruthy();
    expect(screen.getByText("TH-001")).toBeTruthy();

    expect(screen.getAllByText("Mua hàng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sửa chữa").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bán lại/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Đổi trả/).length).toBeGreaterThan(0);
  });

  it("opens order detail modal when clicking row or detail button and closes when clicking close", async () => {
    const detailHistory = {
      summary: { orderCount: 1, totalPurchased: 25000000, totalPaid: 20000000, currentDebt: 5000000 },
      items: [
        {
          _id: "order-999",
          orderCode: "DH-999",
          recordType: "purchase" as const,
          typeLabel: "Mua hàng",
          status: "confirmed",
          businessDate: "2026-09-01",
          grandTotal: 25000000,
          paidAmount: 20000000,
          dueAmount: 5000000,
          itemCount: 1,
          salespersonName: "Nguyen Van A",
          customerName: "Tran Thi B",
          customerPhone: "0987654321",
          items: [
            {
              sku: "IP15PM",
              productName: "iPhone 15 Pro Max 256GB",
              quantity: 1,
              unitPrice: 25000000,
              lineTotal: 25000000,
              serialNumbers: ["SN-123456789"],
            },
          ],
          payments: [
            { method: "transfer", amount: 20000000, reference: "BANK123" },
          ],
        },
      ],
    };
    vi.mocked(customerApi.purchaseHistory).mockResolvedValueOnce(detailHistory);
    const { fireEvent } = await import("@testing-library/react");
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(await screen.findByText("DH-999")).toBeTruthy();

    // Click "Chi tiết" button
    const detailBtn = screen.getByRole("button", { name: /Chi tiết/ });
    fireEvent.click(detailBtn);

    // Modal is opened
    expect(await screen.findByText("iPhone 15 Pro Max 256GB")).toBeTruthy();
    expect(screen.getByText("SN-123456789")).toBeTruthy();
    expect(screen.getByText("Tran Thi B")).toBeTruthy();
    expect(screen.getByText("0987654321")).toBeTruthy();
    expect(screen.getByText("Nguyen Van A")).toBeTruthy();
    expect(screen.getByText(/BANK123/)).toBeTruthy();

    // Close modal
    const closeBtn = screen.getAllByRole("button", { name: "Đóng" })[0];
    fireEvent.click(closeBtn);

    // Modal is closed
    await waitFor(() => {
      expect(screen.queryByText("SN-123456789")).toBeNull();
    });
  });

  it("opens repair detail modal showing device and symptom", async () => {
    const repairHistory = {
      summary: { orderCount: 1, totalPurchased: 0, totalRepair: 800000, totalPaid: 800000, currentDebt: 0 },
      items: [
        {
          _id: "rep-888",
          orderCode: "SC-888",
          recordType: "repair" as const,
          typeLabel: "Sửa chữa",
          status: "done",
          businessDate: "2026-09-02",
          grandTotal: 800000,
          paidAmount: 800000,
          dueAmount: 0,
          itemCount: 1,
          salespersonName: "Thợ Sửa C",
          customerName: "Le Van D",
          customerPhone: "0912345678",
          device: {
            name: "iPad Pro 11 M2",
            serialNumber: "DMPXXXXX",
            condition: "Cấn góc nhẹ",
            accessories: ["Bao da", "Bút Pencil 2"],
          },
          symptom: "Màn hình bị sọc ngang",
          diagnosis: "Lỗi cáp màn hình, cần thay cáp",
          laborFee: 300000,
          partCost: 500000,
        },
      ],
    };
    vi.mocked(customerApi.purchaseHistory).mockResolvedValueOnce(repairHistory);
    const { fireEvent } = await import("@testing-library/react");
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(await screen.findByText("SC-888")).toBeTruthy();

    // Click on table row
    const row = screen.getByText("SC-888").closest("tr");
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    // Modal shows device & repair details
    expect(await screen.findByText("iPad Pro 11 M2")).toBeTruthy();
    expect(screen.getByText("DMPXXXXX")).toBeTruthy();
    expect(screen.getByText("Màn hình bị sọc ngang")).toBeTruthy();
    expect(screen.getByText("Lỗi cáp màn hình, cần thay cáp")).toBeTruthy();
    expect(screen.getByText("Bao da, Bút Pencil 2")).toBeTruthy();
  });

  it("filters and shows warranty item details in modal", async () => {
    const warrantyHistory = {
      summary: { orderCount: 1, warrantyCount: 1, totalPurchased: 0, totalPaid: 0, currentDebt: 0 },
      items: [
        {
          _id: "war-777",
          orderCode: "BH-DH-100",
          recordType: "warranty" as const,
          typeLabel: "Bảo hành",
          status: "active",
          statusLabel: "Còn bảo hành",
          businessDate: "2026-03-01",
          grandTotal: 0,
          paidAmount: 0,
          dueAmount: 0,
          itemCount: 1,
          salespersonName: "Đơn bán DH-100",
          customerName: "Nguyen Thi E",
          customerPhone: "0933333333",
          device: {
            name: "iPhone 15 Pro",
            serialNumber: "IP15-SERIAL-777",
          },
          warrantyInfo: {
            serialNumber: "IP15-SERIAL-777",
            productName: "iPhone 15 Pro 128GB",
            expiresAt: "2027-03-01",
            isExpired: false,
          },
        },
      ],
    };
    vi.mocked(customerApi.purchaseHistory).mockResolvedValueOnce(warrantyHistory);
    const { fireEvent } = await import("@testing-library/react");
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(await screen.findByText("BH-DH-100")).toBeTruthy();
    expect(screen.getAllByText("Bảo hành").length).toBeGreaterThan(0);

    // Click row
    const row = screen.getByText("BH-DH-100").closest("tr");
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    // Modal shows warranty details
    expect(await screen.findByText("Thông tin Bảo hành Thiết bị")).toBeTruthy();
    expect(screen.getAllByText("IP15-SERIAL-777").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Còn bảo hành").length).toBeGreaterThan(0);
    expect(screen.getByText("iPhone 15 Pro 128GB")).toBeTruthy();
  });
});

