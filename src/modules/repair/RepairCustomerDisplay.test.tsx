// @vitest-environment jsdom
vi.mock("../retail/hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "company-a", branchId: "branch-a" }, userProfile: { uid: "user-1" } }) }));
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketModal from "./TicketModal";
import CreateRepairModal from "./CreateRepairModal";
import { repairService, type RepairTicket } from "../../services/repairService";
import { customerApi } from "../customer-management/customerApi";

vi.mock("../../services/repairService", () => ({
  repairService: {
    create: vi.fn(),
    quote: vi.fn(),
    approveQuote: vi.fn(),
    pay: vi.fn(),
    cancel: vi.fn(),
    deliver: vi.fn(),
    parts: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../customer-management/customerApi", () => ({
  customerApi: {
    list: vi.fn(),
  },
}));

vi.mock("../partners/CollaboratorPicker", () => ({
  default: () => <div data-testid="collaborator-picker" />,
}));

vi.mock("./RepairTicketExtras", () => ({
  default: () => <div data-testid="repair-extras" />,
}));

afterEach(cleanup);

describe("Customer ID display in repair modals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseTicket: RepairTicket = {
    _id: "ticket-1",
    ticketCode: "WAR-2026-0001",
    status: "received",
    ticketType: "warranty",
    customerId: "6798e1f5c0988629f12ab56c", // Hex ObjectId
    customerName: "Nguyễn Văn A",
    customerPhone: "0901234567",
    device: {
      name: "iPhone 13 128GB",
      serialNumber: "356891234567890",
      condition: "Máy đẹp 99%",
      accessories: [],
    },
    coverage: {
      customer: { covered: true, daysLeft: 120 },
      supplier: { covered: false },
      costBearer: "shop",
      checkedAt: "2026-01-01",
    },
    symptom: "Lỗi camera trước",
    laborFee: 0,
    partCost: 0,
    discountAmount: 0,
    totalAmount: 0,
    paidAmount: 0,
    dueAmount: 0,
    paymentStatus: "unpaid",
    receivedAt: "2026-01-15T08:00:00.000Z",
  };

  it("TicketModal does NOT display raw 24-char hex ObjectId as customer code", async () => {
    vi.mocked(customerApi.list).mockResolvedValue({
      items: [
        {
          _id: "6798e1f5c0988629f12ab56c",
          customerCode: "KH-IGEN-000001",
          name: "Nguyễn Văn A",
          phone: "0901234567",
        } as any,
      ],
      total: 1,
      page: 1,
      limit: 1,
    });

    render(
      <TicketModal
        ticket={baseTicket}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    );

    // Raw hex ObjectId should NOT be visible anywhere on the screen
    expect(screen.queryByText(/6798e1f5c0988629f12ab56c/)).toBeNull();

    // Resolves and displays the friendly customer code
    await waitFor(() => {
      expect(screen.getByText("Mã: KH-IGEN-000001")).not.toBeNull();
    });
  });

  it("TicketModal displays customerCode directly when present on ticket", () => {
    const ticketWithCode: RepairTicket = {
      ...baseTicket,
      customerId: "6798e1f5c0988629f12ab56c",
      customerCode: "KH-000456",
    };

    render(
      <TicketModal
        ticket={ticketWithCode}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    );

    expect(screen.queryByText(/6798e1f5c0988629f12ab56c/)).toBeNull();
    expect(screen.getByText("Mã: KH-000456")).not.toBeNull();
  });

  it("CreateRepairModal filters out 24-char hex ObjectId from prefill", () => {
    render(
      <CreateRepairModal
        prefill={{
          ticketType: "warranty",
          customerId: "6798e1f5c0988629f12ab56c", // Hex ObjectId passed from warranty lookup
          customerName: "Nguyễn Văn A",
          customerPhone: "0901234567",
          productName: "iPhone 13 128GB",
          serialNumber: "356891234567890",
        }}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const customerIdInput = screen.getByPlaceholderText(
      /VD: KH-00124 \(tự tạo nếu trống\)/
    ) as HTMLInputElement;

    // Hex ObjectId should not be populated
    expect(customerIdInput.value).toBe("");
  });

  it("CreateRepairModal uses customerCode from prefill when available", () => {
    render(
      <CreateRepairModal
        prefill={{
          ticketType: "warranty",
          customerId: "6798e1f5c0988629f12ab56c",
          customerCode: "KH-000124",
          customerName: "Nguyễn Văn A",
          customerPhone: "0901234567",
          productName: "iPhone 13 128GB",
          serialNumber: "356891234567890",
        }}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const customerIdInput = screen.getByPlaceholderText(
      /VD: KH-00124 \(tự tạo nếu trống\)/
    ) as HTMLInputElement;

    expect(customerIdInput.value).toBe("KH-000124");
  });

  it("CreateRepairModal auto-fills customerCode when customer phone is matched", async () => {
    vi.mocked(customerApi.list).mockResolvedValue({
      items: [
        {
          _id: "cus-1",
          customerCode: "KH-000888",
          name: "Lê Thị B",
          phone: "0988776655",
        } as any,
      ],
      total: 1,
      page: 1,
      limit: 1,
    });

    const user = userEvent.setup();
    render(
      <CreateRepairModal
        prefill={{}}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const phoneInput = screen.getByPlaceholderText("VD: 0912 345 678");
    await user.type(phoneInput, "0988776655");

    await waitFor(() => {
      const customerIdInput = screen.getByPlaceholderText(
        /VD: KH-00124 \(tự tạo nếu trống\)/
      ) as HTMLInputElement;
      expect(customerIdInput.value).toBe("KH-000888");
    });
  });
});
