// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AfterSalesForm } from "./RetailOrdersPageV2";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import type { RetailOrder } from "../types";
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "A", branchId: "B" }, userProfile: { uid: "u1" } }) }));
vi.mock("../api/retailAfterSales.api", () => ({ retailAfterSalesApi: { create: vi.fn() } }));
vi.mock("../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const order = { _id: "o1", orderCode: "DH1", subtotal: 400, grandTotal: 400, items: [{ productName: "Phone", sku: "PHONE", quantity: 2, lineTotal: 400 }] } as RetailOrder;
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); });
afterEach(cleanup);

it.each(["return", "buyback"] as const)("freezes %s fields and retries the saved request after reopening", async (type) => {
  const user = userEvent.setup(), done = vi.fn();
  vi.mocked(retailAfterSalesApi.create).mockRejectedValueOnce(new Error("network"));
  const view = render(<AfterSalesForm order={order} type={type} close={vi.fn()} done={done} />);
  await user.click(screen.getByRole("checkbox"));
  await user.type(screen.getByPlaceholderText("Nhập lý do đổi trả/thu mua..."), "Unused");
  await user.click(screen.getByRole("button", { name: "Xác nhận" }));
  await screen.findByRole("button", { name: "Thử lại yêu cầu cũ" });
  const sent = vi.mocked(retailAfterSalesApi.create).mock.calls[0][1];
  await user.type(screen.getByPlaceholderText("Nhập lý do đổi trả/thu mua..."), "Changed");
  expect((screen.getByPlaceholderText("Nhập lý do đổi trả/thu mua...") as HTMLInputElement).value).toBe("Unused");
  view.unmount();
  render(<AfterSalesForm order={order} type={type} close={vi.fn()} done={done} />);
  vi.mocked(retailAfterSalesApi.create).mockResolvedValueOnce({ _id: "as1", code: "TH1" } as any);
  await user.click(screen.getByRole("button", { name: "Thử lại yêu cầu cũ" }));
  await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls[1][1]).toEqual(sent);
});
