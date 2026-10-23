// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  listeners: new Map<string, (event: { companyCode: string; branchId: string; cashierId: string }) => void>(),
  profile: { uid: "employee-1", role: "user", companyCode: "C", branchId: "B", enabledModules: ["retail"], permissions: ["pos:manage"] },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: mocks.profile, hasPermission: (permission: string) => mocks.profile.permissions.includes("*") || mocks.profile.permissions.includes(permission) }),
}));
vi.mock("../modules/retail/hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "C", branchId: "B", terminalId: "T" } }) }));
vi.mock("../modules/retail/api/retailShifts.api", () => ({ retailShiftsApi: { current: mocks.current } }));
vi.mock("../services/socketService", () => ({ socketService: { on: (event: string, callback: (payload: { companyCode: string; branchId: string; cashierId: string }) => void) => { mocks.listeners.set(event, callback); return () => mocks.listeners.delete(event); } } }));
vi.mock("../hooks/useMediaQuery", () => ({ useIsMobile: () => false }));

beforeEach(() => {
  window.history.replaceState(null, "", "/nhan-su");
  mocks.profile = { uid: "employee-1", role: "user", companyCode: "C", branchId: "B", enabledModules: ["retail"], permissions: ["pos:manage"] };
  mocks.current.mockReset();
  mocks.listeners.clear();
});
afterEach(() => cleanup());

function renderSidebar() {
  return render(<Sidebar activeTab="NHÂN SỰ" setActiveTab={vi.fn()} mobileOpen={false} onMobileClose={vi.fn()} />);
}

it("keeps Sales locked when a POS operator has no assigned open shift", async () => {
  mocks.current.mockResolvedValue(null);
  renderSidebar();
  await waitFor(() => expect(mocks.current).toHaveBeenCalled());
  const sales = screen.getByRole("button", { name: "Bán hàng" });
  expect(sales.getAttribute("aria-disabled")).toBe("true");
  expect(sales.querySelector("svg.lucide-lock-keyhole")).toBeTruthy();
  fireEvent.click(sales);
  expect(window.location.pathname).toBe("/nhan-su");
});

it("sends an employee with their own open shift straight to POS", async () => {
  mocks.current.mockResolvedValue({ _id: "shift-1", cashierId: "employee-1", status: "open" });
  renderSidebar();
  const sales = screen.getByRole("button", { name: "Bán hàng" });
  await waitFor(() => expect(sales.getAttribute("aria-disabled")).toBe("false"));
  fireEvent.click(sales);
  expect(window.location.pathname).toBe("/pos");
});

it("locks Sales again when the employee's shift closes", async () => {
  mocks.current.mockResolvedValueOnce({ _id: "shift-1", cashierId: "employee-1", status: "open" }).mockResolvedValue(null);
  renderSidebar();
  const sales = screen.getByRole("button", { name: "Bán hàng" });
  await waitFor(() => expect(sales.getAttribute("aria-disabled")).toBe("false"));
  mocks.listeners.get("pos:session:closed")?.({ companyCode: "C", branchId: "B", cashierId: "employee-1" });
  await waitFor(() => expect(sales.getAttribute("aria-disabled")).toBe("true"));
});

it("sends an admin to sales management without querying an assigned shift", () => {
  mocks.profile = { ...mocks.profile, role: "admin", permissions: ["*"] };
  renderSidebar();
  fireEvent.click(screen.getByRole("button", { name: "Bán hàng" }));
  expect(window.location.pathname).toBe("/ban-le");
  expect(mocks.current).not.toHaveBeenCalled();
});
