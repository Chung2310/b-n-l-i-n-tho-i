// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTabRouter } from "./useTabRouter";
vi.mock("./route-config", () => ({ DEFAULT_APP_TAB: "BÁN LẺ" }));
afterEach(cleanup);

it("opens the sales management workspace instead of standalone POS", () => {
  window.history.replaceState(null, "", "/tong-quan");
  const listener = vi.fn();
  window.addEventListener("popstate", listener);
  try {
    const { result } = renderHook(() => useTabRouter());
    act(() => result.current.setActiveTab("BÁN HÀNG"));
    expect(window.location.pathname).toBe("/ban-le");
    expect(listener).toHaveBeenCalled();
  } finally { window.removeEventListener("popstate", listener); }
});

it("keeps the destination URL when returning from standalone POS", () => {
  window.history.replaceState(null, "", "/pos");
  const { result, rerender } = renderHook(({ enabled }) => useTabRouter({ enabled }), { initialProps: { enabled: false } });
  window.history.pushState(null, "", "/ban-le");
  rerender({ enabled: true });
  expect(result.current.activeTab).toBe("BÁN HÀNG");
  expect(window.location.pathname).toBe("/ban-le");
});

it("preserves a sales deep link when normalizing the old path", () => {
  window.history.replaceState(null, "", "/ban-hang?sub=don-hang&orderId=123");
  renderHook(() => useTabRouter());
  expect(window.location.pathname).toBe("/ban-le");
  expect(window.location.search).toBe("?sub=don-hang&orderId=123");
});
