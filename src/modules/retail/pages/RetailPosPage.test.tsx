// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailProductsApi } from "../api/retailProducts.api";
import { retailCouponsApi } from "../api/retailCoupons.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import { customerApi } from "../../customer-management/customerApi";
import RetailPosPage from "./RetailPosPage";
import { inventorySerialService } from "../../../services/inventorySerialService";
import { toast } from "../../../pages/Toast";

vi.mock("../../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}));

vi.mock("../api/retailCoupons.api", () => ({ retailCouponsApi: { available: vi.fn().mockResolvedValue([]), list: vi.fn() } }));
vi.mock("../../../services/inventorySerialService", () => ({ inventorySerialService: { list: vi.fn() } }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" }, userProfile: { uid: "u1" } }) }));
vi.mock("../../customer-management/customerApi", () => ({ customerApi: { billingProfiles: vi.fn() } }));
vi.mock("../api/retailProducts.api", () => ({ retailProductsApi: { list: vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { current: vi.fn().mockResolvedValue({ _id: "s1", shiftCode: "CA-1", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 0, businessDate: "2026-08-10", status: "open" }) } }));
vi.mock("../../../services/retailWarrantyService", () => ({ retailWarrantyService: { lookup: vi.fn() } }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { list: vi.fn(), quote: vi.fn(), createDraft: vi.fn(), updateDraft: vi.fn(), confirm: vi.fn(), idempotency: vi.fn(), cancel: vi.fn() } }));
vi.mock("../components/pos/HeldDraftsBar", () => ({ default: () => null }));
vi.mock("../components/pos/BarcodeScannerDialog", () => ({ default: () => null }));
vi.mock("../components/pos/CustomerPicker", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ _id: "c1", customerCode: "KH-1", companyCode: "ACME", type: "vat", name: "An" })}>Chọn khách An</button> }));
vi.mock("../components/pos/DiscountInput", () => ({ default: ({ label, onChange }: any) => <button onClick={() => onChange({ type: "percent", value: 10 })}>{label}</button> }));
vi.mock("../components/pos/OrderAdjustments", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000 })}>Điều chỉnh đơn</button> }));
vi.mock("../components/pos/PaymentDialog", () => ({ default: ({ onSubmit }: any) => <div data-testid="payment-dialog"><button onClick={() => onSubmit([{ method: "cash", amount: 209_000, tenderedAmount: 220_000 }])}>Gửi thanh toán</button><button onClick={() => onSubmit([], "2026-09-30")}>Gửi ghi nợ toàn bộ</button></div> }));

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "cái", stock: 10, price: 100_000 };
const order = { _id: "o1", orderCode: "DH-1", status: "completed", paymentStatus: "paid", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, paidAmount: 209_000, dueAmount: 0, version: 1, createdBy: "u1", createdByName: "Thu ngân" } as any;
const invoice = { _id: "i1", invoiceNo: "HD-1", orderId: "o1", orderCode: "DH-1", issuedAt: "2026-08-10T08:00:00Z", status: "issued", snapshot: { customerName: "An", cashierName: "Thu ngân", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, payments: [], amountInWords: "" } } as any;

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailCouponsApi.list).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(customerApi.billingProfiles).mockResolvedValue([{ _id: "bp1", customerId: "c1", legalName: "Cong ty A", taxId: "0312345678", address: "1 Nguyen Hue", invoiceEmail: "a@example.com", isDefault: true, status: "active", version: 1 }] as any);
  vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [product], total: 1, page: 1, limit: 500 });
  vi.mocked(retailOrdersApi.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 5 });
  vi.mocked(retailOrdersApi.quote).mockResolvedValue({ subtotal: 180_000, grandTotal: 209_000 });
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ ...order, status: "draft" });
  vi.mocked(retailOrdersApi.confirm).mockResolvedValue({ order, invoice });
});

describe("RetailPosPage", () => {
  it("selects a serial before adding and leaves the cart unchanged on cancellation", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [{ ...product, trackingMode: "serial", productId: "base1", variantId: "v1" }], total: 1, page: 1, limit: 500 });
    vi.mocked(inventorySerialService.list).mockResolvedValue({ items: [
      { _id: "unit1", serialNumber: "IMEI001", normalizedSerialNumber: "IMEI001" },
      { _id: "unit2", serialNumber: "IMEI002", normalizedSerialNumber: "IMEI002" },
    ], total: 2, page: 1, limit: 100 } as any);
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    const card = await screen.findByRole("button", { name: /SKU-1/ });
    await userEvent.click(card);
    expect(screen.getByRole("dialog", { name: "Chọn IMEI / Serial để thêm vào giỏ" })).toBeTruthy();
    expect(screen.queryByLabelText("Số lượng Áo")).toBeNull();
    expect((screen.getByRole("button", { name: "Thêm vào giỏ" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(await screen.findByRole("radio", { name: "IMEI001" }));
    await userEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByLabelText("Số lượng Áo")).toBeNull();
    expect(retailOrdersApi.quote).not.toHaveBeenCalled();
    await userEvent.click(card);
    await userEvent.click(await screen.findByRole("radio", { name: "IMEI001" }));
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    expect((screen.getByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ items: [expect.objectContaining({ quantity: 1, serialNumbers: ["IMEI001"] })] })));
    await userEvent.click(card);
    await screen.findByRole("radio", { name: "IMEI002" });
    expect(screen.queryByRole("radio", { name: "IMEI001" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "IMEI002" }));
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ items: [expect.objectContaining({ quantity: 2, serialNumbers: ["IMEI001", "IMEI002"] })] })));
    expect(inventorySerialService.list).toHaveBeenCalledWith(expect.objectContaining({ productId: "base1", variantId: "v1", forSale: true, status: "in_stock" }));
  });

  it.each(["empty", "error"])("does not add a serial product when the picker is %s", async (scenario) => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [{ ...product, trackingMode: "serial" }], total: 1, page: 1, limit: 500 });
    if (scenario === "error") vi.mocked(inventorySerialService.list).mockRejectedValue(new Error("Lỗi tải serial"));
    else vi.mocked(inventorySerialService.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await screen.findByText(scenario === "error" ? "Lỗi tải serial" : "Không có IMEI / Serial khả dụng phù hợp.");
    expect((screen.getByRole("button", { name: "Thêm vào giỏ" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText("Số lượng Áo")).toBeNull();
  });

  it("toggles fullscreen without clearing the current cart", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Toàn màn hình" }));
    expect(screen.getByRole("button", { name: "Thoát toàn màn hình" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Toàn màn hình" }).getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
  });
  it("uses either a created coupon or a manually typed code in the cart quote", async () => {
    vi.mocked(retailCouponsApi.list).mockResolvedValue({ items: [{ _id: "coupon-1", code: "SALE10", name: "Giảm 10%", discountType: "percent", value: 10, active: true, startsAt: "2020-01-01", endsAt: "2099-01-01", usageLimit: null, usedCount: 0, minSubtotal: 0, maxDiscount: null, version: 0 }], total: 1 });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Chọn mã ưu đãi đã tạo" }), "SALE10");
    expect((screen.getByRole("textbox", { name: "Mã ưu đãi" }) as HTMLInputElement).value).toBe("SALE10");
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ couponCode: "SALE10" })));
    await userEvent.clear(screen.getByRole("textbox", { name: "Mã ưu đãi" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Mã ưu đãi" }), "MANUAL20");
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ couponCode: "MANUAL20" })));
    await userEvent.click(screen.getByTitle("Xóa mã"));
    expect((screen.getByRole("textbox", { name: "Mã ưu đãi" }) as HTMLInputElement).value).toBe("");
  });
  it("nests products in inventory folders and supports expanding level by level and adding a nested SKU", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({
      items: [
        { ...product, categoryPath: [{ code: "ROOT", name: "Hàng hóa" }, { code: "CLOTHES", name: "Quần áo" }, { code: "A", name: "Áo thun" }] },
        { ...product, _id: "p2", sku: "SKU-2", name: "Túi", category: "", categoryPath: [] },
      ], total: 2, page: 1, limit: 500,
    });
    render(<RetailPosPage />);
    const root = await screen.findByRole("button", { name: /Hàng hóa/ });
    expect(root.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /Quần áo/ })).toBeNull();

    // Click Level 1 to reveal Level 2
    await userEvent.click(root);
    expect(root.getAttribute("aria-expanded")).toBe("true");
    const child = await screen.findByRole("button", { name: /Quần áo/ });
    expect(root.closest("section")?.contains(child)).toBe(true);
    expect(child.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /Áo thun/ })).toBeNull();

    // Click Level 2 to reveal Level 3
    await userEvent.click(child);
    const leaf = await screen.findByRole("button", { name: /Áo thun/ });
    expect(child.closest("section")?.contains(leaf)).toBe(true);
    expect(screen.getByRole("button", { name: /Chưa phân loại/ })).toBeTruthy();

    // Collapsing root hides children
    await userEvent.click(root);
    expect(root.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /SKU-1/ })).toBeNull();

    // Expand root & leaf to click SKU
    await userEvent.click(root);
    await userEvent.click(leaf);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    expect((await screen.findByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
  });

  it("opens POS without requesting or opening a sales shift", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(null);
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    expect(await screen.findByRole("button", { name: /SKU-1/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Mở ca bán hàng" })).toBeNull();
    expect(retailShiftsApi.current).not.toHaveBeenCalled();
  });

  it("keeps payment dialog closed and guides cashier to select a customer", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));

    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));

    expect(screen.queryByTestId("payment-dialog")).toBeNull();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn khách hàng trước khi thanh toán."));
  });

  it("adds the first search result on Enter without treating the text as a barcode scan", async () => {
    render(<RetailPosPage />);
    const search = await screen.findByRole("textbox", { name: "Tìm hoặc quét sản phẩm" });

    await userEvent.type(search, "ÁO");
    await waitFor(() => expect(retailProductsApi.list).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { q: "ÁO", limit: 500 },
    ));
    await userEvent.keyboard("{Enter}");

    expect((await screen.findByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
    expect(retailWarrantyService.lookup).not.toHaveBeenCalled();
    expect(screen.queryByText("Không tìm thấy sản phẩm")).toBeNull();
  });

  it("carries customer, VAT profile and adjustments through quote and checkout to receipt", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    await userEvent.click(await screen.findByRole("button", { name: /Áo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await userEvent.click(screen.getByRole("button", { name: "Giảm giá Áo" }));
    await userEvent.click(screen.getByRole("button", { name: "Điều chỉnh đơn" }));

    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, {
      items: [{ productId: "p1", quantity: 1, discount: { type: "percent", value: 10 } }], customerId: "c1", billingProfileId: "bp1",
      orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000,
    }));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));
    expect(await screen.findByRole("dialog", { name: "Thanh toán thành công" })).toBeTruthy();
    expect(screen.getByText("HD-1")).toBeTruthy();
  });

  it("creates a customer debt draft with VAT profile and confirms with no collected payments", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi ghi nợ toàn bộ" }));

    await waitFor(() => expect(retailOrdersApi.createDraft).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, expect.objectContaining({ customerId: "c1", billingProfileId: "bp1", dueDate: "2026-09-30" })));
    expect(retailOrdersApi.confirm).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "o1", expect.objectContaining({ payments: [] }));
  });

  it("displays zero-stock products and warns when attempting to add to cart", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({
      items: [{ ...product, stock: 0 }],
      total: 1, page: 1, limit: 500,
    });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));
    expect(screen.getByText("Hết hàng")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /SKU-1/ }));
    expect(toast.error).toHaveBeenCalledWith("Áo không còn đủ tồn khả dụng.");
  });

  it("renders a floating SKU dropdown for products with multiple SKUs and selects a different SKU", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({
      items: [
        { ...product, _id: "p1-v1", productId: "parent-1", name: "iPhone 15", sku: "IP15-128", variantName: "128GB", price: 20_000_000, stock: 5 },
        { ...product, _id: "p1-v2", productId: "parent-1", name: "iPhone 15", sku: "IP15-256", variantName: "256GB", price: 23_000_000, stock: 3 },
      ],
      total: 2, page: 1, limit: 500,
    });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "A" }));

    // SKU dropdown toggle button is present
    const skuDropdownButton = await screen.findByRole("button", { name: "Chọn SKU cho iPhone 15" });
    expect(skuDropdownButton).toBeTruthy();
    expect(skuDropdownButton.textContent).toContain("2 SKU · Tổng tồn: 8");

    // Open dropdown
    await userEvent.click(skuDropdownButton);
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getByRole("option", { name: /256GB/ })).toBeTruthy();

    // Select second variant
    await userEvent.click(screen.getByRole("option", { name: /256GB/ }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(await screen.findByLabelText("Số lượng iPhone 15")).toBeTruthy();
  });
});
