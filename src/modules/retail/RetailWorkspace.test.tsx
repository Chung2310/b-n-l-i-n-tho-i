// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RetailWorkspace from "./RetailWorkspace";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { role: "admin", permissions: ["*"] } }),
}));

vi.mock("../../hooks/useSubTabRouter", () => ({
  useSubTabRouter: (tabs: Array<{ value: string }>, fallback: string) => React.useState(tabs[0]?.value || fallback),
}));

vi.mock("./pages/RetailPosPage", () => ({ default: () => <div>POS page</div> }));
vi.mock("./pages/RetailSettingsPage", () => ({ default: () => <div>Settings page</div> }));
vi.mock("./pages/RetailOrdersPageV2", () => ({ default: () => <div>Orders page</div> }));
vi.mock("./pages/RetailShiftsPage", () => ({ default: () => <div>Shifts page</div> }));
vi.mock("./pages/RetailInvoicesPageContent", () => ({ default: () => <div>Invoices page</div> }));
vi.mock("./pages/RetailReportsPage", () => ({ default: () => <div>Reports page</div> }));
vi.mock("./pages/RetailReturnsPage", () => ({ default: () => <div>Returns page</div> }));
vi.mock("./pages/WarrantyLookupPage", () => ({ default: () => <div>Warranty page</div> }));

describe("RetailWorkspace", () => {
  it("opens the management overview and reserves POS for its own button", () => {
    window.history.replaceState(null, "", "/ban-le");
    render(<RetailWorkspace />);

    expect(screen.getByText("Tổng quan bán hàng")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Đơn hàng" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Mở quầy POS/i })).toBeTruthy();
    expect(screen.queryByText("Chưa có phiên bán hàng")).toBeNull();
    expect(window.location.pathname).toBe("/ban-le");

    fireEvent.click(screen.getByRole("button", { name: "Tổng quan" }));
    expect(window.location.pathname).toBe("/ban-le");

    const listener = vi.fn();
    window.addEventListener("popstate", listener);
    try {
      fireEvent.click(screen.getByRole("button", { name: /Mở quầy POS/i }));
      expect(window.location.pathname).toBe("/pos");
      expect(listener).toHaveBeenCalled();
    } finally {
      window.removeEventListener("popstate", listener);
    }
  });

  it("does not render the retail customer management tab", () => {
    render(<RetailWorkspace />);

    expect(screen.queryByRole("button", { name: "Khách hàng" })).toBeNull();
  });
});
