// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { retailCouponsApi } from "../../api/retailCoupons.api";
import CouponAutomationsDialog from "./CouponAutomationsDialog";

vi.mock("../../api/retailCoupons.api", () => ({ retailCouponsApi: { automations: vi.fn(), saveAutomation: vi.fn() } }));
const scope = { companyCode: "ACME", branchId: "b1" };
const purchase = { _id: "p1", name: "Quà đơn lớn", trigger: "order_total" as const, orderMinTotal: 2000000, enabled: true,
  discountType: "amount" as const, value: 100000, minSubtotal: 500000, maxDiscount: null, validityDays: 7, version: 3 };
const birthday = { ...purchase, _id: "p2", name: "Quà sinh nhật", trigger: "birthday" as const, orderMinTotal: null, legacy: true };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(retailCouponsApi.automations).mockResolvedValue([purchase, birthday]);
  vi.mocked(retailCouponsApi.saveAutomation).mockResolvedValue({ ...purchase, version: 4 });
});
afterEach(cleanup);

it("lists simultaneous purchase and legacy birthday programs", async () => {
  render(<CouponAutomationsDialog scope={scope} onClose={vi.fn()} />);
  expect(await screen.findByText("Quà đơn lớn")).toBeTruthy();
  expect(screen.getByText("Quà sinh nhật")).toBeTruthy();
  expect(screen.getByText(/Đơn đã thanh toán từ 2.000.000/)).toBeTruthy();
  expect(screen.getByText("Sinh nhật · Một mã/khách/năm")).toBeTruthy();
});
it("creates a purchase reward with separate earning and redemption thresholds", async () => {
  render(<CouponAutomationsDialog scope={scope} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chương trình" }));
  await userEvent.type(screen.getByLabelText("Tên chương trình"), "Quà mua hàng");
  await userEvent.selectOptions(screen.getByLabelText("Hoạt động tặng mã"), "order_total");
  const threshold = screen.getByLabelText("Giá trị đơn tối thiểu để tặng mã (₫)");
  await userEvent.clear(threshold); await userEvent.type(threshold, "2000000");
  const spend = screen.getByLabelText("Đơn tối thiểu để sử dụng mã (₫)");
  await userEvent.clear(spend); await userEvent.type(spend, "500000");
  await userEvent.click(screen.getByLabelText("Bật chương trình tự động"));
  await userEvent.click(screen.getByRole("button", { name: "Lưu chương trình" }));
  await waitFor(() => expect(retailCouponsApi.saveAutomation).toHaveBeenCalledWith(scope, expect.objectContaining({ name: "Quà mua hàng", trigger: "order_total", orderMinTotal: 2000000, minSubtotal: 500000, enabled: true, version: 0 }), undefined));
  expect(await screen.findByRole("dialog", { name: "Tự động tặng mã ưu đãi" })).toBeTruthy();
});
it("shows only birthday fields when that activity is selected", async () => {
  render(<CouponAutomationsDialog scope={scope} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm chương trình" }));
  expect(screen.queryByLabelText("Giá trị đơn tối thiểu để tặng mã (₫)")).toBeNull();
  await userEvent.selectOptions(screen.getByLabelText("Hoạt động tặng mã"), "order_total");
  expect(screen.getByLabelText("Giá trị đơn tối thiểu để tặng mã (₫)")).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText("Hoạt động tặng mã"), "birthday");
  expect(screen.queryByLabelText("Giá trị đơn tối thiểu để tặng mã (₫)")).toBeNull();
});
it("locks an existing trigger and preserves its version when editing", async () => {
  render(<CouponAutomationsDialog scope={scope} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Sửa chương trình Quà đơn lớn" }));
  expect((screen.getByLabelText("Hoạt động tặng mã") as HTMLSelectElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Lưu chương trình" }));
  await waitFor(() => expect(retailCouponsApi.saveAutomation).toHaveBeenCalledWith(scope, expect.objectContaining({ trigger: "order_total", version: 3 }), "p1"));
});
it("preserves the editor on save conflict and returns to the list on Escape", async () => {
  vi.mocked(retailCouponsApi.saveAutomation).mockRejectedValue(new Error("Chương trình đã thay đổi."));
  const close = vi.fn();
  render(<CouponAutomationsDialog scope={scope} onClose={close} />);
  await userEvent.click(await screen.findByRole("button", { name: "Sửa chương trình Quà đơn lớn" }));
  await userEvent.click(screen.getByRole("button", { name: "Lưu chương trình" }));
  expect((await screen.findByRole("alert")).textContent).toContain("đã thay đổi");
  expect(screen.getByLabelText("Tên chương trình")).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "Tự động tặng mã ưu đãi" })).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  expect(document.body.style.overflow).toBe("hidden");
  await userEvent.keyboard("{Escape}");
  expect(close).toHaveBeenCalledOnce();
});

it("allows Email and disables channels still in development", async () => {
  render(<CouponAutomationsDialog scope={scope} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Sửa chương trình Quà đơn lớn" }));
  const email = screen.getByRole("checkbox", { name: "Email" }) as HTMLInputElement;
  expect(email.checked).toBe(false);
  expect((screen.getByRole("checkbox", { name: /Zalo/ }) as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("checkbox", { name: /Số điện thoại/ }) as HTMLInputElement).disabled).toBe(true);
  await userEvent.click(email);
  await userEvent.click(screen.getByRole("button", { name: "Lưu chương trình" }));
  await waitFor(() => expect(retailCouponsApi.saveAutomation).toHaveBeenCalledWith(scope, expect.objectContaining({ deliveryChannels: ["email"] }), "p1"));
});
