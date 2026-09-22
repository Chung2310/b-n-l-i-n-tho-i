import { beforeEach, describe, expect, test, vi } from "vitest";

const mockSave = vi.fn();
const mockTicketInstance = {
  save: mockSave,
  toObject: function () {
    return { ...this };
  },
};

const mockFindOneSettings = vi.fn();
const mockFindOneSerial = vi.fn();

class MockRepairTicket {
  constructor(doc: any) {
    Object.assign(this, doc);
  }
  async save() {
    mockSave(this);
    return {
      toObject: () => ({ ...this, _id: "new-ticket-id" }),
    };
  }
}

vi.mock("./repair-ticket.model", () => ({
  RepairTicketModel: MockRepairTicket,
}));

vi.mock("./repair-settings.model", () => ({
  RepairSettingsModel: {
    findOne: (...args: any[]) => ({
      lean: async () => mockFindOneSettings(...args),
    }),
  },
}));

vi.mock("../inventory/serials/serial-unit.model", () => ({
  SerialUnitModel: {
    findOne: (...args: any[]) => ({
      lean: async () => mockFindOneSerial(...args),
    }),
    findOneAndUpdate: async () => null,
  },
}));

vi.mock("./services/repair-notify.service", () => ({
  dispatchRepairNotification: async () => undefined,
}));

vi.mock("./services/repair-events", () => ({
  publishRepairTicketEvent: async () => undefined,
}));

const { createRepairTicket } = await import("./repair-ticket.service");

const scope = { companyCode: "COMPANY-A", branchId: "BRANCH-1" };
const actor = { id: "user-1", name: "Nhân viên A" };

describe("createRepairTicket - Warranty vs Service split", () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockFindOneSettings.mockReset();
    mockFindOneSerial.mockReset();
  });

  test("tạo phiếu bảo hành (warranty) bắt buộc IMEI và phải là máy đã bán", async () => {
    // Không có IMEI
    await expect(
      createRepairTicket(
        scope,
        {
          ticketType: "warranty",
          ticketCode: "REP-01",
          customerId: "CUST-1",
          customerName: "Nguyễn Văn A",
          customerPhone: "0901234567",
          device: { name: "iPhone 13", condition: "Xước nhẹ", accessories: [], imeiVerified: false },
          symptom: "Lỗi nguồn",
        } as any,
        actor
      )
    ).rejects.toMatchObject({ code: "REPAIR_SERIAL_REQUIRED" });

    // Có IMEI nhưng chưa bán
    mockFindOneSerial.mockReturnValue(null);
    await expect(
      createRepairTicket(
        scope,
        {
          ticketType: "warranty",
          ticketCode: "REP-01",
          customerId: "CUST-1",
          customerName: "Nguyễn Văn A",
          customerPhone: "0901234567",
          device: { serialNumber: "IMEI12345", name: "iPhone 13", condition: "Xước nhẹ", accessories: [], imeiVerified: true },
          symptom: "Lỗi nguồn",
        } as any,
        actor
      )
    ).rejects.toMatchObject({ code: "REPAIR_SERIAL_NOT_SOLD" });

    // Có IMEI và đã bán -> thành công
    mockFindOneSerial.mockReturnValue({ _id: "serial-1", serialNumber: "IMEI12345", status: "sold" });
    const saved = await createRepairTicket(
      scope,
      {
        ticketType: "warranty",
        ticketCode: "REP-01",
        customerId: "CUST-1",
        customerName: "Nguyễn Văn A",
        customerPhone: "0901234567",
        device: { serialNumber: "IMEI12345", name: "iPhone 13", condition: "Xước nhẹ", accessories: [], imeiVerified: true },
        symptom: "Lỗi nguồn",
      } as any,
      actor
    );

    expect(saved.ticketType).toBe("warranty");
    expect(saved.device.serialNumber).toBe("IMEI12345");
  });

  test("tạo phiếu sửa chữa dịch vụ (service) không cần IMEI", async () => {
    const saved = await createRepairTicket(
      scope,
      {
        ticketType: "service",
        ticketCode: "REP-02",
        customerId: "GUEST-1",
        customerName: "Khách Vãng Lai",
        customerPhone: "0987654321",
        device: { name: "Samsung S21", condition: "Vỡ màn hình", accessories: [], imeiVerified: false },
        symptom: "Thay màn hình",
      } as any,
      actor
    );

    expect(saved.ticketType).toBe("service");
    expect(saved.coverage.costBearer).toBe("customer");
  });

  test("tạo phiếu sửa chữa dịch vụ có IMEI của máy hệ thống -> tự áp dụng ưu đãi khách quen", async () => {
    mockFindOneSerial.mockReturnValue({ _id: "serial-sys", serialNumber: "SYS-SN-999" });
    mockFindOneSettings.mockReturnValue({ loyaltyDiscountRate: 15 });

    const saved = await createRepairTicket(
      scope,
      {
        ticketType: "service",
        ticketCode: "REP-03",
        customerId: "CUST-VIP",
        customerName: "Khách Quen",
        customerPhone: "0912345678",
        device: { serialNumber: "SYS-SN-999", name: "iPhone 14 Pro", condition: "Chai pin", accessories: [], imeiVerified: true },
        symptom: "Thay pin",
      } as any,
      actor
    );

    expect(saved.ticketType).toBe("service");
    expect(saved.loyaltyDiscount).toMatchObject({
      rate: 15,
      reason: "Khách mua máy tại hệ thống",
    });
  });
});
