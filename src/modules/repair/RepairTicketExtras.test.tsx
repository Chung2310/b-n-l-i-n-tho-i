// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../services/repairService", () => ({
  repairService: { parts: vi.fn(async () => []), issuePart: vi.fn() },
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

afterEach(cleanup);

test("retains the issue key after a lost response and changes it for a different request", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const issue = vi.mocked(repairService.issuePart).mockReset().mockRejectedValue(new Error("Connection lost"));
  render(<RepairTicketExtras ticket={{ ...ticket, status: "repairing" }} onChanged={() => undefined} />);
  await user.click(screen.getByRole("checkbox", { name: /Linh kiện không có trong kho/ }));
  await user.type(screen.getByPlaceholderText(/Ốc vít, keo dán/), "Glue");
  const submit = () => screen.getByRole("button", { name: "Thêm linh kiện (không trừ kho)" });
  await user.click(submit());
  await screen.findByText("Connection lost");
  await user.click(submit());
  await waitFor(() => expect(issue).toHaveBeenCalledTimes(2));
  expect(issue.mock.calls[1][1].idempotencyKey).toBe(issue.mock.calls[0][1].idempotencyKey);
  await user.click(screen.getByLabelText("Tăng số lượng"));
  await user.click(submit());
  await waitFor(() => expect(issue).toHaveBeenCalledTimes(3));
  expect(issue.mock.calls[2][1].idempotencyKey).not.toBe(issue.mock.calls[0][1].idempotencyKey);
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

