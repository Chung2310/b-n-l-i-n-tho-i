// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("../../services/repairService", () => ({
  repairService: { parts: vi.fn(async () => []), issuePart: vi.fn(), returnPart: vi.fn(), reconcilePart: vi.fn(), revokePartRequest: vi.fn() },
  repairExtras: {
    assignTechnician: vi.fn(),
    notifications: vi.fn(async () => []),
    resendNotification: vi.fn(),
    rate: vi.fn(),
  },
}));

vi.mock("../../services/authService", () => ({
  authService: { getColleagues: vi.fn(async () => []) },
}));

import RepairTicketExtras from "./RepairTicketExtras";
import type { RepairTicket } from "../../services/repairService";
import { repairService } from "../../services/repairService";

vi.mock("../retail/hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "company-a", branchId: "branch-a" }, userProfile: { uid: "user-1" } }) }));
beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key: string, _opts: any, fn: any) => fn({})) } }); });
afterEach(cleanup);

test("retains the exact issue request after a lost response and freezes new input", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const issue = vi.mocked(repairService.issuePart).mockReset().mockRejectedValue(new Error("Connection lost"));
  render(<RepairTicketExtras ticket={{ ...ticket, status: "repairing" }} onChanged={() => undefined} />);
  await user.click(screen.getByRole("checkbox", { name: /Linh kiện không có trong kho/ }));
  await user.type(screen.getByPlaceholderText(/Ốc vít, keo dán/), "Glue");
  const submit = () => screen.getByRole("button", { name: "Thêm linh kiện (không trừ kho)" });
  await user.click(submit());
  await screen.findByText("Connection lost");
  await user.click(screen.getByRole("button", { name: "Thử lại yêu cầu linh kiện" }));
  await waitFor(() => expect(issue).toHaveBeenCalledTimes(2));
  expect(issue.mock.calls[1][1].idempotencyKey).toBe(issue.mock.calls[0][1].idempotencyKey);
  expect(screen.queryByLabelText("Tăng số lượng")).toBeNull();
  expect(issue.mock.calls[1]).toEqual(issue.mock.calls[0]);
});

const ticket: RepairTicket = {
  _id: "repair-1", ticketCode: "REP-001", status: "diagnosing", customerId: "customer-1", customerName: "Khách hàng", customerPhone: "0900000000",
  device: { name: "Laptop", condition: "Tốt", accessories: [] }, coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: "2026-01-01" },
  symptom: "Không lên nguồn", laborFee: 0, partCost: 0, discountAmount: 0, totalAmount: 0, paidAmount: 0, dueAmount: 0, paymentStatus: "unpaid", receivedAt: "2026-01-01",
};

test("keeps notification controls responsive and touch-friendly inside the ticket modal", () => {
  render(<RepairTicketExtras ticket={ticket} onChanged={() => undefined} />);

  const resendReceived = screen.getByRole("button", { name: "1. Nhận máy" });
  expect(resendReceived).not.toBeNull();
  expect(resendReceived.className).toContain("min-h-9");
});

test("formats currency directly inside unitCost and unitPrice inputs and controls quantity with steppers", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const repairingTicket: RepairTicket = { ...ticket, status: "repairing" };

  render(<RepairTicketExtras ticket={repairingTicket} onChanged={() => undefined} />);

  // Check the manual checkbox to show the form fields
  const manualCheckbox = screen.getByRole("checkbox", {
    name: /Linh kiện không có trong kho/,
  });
  await user.click(manualCheckbox);

  // Enter part name to make form ready
  await user.type(screen.getByPlaceholderText(/Ốc vít, keo dán/), "màn hình zin");

  const costInput = screen.getByLabelText(/Giá vốn/) as HTMLInputElement;
  const priceInput = screen.getByLabelText(/Giá thu khách/) as HTMLInputElement;
  const qtyInput = screen.getByRole("spinbutton", { name: "Số lượng" }) as HTMLInputElement;

  // Verify steppers
  expect(qtyInput.value).toBe("1");
  await user.click(screen.getByLabelText("Tăng số lượng"));
  expect(qtyInput.value).toBe("2");
  await user.click(screen.getByLabelText("Giảm số lượng"));
  expect(qtyInput.value).toBe("1");

  // Type raw digits into Giá vốn and Giá thu khách -> formats directly inside
  await user.clear(costInput);
  await user.type(costInput, "150000");
  expect(costInput.value).toBe("150.000");

  await user.clear(priceInput);
  await user.type(priceInput, "250000");
  expect(priceInput.value).toBe("250.000");

  // Exterior badge next to label is not present
  const costDiv = screen.getByText("Giá vốn (VNĐ)").closest("div");
  expect(costDiv?.querySelector(".bg-slate-100.text-slate-700")).toBeNull();

  // Test quick 0đ buttons
  const zeroPriceBtn = screen.getByRole("button", { name: "0đ (Free / BH)" });
  await user.click(zeroPriceBtn);
  expect(priceInput.value).toBe("0");
});


test("hides direct part returns on completed tickets and restores them after reopening", async () => {
  vi.mocked(repairService.parts).mockResolvedValue([{ _id: "part-1", sku: "PART", productName: "Screen", quantity: 1, unitCost: 100, unitPrice: 200, lineTotal: 200, status: "issued", issuedAt: "2026-09-30", issuedByName: "Staff" }]);
  const view = render(<RepairTicketExtras ticket={{ ...ticket, status: "done" }} onChanged={() => undefined} />);
  await screen.findByText("Screen"); expect(screen.queryByRole("button", { name: "Hoàn" })).toBeNull();
  view.rerender(<RepairTicketExtras ticket={{ ...ticket, status: "delivered" }} onChanged={() => undefined} />);
  expect(screen.queryByRole("button", { name: "Hoàn" })).toBeNull();
  view.rerender(<RepairTicketExtras ticket={{ ...ticket, status: "repairing" }} onChanged={() => undefined} />);
  expect(screen.getByRole("button", { name: "Hoàn" })).toBeTruthy();
});


test("recovers a pending return on a closed ticket and reconciles without reposting", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const key = 'repair-part-pending:v1:' + JSON.stringify(["company-a", "branch-a", "user-1", ticket._id]);
  localStorage.setItem(key, JSON.stringify({ kind: "return", partId: "part-1", reason: "unused" }));
  vi.mocked(repairService.reconcilePart).mockResolvedValueOnce({ status: "completed", partId: "part-1", message: "ok" });
  const done = vi.fn(); render(<RepairTicketExtras ticket={{ ...ticket, status: "done" }} onChanged={done} />);
  expect(screen.getByText("unused")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Đối chiếu linh kiện" }));
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull()); expect(done).toHaveBeenCalledOnce(); expect(repairService.returnPart).not.toHaveBeenCalled();
});

test("keeps a corrupt stored part request blocked even on an issuable ticket", () => {
  localStorage.setItem('repair-part-pending:v1:' + JSON.stringify(["company-a", "branch-a", "user-1", ticket._id]), "null");
  render(<RepairTicketExtras ticket={{ ...ticket, status: "repairing" }} onChanged={() => undefined} />);
  expect(screen.getByRole("alert")).toBeTruthy(); expect(screen.queryByRole("checkbox", { name: /Linh kiện không có trong kho/ })).toBeNull();
});


test("revokes an old return and creates a fresh key when entering a corrected return", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const key = 'repair-part-pending:v1:' + JSON.stringify(["company-a", "branch-a", "user-1", ticket._id]);
  localStorage.setItem(key, JSON.stringify({ kind: "return", partId: "part-1", reason: "wrong" }));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true), prompt = vi.spyOn(window, "prompt").mockReturnValue("corrected");
  vi.mocked(repairService.parts).mockResolvedValue([{ _id: "part-1", productName: "Part", sku: "PART", quantity: 1, unitCost: 10, unitPrice: 20, lineTotal: 20, chargeable: true, billing: "customer", status: "issued" }] as any);
  vi.mocked(repairService.revokePartRequest).mockResolvedValueOnce({ status: "revoked", message: "ok" });
  vi.mocked(repairService.returnPart).mockClear().mockResolvedValueOnce({});
  vi.mocked(repairService.reconcilePart).mockResolvedValueOnce({ status: "completed", partId: "part-1", message: "ok" });
  render(<RepairTicketExtras ticket={{ ...ticket, status: "repairing" }} onChanged={() => undefined} />);
  await user.click(screen.getByRole("button", { name: "Hủy yêu cầu linh kiện" }));
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  const button = screen.getByRole("button", { name: /Hoàn/ }); await user.click(button);
  await waitFor(() => expect(repairService.returnPart).toHaveBeenCalledOnce());
  expect(vi.mocked(repairService.returnPart).mock.calls[0]).toEqual([ticket._id, "part-1", "corrected", { companyCode: "company-a", branchId: "branch-a" }, expect.stringMatching(/^[0-9a-f-]{36}$/)]);
  confirm.mockRestore(); prompt.mockRestore(); vi.mocked(repairService.parts).mockResolvedValue([]);
});
