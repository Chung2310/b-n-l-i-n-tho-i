// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import CartCouponPicker from "./CartCouponPicker";
import { retailCouponsApi, type RetailSelectableCoupon } from "../../api/retailCoupons.api";

vi.mock("../../api/retailCoupons.api", () => ({ retailCouponsApi: { selectable: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const scope = { companyCode: "ACME", branchId: "B1" };
const common: RetailSelectableCoupon = { _id: "1", code: "SALE10", name: "Giảm giá", discountType: "percent", value: 10, minSubtotal: 0, maxDiscount: null };
const privateCoupon: RetailSelectableCoupon = { ...common, _id: "2", code: "GIFT10", customerId: "c1" };

it("offers common coupons without a customer and refreshes private coupons for the selected customer", async () => {
  vi.mocked(retailCouponsApi.selectable)
    .mockResolvedValueOnce([common])
    .mockResolvedValueOnce([common, privateCoupon]);
  const onChange = vi.fn();
  const view = render(<CartCouponPicker scope={scope} value="" onChange={onChange} />);
  expect(await screen.findByRole("option", { name: /SALE10/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /GIFT10/ })).toBeNull();
  expect(retailCouponsApi.selectable).toHaveBeenCalledWith(scope, undefined);
  await userEvent.selectOptions(screen.getByRole("combobox"), "SALE10");
  expect(onChange).toHaveBeenCalledWith("SALE10");
  view.rerender(<CartCouponPicker scope={scope} customerId="c1" value="" onChange={onChange} />);
  expect(await screen.findByRole("option", { name: /GIFT10/ })).toBeTruthy();
  expect(retailCouponsApi.selectable).toHaveBeenLastCalledWith(scope, "c1");
});

it("reports loading failures and allows retry without changing the entered code", async () => {
  vi.mocked(retailCouponsApi.selectable).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([common]);
  const onChange = vi.fn();
  render(<CartCouponPicker scope={scope} value="MANUAL" onChange={onChange} />);
  expect((await screen.findByRole("status")).textContent).toContain("vẫn có thể nhập mã");
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByRole("option", { name: /SALE10/ })).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});
