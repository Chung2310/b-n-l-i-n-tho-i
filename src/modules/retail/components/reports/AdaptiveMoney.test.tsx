// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import AdaptiveMoney, { compactReportMoney } from "./AdaptiveMoney";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([
  [1250000000, "1,25 tỷ ₫"],
  [12500000, "12,5 triệu ₫"],
  [-2500000000, "-2,5 tỷ ₫"],
  [1250000000000, "1,25 nghìn tỷ ₫"],
  [125000, "125 nghìn ₫"],
])("shortens %s with Vietnamese units and preserves the sign", (value, expected) => {
  expect(compactReportMoney(value)).toBe(expected);
});

it("shortens only when the amount overflows, restores it on resize and exposes the exact value on click", async () => {
  let width = 400;
  let resized = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resized = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 250 } as DOMRect);
  const full = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(1250000000);
  const view = render(<AdaptiveMoney value={1250000000} />);
  const button = screen.getByRole("button", { name: full });
  expect(button.textContent).toBe(full);
  act(() => { width = 100; resized(); });
  expect(button.textContent).toBe("1,25 tỷ ₫");
  expect(button.title).toBe(full);
  await userEvent.click(button);
  expect(screen.getByRole("status").textContent).toBe(full);
  act(() => { width = 400; resized(); });
  expect(button.textContent).toBe(full);
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
});
