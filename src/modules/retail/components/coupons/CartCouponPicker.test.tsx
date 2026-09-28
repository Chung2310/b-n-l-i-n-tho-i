// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import CartCouponPicker from "./CartCouponPicker";
import { retailCouponsApi, type RetailCoupon } from "../../api/retailCoupons.api";

vi.mock("../../api/retailCoupons.api", () => ({ retailCouponsApi: { list: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const scope = { companyCode: "ACME", branchId: "B1" };
const coupon: RetailCoupon = { _id: "1", code: "SALE10", name: "Giảm giá", discountType: "percent", value: 10, minSubtotal: 0, maxDiscount: null, usageLimit: null, usedCount: 0, version: 0, active: true, startsAt: "2020-01-01", endsAt: "2099-01-01" };

it("loads all pages, hides expired/exhausted codes and offers personal codes only to their owner", async () => {
  vi.mocked(retailCouponsApi.list).mockResolvedValueOnce({ items: [
    coupon, { ...coupon, _id: "2", code: "EXPIRED", endsAt: "2020-01-02" },
    { ...coupon, _id: "3", code: "USED", usageLimit: 1, usedCount: 1 },
    { ...coupon, _id: "4", code: "PRIVATE", customerId: "c1" },
  ], total: 5 }).mockResolvedValueOnce({ items: [{ ...coupon, _id: "5", code: "PAGE2" }], total: 5 });
  const onChange = vi.fn();
  const view = render(<CartCouponPicker scope={scope} value="" onChange={onChange} />);
  expect(await screen.findByRole("option", { name: /PAGE2/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /EXPIRED|USED|PRIVATE/ })).toBeNull();
  expect(retailCouponsApi.list).toHaveBeenLastCalledWith(scope, 2);
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(<CartCouponPicker scope={scope} customerId="c1" value="" onChange={onChange} />);
  await userEvent.selectOptions(screen.getByRole("combobox"), "PRIVATE");
  expect(onChange).toHaveBeenCalledWith("PRIVATE");
});

it("reports loading failures and allows retry without changing the entered code", async () => {
  vi.mocked(retailCouponsApi.list).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [coupon], total: 1 });
  const onChange = vi.fn();
  render(<CartCouponPicker scope={scope} value="MANUAL" onChange={onChange} />);
  expect((await screen.findByRole("status")).textContent).toContain("vẫn có thể nhập mã");
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByRole("option", { name: /SALE10/ })).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});
