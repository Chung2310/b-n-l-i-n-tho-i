// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RetailPosEntry from "./RetailPosEntry";
const mocks = vi.hoisted(() => ({ current: vi.fn(), open: vi.fn(), close: vi.fn(), logout: vi.fn(), listeners: new Map<string, (event: any) => void>() }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "pos_cashier", displayName: "Thu ngân" }, logout: mocks.logout }) }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "C", branchId: "B", terminalId: "T" }, branchName: "Chi nhánh" }) }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { current: mocks.current, open: mocks.open, close: mocks.close } }));
vi.mock("./RetailPosPage", () => ({ default: ({ posSessionId }: any) => <div data-testid="pos">{posSessionId}</div> }));
vi.mock("../../../services/socketService", () => ({ socketService: {
  on: (event: string, callback: (event: any) => void) => { mocks.listeners.set(event, callback); return () => mocks.listeners.delete(event); },
  onStatusChange: (callback: any) => { mocks.listeners.set("connection", callback); return () => mocks.listeners.delete("connection"); },
} }));
const shift = { _id: "s1", shiftCode: "POS-1", status: "open", businessDate: "2026-10-07", operationalEndsAt: "2026-10-07T16:59:59.999Z" };
beforeEach(() => { vi.clearAllMocks(); mocks.listeners.clear(); mocks.current.mockResolvedValue(null); mocks.logout.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("shows a session gate, opens manually, and permits POS-only staff to log out", async () => {
  mocks.open.mockResolvedValue({ ...shift, operationalEndsAt: undefined });
  render(<RetailPosEntry />);
  await screen.findByText("Chưa mở phiên POS");
  expect(screen.queryByTestId("pos")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Mở phiên và vào POS" }));
  expect((await screen.findByTestId("pos")).textContent).toBe("s1");
  expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ terminalId: "T" }), { openingFloat: 0, terminalId: "T" });
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(mocks.logout).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Màn quản lý" })).toBeNull();
});

it("refreshes on matching websocket events and reconnect, and removes POS after close", async () => {
  mocks.current.mockResolvedValue({ ...shift, operationalEndsAt: undefined });
  render(<RetailPosEntry />);
  await screen.findByTestId("pos");
  const count = mocks.current.mock.calls.length;
  act(() => mocks.listeners.get("pos:session:closed")?.({ branchId: "OTHER", terminalId: "T" }));
  expect(mocks.current).toHaveBeenCalledTimes(count);
  mocks.current.mockResolvedValue(null);
  act(() => mocks.listeners.get("pos:session:closed")?.({ branchId: "B", terminalId: "T" }));
  await screen.findByText("Chưa mở phiên POS");
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
  expect(screen.getByText("Chưa mở phiên POS")).toBeTruthy();
});
