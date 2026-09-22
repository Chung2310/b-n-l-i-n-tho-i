import { describe, expect, it, beforeEach, vi } from "vitest";
import { CustomerPointService } from "./customer-point.service";
import { CustomerModel } from "../models/customer.model";
import { CustomerPointLedgerModel } from "../models/customer-point-ledger.model";
import { CustomerSettingsService } from "./customer-settings.service";

describe("CustomerPointService - Sổ Cái & Vòng Đời Điểm Thưởng", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("tự động tích điểm từ đơn bán lẻ: cộng vào số dư và ghi sổ cái bất biến", async () => {
    const mockCustomer = {
      _id: "cust-1",
      companyCode: "IGEN",
      pointsBalance: 50,
      totalPointsEarned: 100,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(CustomerSettingsService, "getSettings").mockResolvedValue({
      companyCode: "IGEN",
      customerTiers: [],
      pointsPolicy: {
        enabled: true,
        grossProfitPerPoint: 10000,
        pointRedeemValue: 1000,
        maxRedeemPercent: 50,
        minOrderTotalForRedeem: 50000,
        allowRepairRedeem: true,
        allowRetailRedeem: true,
      },
    });

    vi.spyOn(CustomerPointLedgerModel, "findOne").mockReturnValue({
      session: vi.fn().mockResolvedValue(null),
    } as any);

    vi.spyOn(CustomerModel, "findOne").mockReturnValue({
      session: vi.fn().mockResolvedValue(mockCustomer),
    } as any);

    const ledgerSaveSpy = vi.spyOn(CustomerPointLedgerModel.prototype, "save").mockResolvedValue({} as any);

    // Mua 5 củ sạc lãi 750k -> tích 75 điểm
    const result = await CustomerPointService.earnPoints({
      companyCode: "IGEN",
      customerId: "cust-1",
      points: 75,
      sourceType: "retail_order",
      sourceId: "order-101",
      sourceCode: "HD-101",
      reason: "Tích điểm đơn hàng HD-101",
    });

    expect(mockCustomer.pointsBalance).toBe(125); // 50 + 75
    expect(mockCustomer.totalPointsEarned).toBe(175); // 100 + 75
    expect(mockCustomer.save).toHaveBeenCalled();
    expect(ledgerSaveSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result?.points).toBe(75);
    expect(result?.balanceBefore).toBe(50);
    expect(result?.balanceAfter).toBe(125);
  });

  it("chống tích trùng lặp: bỏ qua nếu đơn hàng đã được tích điểm trước đó", async () => {
    vi.spyOn(CustomerSettingsService, "getSettings").mockResolvedValue({
      companyCode: "IGEN",
      customerTiers: [],
      pointsPolicy: { enabled: true } as any,
    });

    const existingLedger = {
      _id: "led-1",
      points: 75,
      toObject: () => ({ _id: "led-1", points: 75 }),
    };

    vi.spyOn(CustomerPointLedgerModel, "findOne").mockReturnValue({
      session: vi.fn().mockResolvedValue(existingLedger),
    } as any);

    const customerFindSpy = vi.spyOn(CustomerModel, "findOne");

    const result = await CustomerPointService.earnPoints({
      companyCode: "IGEN",
      customerId: "cust-1",
      points: 75,
      sourceType: "retail_order",
      sourceId: "order-101",
      reason: "Tích điểm đơn hàng",
    });

    expect(customerFindSpy).not.toHaveBeenCalled();
    expect(result?.points).toBe(75);
  });

  it("tiêu điểm cấn trừ tiền: trừ số dư, tăng totalPointsRedeemed và ghi sổ cái điểm âm", async () => {
    const mockCustomer = {
      _id: "cust-1",
      companyCode: "IGEN",
      pointsBalance: 150,
      totalPointsRedeemed: 50,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(CustomerModel, "findOne").mockReturnValue({
      session: vi.fn().mockResolvedValue(mockCustomer),
    } as any);

    vi.spyOn(CustomerPointLedgerModel.prototype, "save").mockResolvedValue({} as any);

    // Tiêu 100 điểm = 100k
    const result = await CustomerPointService.redeemPoints({
      companyCode: "IGEN",
      customerId: "cust-1",
      points: 100,
      sourceType: "retail_order",
      sourceId: "order-102",
      sourceCode: "HD-102",
      reason: "Cấn trừ 100 điểm cho đơn HD-102",
      actor: { id: "user-1", name: "Thu ngân A" },
    });

    expect(mockCustomer.pointsBalance).toBe(50); // 150 - 100
    expect(mockCustomer.totalPointsRedeemed).toBe(150); // 50 + 100
    expect(result.points).toBe(-100);
    expect(result.balanceBefore).toBe(150);
    expect(result.balanceAfter).toBe(50);
  });

  it("chặn tiêu điểm vượt quá số dư của khách hàng", async () => {
    const mockCustomer = {
      _id: "cust-1",
      companyCode: "IGEN",
      pointsBalance: 30, // Khách chỉ có 30 điểm
      save: vi.fn(),
    };

    vi.spyOn(CustomerModel, "findOne").mockReturnValue({
      session: vi.fn().mockResolvedValue(mockCustomer),
    } as any);

    await expect(
      CustomerPointService.redeemPoints({
        companyCode: "IGEN",
        customerId: "cust-1",
        points: 50, // Yêu cầu tiêu 50 điểm
        sourceType: "retail_order",
        sourceId: "order-103",
        reason: "Tiêu điểm",
      })
    ).rejects.toThrow(/Số dư điểm không đủ/);
  });

  it("quản lý cấp điểm thủ công (sinh nhật / đền bù) yêu cầu lý do giải trình", async () => {
    const mockCustomer = {
      _id: "cust-1",
      companyCode: "IGEN",
      pointsBalance: 10,
      totalPointsEarned: 10,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(CustomerModel, "findOne").mockResolvedValue(mockCustomer as any);
    vi.spyOn(CustomerPointLedgerModel.prototype, "save").mockResolvedValue({} as any);

    // Cấp 50 điểm sinh nhật
    const result = await CustomerPointService.grantManualPoints({
      companyCode: "IGEN",
      customerId: "cust-1",
      points: 50,
      reasonCategory: "birthday",
      reason: "Quà tặng sinh nhật thành viên VIP",
      actor: { id: "mgr-1", name: "Quản lý Chi nhánh" },
    });

    expect(mockCustomer.pointsBalance).toBe(60);
    expect(result.type).toBe("MANUAL_GRANT");
    expect(result.points).toBe(50);
    expect(result.reasonCategory).toBe("birthday");
  });

  it("chặn cấp điểm thủ công nếu không nhập lý do", async () => {
    await expect(
      CustomerPointService.grantManualPoints({
        companyCode: "IGEN",
        customerId: "cust-1",
        points: 50,
        reasonCategory: "birthday",
        reason: "", // Lý do rỗng
        actor: { id: "mgr-1", name: "Quản lý" },
      })
    ).rejects.toThrow(/Vui lòng nhập lý do/);
  });
});
