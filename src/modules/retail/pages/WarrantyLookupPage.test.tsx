// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import WarrantyLookupPage from "./WarrantyLookupPage";

vi.mock("../../../services/retailWarrantyService", () => ({
  retailWarrantyService: {
    lookup: vi.fn(),
  },
}));

vi.mock("../../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFoundResult = {
  found: true,
  serialNumber: "356891234567890",
  internalBarcode: "TEM-00123",
  status: "sold",
  costBearer: "shop" as const,
  product: {
    productId: "p1",
    sku: "IP13-128-BLK",
    name: "iPhone 13 128GB Midnight",
  },
  sold: {
    at: "2026-01-15T08:00:00.000Z",
    orderCode: "HD-2026-001",
    customerName: "Nguyễn Văn A",
    customerPhone: "0901234567",
  },
  customerWarranty: {
    covered: true,
    startAt: "2026-01-15T08:00:00.000Z",
    endAt: "2027-01-15T08:00:00.000Z",
    daysLeft: 115,
  },
  supplierWarranty: {
    covered: true,
    startAt: "2026-01-15T08:00:00.000Z",
    endAt: "2027-01-15T08:00:00.000Z",
    daysLeft: 115,
    supplierName: "Synnex FPT",
  },
};

const mockExpiredResult = {
  found: true,
  serialNumber: "356899999999999",
  product: {
    productId: "p2",
    sku: "IP11-64-WHT",
    name: "iPhone 11 64GB White",
  },
  sold: {
    at: "2023-01-15T08:00:00.000Z",
    orderCode: "HD-2023-888",
    customerName: "Trần Thị B",
    customerPhone: "0987654321",
  },
  customerWarranty: {
    covered: false,
    startAt: "2023-01-15T08:00:00.000Z",
    endAt: "2024-01-15T08:00:00.000Z",
    daysLeft: 0,
  },
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

describe("WarrantyLookupPage", () => {
  it("renders page header, hero lookup card, and idle state", () => {
    render(<WarrantyLookupPage />);

    expect(
      screen.getByRole("heading", { name: /Tra cứu bảo hành thiết bị/ })
    ).not.toBeNull();
    expect(
      screen.getByPlaceholderText(/Nhập IMEI \(15 số\), Serial máy hoặc quét mã vạch/)
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /Kiểm tra bảo hành/ })
    ).not.toBeNull();

    // Idle guidance text
    expect(
      screen.getByText(/Sẵn sàng kiểm tra thông tin bảo hành/)
    ).not.toBeNull();
    expect(
      screen.getByText(/1\. Xác thực nguồn gốc từ shop/)
    ).not.toBeNull();
    expect(
      screen.getByText(/2\. Kiểm tra hiệu lực bảo hành/)
    ).not.toBeNull();
  });

  it("submits search and renders verified shop origin and active warranty", async () => {
    vi.mocked(retailWarrantyService.lookup).mockResolvedValue(mockFoundResult);
    const user = userEvent.setup();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<WarrantyLookupPage />);

    const input = screen.getByPlaceholderText(/Nhập IMEI \(15 số\)/);
    await user.type(input, "356891234567890");

    const searchBtn = screen.getByRole("button", { name: /Kiểm tra bảo hành/ });
    await user.click(searchBtn);

    await waitFor(() => {
      expect(retailWarrantyService.lookup).toHaveBeenCalledWith("356891234567890");
    });

    // Verification banner
    expect(
      await screen.findByText(/XÁC NHẬN: THIẾT BỊ XUẤT BÁN TẠI SHOP/)
    ).not.toBeNull();
    expect(screen.getByText("CÒN HẠN BẢO HÀNH")).not.toBeNull();

    // Device & Customer info
    expect(screen.getByText("iPhone 13 128GB Midnight")).not.toBeNull();
    expect(screen.getByText("HD-2026-001")).not.toBeNull();
    expect(screen.getByText("Nguyễn Văn A")).not.toBeNull();
    expect(screen.getByText("0901234567")).not.toBeNull();

    // Click primary warranty button
    const warrantyBtn = screen.getByRole("button", {
      name: /Tiếp nhận bảo hành miễn phí \(Còn hạn\)/,
    });
    await user.click(warrantyBtn);
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("handles expired warranty and offers service repair with discount", async () => {
    vi.mocked(retailWarrantyService.lookup).mockResolvedValue(mockExpiredResult);
    const user = userEvent.setup();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<WarrantyLookupPage />);

    const input = screen.getByPlaceholderText(/Nhập IMEI \(15 số\)/);
    await user.type(input, "356899999999999");
    await user.click(screen.getByRole("button", { name: /Kiểm tra bảo hành/ }));

    expect(
      await screen.findByText(/XÁC NHẬN: THIẾT BỊ XUẤT BÁN TẠI SHOP/)
    ).not.toBeNull();
    expect(screen.getByText("ĐÃ HẾT HẠN BẢO HÀNH")).not.toBeNull();
    expect(screen.getByText("iPhone 11 64GB White")).not.toBeNull();

    const serviceBtn = screen.getByRole("button", {
      name: /Tiếp nhận sửa chữa dịch vụ \(ưu đãi 10% khách mua máy\)/,
    });
    await user.click(serviceBtn);
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("handles not found (outside shop) and provides external service repair button", async () => {
    vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: false });
    const user = userEvent.setup();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<WarrantyLookupPage />);

    const input = screen.getByPlaceholderText(/Nhập IMEI \(15 số\)/);
    await user.type(input, "999999999999999");
    await user.click(screen.getByRole("button", { name: /Kiểm tra bảo hành/ }));

    expect(
      await screen.findByText(/THIẾT BỊ NGOÀI SHOP/)
    ).not.toBeNull();
    expect(
      screen.getByText(/Không tìm thấy máy trong lịch sử xuất bán của shop/)
    ).not.toBeNull();

    const openServiceBtn = screen.getByRole("button", {
      name: /Tiếp nhận sửa chữa dịch vụ \(khách ngoài\)/,
    });
    await user.click(openServiceBtn);

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("automatically debounces 1s after user stops typing to trigger lookup without clicking button", async () => {
    vi.mocked(retailWarrantyService.lookup).mockResolvedValue(mockFoundResult);
    const user = userEvent.setup();

    render(<WarrantyLookupPage />);

    const input = screen.getByPlaceholderText(/Nhập IMEI \(15 số\)/);
    await user.type(input, "356891234567890");

    // Không cần bấm bất kỳ nút nào, tự động gọi API sau 1s debounce
    await waitFor(() => {
      expect(retailWarrantyService.lookup).toHaveBeenCalledWith("356891234567890");
    }, { timeout: 2500 });

    expect(await screen.findByText("iPhone 13 128GB Midnight")).not.toBeNull();
  });
});
