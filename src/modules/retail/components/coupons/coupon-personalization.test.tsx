// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { retailCouponsApi } from "../../api/retailCoupons.api";
import BirthdayCouponSettings from "./BirthdayCouponSettings";
import CustomerCouponOffers from "./CustomerCouponOffers";

vi.mock("../../api/retailCoupons.api", () => ({ retailCouponsApi: { birthdayProgram: vi.fn(), saveBirthdayProgram: vi.fn(), available: vi.fn() } }));
const scope = { companyCode: "ACME", branchId: "b1" };
const config = { enabled: false, discountType: "percent" as const, value: 10, minSubtotal: 0, maxDiscount: null, validityDays: 7, version: 0 };
const coupon = { _id: "gift1", code: "GIFT1", name: "Quà sinh nhật", discountType: "percent" as const, value: 10, minSubtotal: 0, maxDiscount: 50000, usageLimit: 1, usedCount: 0, version: 0, startsAt: "2026-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", active: true };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(retailCouponsApi.birthdayProgram).mockResolvedValue(config);
  vi.mocked(retailCouponsApi.saveBirthdayProgram).mockResolvedValue({ ...config, enabled: true, version: 1 });
  vi.mocked(retailCouponsApi.available).mockResolvedValue([coupon]);
});
afterEach(cleanup);
it("loads disabled birthday configuration and explicitly enables it with the current version", async () => {
  render(<BirthdayCouponSettings scope={scope} />);
  const toggle = await screen.findByLabelText("Bật tự động tặng mã sinh nhật");
  expect((toggle as HTMLInputElement).checked).toBe(false);
  await userEvent.click(toggle);
  await userEvent.clear(screen.getByLabelText("Hiệu lực (ngày)"));
  await userEvent.type(screen.getByLabelText("Hiệu lực (ngày)"), "14");
  await userEvent.click(screen.getByRole("button", { name: "Lưu chương trình sinh nhật" }));
  await waitFor(() => expect(retailCouponsApi.saveBirthdayProgram).toHaveBeenCalledWith(scope, { ...config, enabled: true, validityDays: 14 }));
  expect(await screen.findByRole("status")).toBeTruthy();
});
it("keeps birthday settings editable when saving fails", async () => {
  vi.mocked(retailCouponsApi.saveBirthdayProgram).mockRejectedValue(new Error("Chương trình đã thay đổi."));
  render(<BirthdayCouponSettings scope={scope} />);
  await screen.findByLabelText("Hiệu lực (ngày)");
  await userEvent.click(screen.getByRole("button", { name: "Lưu chương trình sinh nhật" }));
  expect((await screen.findByRole("alert")).textContent).toContain("đã thay đổi");
});
it("applies a selected customer's gift without applying one automatically", async () => {
  const apply = vi.fn();
  render(<CustomerCouponOffers scope={scope} customerId="c1" onApply={apply} />);
  expect(await screen.findByText("GIFT1")).toBeTruthy();
  expect(retailCouponsApi.available).toHaveBeenCalledWith(scope, "c1");
  expect(apply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
  expect(apply).toHaveBeenCalledWith("GIFT1");
});
it("hides the old customer's gifts immediately and ignores their late response", async () => {
  let finish!: (value: any) => void;
  vi.mocked(retailCouponsApi.available).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce([]);
  const view = render(<CustomerCouponOffers scope={scope} customerId="c1" onApply={vi.fn()} />);
  view.rerender(<CustomerCouponOffers scope={scope} customerId="c2" onApply={vi.fn()} />);
  await act(async () => finish([coupon]));
  expect(screen.queryByText("GIFT1")).toBeNull();
  expect(retailCouponsApi.available).toHaveBeenLastCalledWith(scope, "c2");
});
