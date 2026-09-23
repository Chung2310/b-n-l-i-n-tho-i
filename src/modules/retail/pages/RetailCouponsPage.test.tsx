// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RetailCouponsPage from "./RetailCouponsPage";
import { retailCouponsApi } from "../api/retailCoupons.api";

vi.mock("../components/pos/CustomerPicker", () => ({ default: ({ onChange }: any) => <button type="button" onClick={() => onChange({ _id: "507f1f77bcf86cd799439011", name: "Khách An", customerCode: "KH01" })}>Chọn khách nhận An</button> }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" } }) }));
vi.mock("../api/retailCoupons.api", () => ({
  retailCouponsApi: {
    tiers: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
    automations: vi.fn(),
    saveAutomation: vi.fn(),
  },
}));
const coupon = { _id: "coupon1", code: "SALE10", name: "Ưu đãi tháng", discountType: "percent" as const, value: 10, minSubtotal: 0, maxDiscount: null, usageLimit: 10, usedCount: 3, active: true, version: 4, startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(retailCouponsApi.tiers).mockResolvedValue([{ code: "silver", name: "Hạng Bạc" }, { code: "gold", name: "Hạng Vàng" }]);
  vi.mocked(retailCouponsApi.list).mockResolvedValue({ items: [coupon], total: 1 });
  vi.mocked(retailCouponsApi.save).mockResolvedValue(coupon);
  vi.mocked(retailCouponsApi.automations).mockResolvedValue([]);
});
afterEach(cleanup);
describe("coupon management", () => {
  it("creates a normalized coupon within the selected branch", async () => {
    render(<RetailCouponsPage />);
    await screen.findByText("SALE10");
    await userEvent.click(screen.getByRole("button", { name: "Tạo mã ưu đãi" }));
    await userEvent.type(screen.getByLabelText("Mã ưu đãi"), "new10");
    await userEvent.type(screen.getByLabelText("Tên chương trình"), "Mã mới");
    await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
    await waitFor(() => expect(retailCouponsApi.save).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, expect.objectContaining({ code: "NEW10", name: "Mã mới", active: true, usageLimit: null }), undefined));
  });
  it("preserves code and version while disabling a coupon", async () => {
    render(<RetailCouponsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    expect((screen.getByLabelText("Mã ưu đãi") as HTMLInputElement).disabled).toBe(true);
    await userEvent.click(screen.getByLabelText("Cho phép sử dụng"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
    await waitFor(() => expect(retailCouponsApi.save).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, expect.objectContaining({ code: "SALE10", active: false, version: 4 }), "coupon1"));
  });
  it("shows a save conflict without losing the form", async () => {
    vi.mocked(retailCouponsApi.save).mockRejectedValue(new Error("Mã đã thay đổi."));
    render(<RetailCouponsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Mã đã thay đổi.");
    expect(screen.getByRole("button", { name: "Lưu mã" })).toBeTruthy();
  });
});

it("saves selected customer tiers and can remove the restriction", async () => {
  render(<RetailCouponsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Sửa" }));
  await userEvent.click(screen.getByRole("button", { name: "Hạng khách hàng áp dụng" }));
  await userEvent.click(await screen.findByLabelText("Hạng Bạc"));
  await userEvent.click(screen.getByLabelText("Hạng Vàng"));
  await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
  await waitFor(() => expect(retailCouponsApi.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ customerTierCodes: ["silver", "gold"] }), "coupon1"));
});
it("restores the saved tier selection and clears it when choosing all customers", async () => {
  vi.mocked(retailCouponsApi.list).mockResolvedValue({ items: [{ ...coupon, customerTierCodes: ["silver"] }], total: 1 });
  render(<RetailCouponsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Sửa" }));
  await userEvent.click(screen.getByRole("button", { name: "Hạng khách hàng áp dụng" }));
  expect((await screen.findByLabelText("Hạng Bạc") as HTMLInputElement).checked).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: /Tất cả khách hàng/ }));
  await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
  await waitFor(() => expect(retailCouponsApi.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ customerTierCodes: [] }), "coupon1"));
});

it("shows error and prevents save when end date is before start date", async () => {
  render(<RetailCouponsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Tạo mã ưu đãi" }));
  const startInput = screen.getByLabelText("Bắt đầu");
  const endInput = screen.getByLabelText("Kết thúc");
  await userEvent.clear(endInput);
  await userEvent.type(endInput, "2020-01-01T00:00");
  expect(screen.getAllByText("Ngày kết thúc phải sau ngày bắt đầu.").length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
  expect(retailCouponsApi.save).not.toHaveBeenCalled();
});

it("creates a private single-use coupon for the chosen customer", async () => {
  render(<RetailCouponsPage />);
  await screen.findByText("SALE10");
  await userEvent.click(screen.getByRole("button", { name: "Tạo mã ưu đãi" }));
  await userEvent.type(screen.getByLabelText("Mã ưu đãi"), "GIFT01");
  await userEvent.type(screen.getByLabelText("Tên chương trình"), "Quà riêng");
  await userEvent.click(screen.getByLabelText("Dành riêng cho một khách hàng"));
  expect((screen.getByLabelText("Giới hạn lượt dùng") as HTMLInputElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
  expect(retailCouponsApi.save).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Vui lòng chọn khách hàng nhận mã.");
  await userEvent.click(screen.getByRole("button", { name: "Chọn khách nhận An" }));
  await userEvent.click(screen.getByRole("button", { name: "Lưu mã" }));
  await waitFor(() => expect(retailCouponsApi.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ customerId: "507f1f77bcf86cd799439011", usageLimit: 1 }), undefined));
});

it("shows the recipient and prevents changing ownership on an existing coupon", async () => {
  vi.mocked(retailCouponsApi.list).mockResolvedValue({ items: [{ ...coupon, customerId: "507f1f77bcf86cd799439011", customerName: "Khách An", customerCode: "KH01", usageLimit: 1, usedCount: 0 }], total: 1 });
  render(<RetailCouponsPage />);
  expect(await screen.findByText(/Riêng: Khách An/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Sửa" }));
  expect((screen.getByLabelText("Dành riêng cho một khách hàng") as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText(/Người nhận: Khách An/)).toBeTruthy();
});

it("switches to the automations tab and displays automation programs", async () => {
  const autoItem = {
    _id: "auto1",
    name: "Quà sinh nhật VIP",
    trigger: "birthday" as const,
    orderMinTotal: null,
    enabled: true,
    discountType: "percent" as const,
    value: 15,
    minSubtotal: 100000,
    maxDiscount: null,
    validityDays: 14,
    version: 1,
  };
  vi.mocked(retailCouponsApi.automations).mockResolvedValue([autoItem]);

  render(<RetailCouponsPage />);
  await screen.findByText("SALE10");

  // Click on the "Tự động tặng mã" tab
  await userEvent.click(screen.getByRole("button", { name: /Tự động tặng mã/ }));

  // Should fetch and display the automation program
  expect(await screen.findByText("Quà sinh nhật VIP")).toBeTruthy();
  expect(screen.getByText(/Một mã\/khách\/năm/)).toBeTruthy();
  expect(screen.getByText("Đang bật")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Thêm chương trình" })).toBeTruthy();

  // Switch back to "Mã ưu đãi" tab
  await userEvent.click(screen.getByRole("button", { name: /Mã ưu đãi/ }));
  expect(await screen.findByText("SALE10")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tạo mã ưu đãi" })).toBeTruthy();
});

