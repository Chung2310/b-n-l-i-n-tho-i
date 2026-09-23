import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  select: vi.fn(),
  sort: vi.fn(),
  limit: vi.fn(),
  lean: vi.fn(),
}));

vi.mock("../model/hr-contract.model", () => ({
  HRContractModel: {
    find: mocks.find,
  },
}));

import {
  canReceiveContractExpiryAlerts,
  daysUntilContractExpiry,
  hrContractService,
} from "./hr-contract.service";

describe("HR contract expiry reminders", () => {
  const now = new Date("2026-09-22T10:00:00+07:00");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ sort: mocks.sort });
    mocks.sort.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockReturnValue({ lean: mocks.lean });
    mocks.lean.mockResolvedValue([]);
  });

  it("only enables dashboard reminders for admins and branch owners", () => {
    expect(canReceiveContractExpiryAlerts("admin")).toBe(true);
    expect(canReceiveContractExpiryAlerts("branch_owner")).toBe(true);
    expect(canReceiveContractExpiryAlerts("manager")).toBe(false);
    expect(canReceiveContractExpiryAlerts("user")).toBe(false);
  });

  it("calculates the 7-day reminder boundary by calendar day", () => {
    expect(daysUntilContractExpiry("2026-09-29T00:00:00.000Z", now)).toBe(7);
  });

  it("calculates the 3-day reminder boundary by calendar day", () => {
    expect(daysUntilContractExpiry("2026-09-25T00:00:00.000Z", now)).toBe(3);
  });

  it("queries active contracts within seven days for the selected branch", async () => {
    mocks.lean.mockResolvedValue([{
      _id: "contract-1",
      contractType: "Hợp đồng chính thức",
      employeeId: "employee-1",
      employeeName: "ABC",
      endDate: new Date("2026-09-25T00:00:00.000Z"),
    }]);

    const result = await hrContractService.listExpiryAlerts({
      companyCode: "ACME",
      branchId: "branch-1",
      now,
    });

    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME",
      branchId: "branch-1",
      status: "active",
      endDate: expect.objectContaining({
        $gte: expect.any(Date),
        $lte: expect.any(Date),
      }),
    }));
    expect(result).toEqual([expect.objectContaining({
      id: "contract-1",
      employeeName: "ABC",
      daysRemaining: 3,
      reminderDays: 3,
    })]);
  });
});
