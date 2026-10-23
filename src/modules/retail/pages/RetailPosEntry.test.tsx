// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RetailPosEntry from "./RetailPosEntry";
const mocks = vi.hoisted(() => ({ role: "pos_cashier", current: vi.fn(), open: vi.fn(), close: vi.fn(), logout: vi.fn(), listeners: new Map<string, (event: any) => void>() }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: mocks.role, displayName: mocks.role === "admin" ? "QA" : "Thu ngân" }, logout: mocks.logout }) }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "C", branchId: "B", terminalId: "T" }, branchName: "Chi nhánh" }) }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { current: mocks.current, open: mocks.open, close: mocks.close } }));
vi.mock("./RetailPosPage", () => ({ default: ({ posSessionId }: any) => <div data-testid="pos">{posSessionId}</div> }));
vi.mock("../../../services/socketService", () => ({ socketService: {
  isConnected: () => true,
  on: (event: string, callback: (event: any) => void) => { mocks.listeners.set(event, callback); return () => mocks.listeners.delete(event); },
  onStatusChange: (callback: any) => { mocks.listeners.set("connection", callback); return () => mocks.listeners.delete("connection"); },
} }));
const shift = { _id: "s1", shiftCode: "POS-1", status: "open", terminalId: "T", businessDate: "2026-10-07", operationalEndsAt: "2026-10-07T16:59:59.999Z" };
beforeEach(() => { vi.clearAllMocks(); mocks.role = "pos_cashier"; mocks.listeners.clear(); mocks.current.mockResolvedValue(null); mocks.logout.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState(null, "", "/"); });

it("sends an admin without a POS session back to sales management", async () => {
  mocks.role = "admin";
  window.history.replaceState(null, "", "/pos");
  render(<RetailPosEntry />);

  await waitFor(() => expect(window.location.pathname).toBe("/ban-le"));
  expect(screen.queryByText("Chưa có phiên bán hàng")).toBeNull();
});

it("keeps the unopened-session message inside POS and permits POS-only staff to log out", async () => {
  render(<RetailPosEntry />);
  await screen.findByText("Chưa có phiên bán hàng");
  expect(screen.queryByTestId("pos")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(mocks.logout).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Màn quản lý" })).toBeNull();
});

it("refreshes on matching websocket events and reconnect, and removes POS after close", async () => {
  mocks.current.mockResolvedValue({ ...shift, operationalEndsAt: undefined });
  render(<RetailPosEntry />);
  await screen.findByTestId("pos");
  const count = mocks.current.mock.calls.length;
  act(() => mocks.listeners.get("pos:session:closed")?.({ companyCode: "C", branchId: "OTHER", terminalId: "T" }));
  expect(mocks.current).toHaveBeenCalledTimes(count);
  mocks.current.mockResolvedValue(null);
  act(() => mocks.listeners.get("pos:session:closed")?.({ companyCode: "C", branchId: "B", terminalId: "T" }));
  await screen.findByText("Chưa có phiên bán hàng");
  expect(screen.queryByTestId("pos")).toBeNull();
  mocks.current.mockResolvedValue({ ...shift, operationalEndsAt: undefined });
  act(() => mocks.listeners.get("connection")?.(true));
  await screen.findByTestId("pos");
});

it("refreshes at Vietnam midnight even when no websocket event arrives", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T16:59:59.000Z"));
  mocks.current.mockResolvedValueOnce(shift).mockResolvedValue(null);
  render(<RetailPosEntry />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByTestId("pos")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.queryByTestId("pos")).toBeNull();
  expect(screen.getByText("Chưa có phiên bán hàng")).toBeTruthy();
});
