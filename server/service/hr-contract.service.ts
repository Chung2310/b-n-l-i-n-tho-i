import { HRContractModel } from "../model/hr-contract.model";

const DAY_MS = 86_400_000;

export function canReceiveContractExpiryAlerts(role: string): boolean {
  return role === "admin" || role === "branch_owner";
}

export function daysUntilContractExpiry(endDate: Date | string, now = new Date()): number {
  const expiry = new Date(endDate);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return Math.round((expiryUtc - todayUtc) / DAY_MS);
}

export const hrContractService = {
  async updateExpiredStatus(companyCode: string): Promise<void> {
    await HRContractModel.updateMany(
      { companyCode, status: "active", endDate: { $lt: new Date() } },
      { $set: { status: "expired" } },
    );
  },

  async list(params: {
    companyCode: string;
    branchId?: string;
    employeeId?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { companyCode, branchId, employeeId, search, page, limit } = params;
    const query: any = { companyCode };
    if (branchId) query.branchId = branchId;
    if (employeeId) query.employeeId = employeeId;

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { employeeName: { $regex: cleanSearch, $options: "i" } },
        { contractType: { $regex: cleanSearch, $options: "i" } },
        { note: { $regex: cleanSearch, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      HRContractModel.find(query)
        .sort({ endDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HRContractModel.countDocuments(query),
    ]);

    return {
      contracts,
      total,
      page,
      limit,
    };
  },

  async listExpiryAlerts(params: {
    companyCode: string;
    branchId?: string;
    employeeId?: string;
    now?: Date;
    limit?: number;
  }) {
    const now = params.now || new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfReminderWindow = new Date(startOfToday);
    endOfReminderWindow.setDate(endOfReminderWindow.getDate() + 7);
    endOfReminderWindow.setHours(23, 59, 59, 999);

    const query: Record<string, unknown> = {
      companyCode: params.companyCode,
      status: "active",
      endDate: { $gte: startOfToday, $lte: endOfReminderWindow },
    };
    if (params.branchId) query.branchId = params.branchId;
    if (params.employeeId) query.employeeId = params.employeeId;

    const contracts = await HRContractModel.find(query)
      .select("_id contractType employeeId employeeName endDate")
      .sort({ endDate: 1 })
      .limit(Math.max(1, Math.min(params.limit || 20, 100)))
      .lean();

    return contracts.map((contract: any) => {
      const daysRemaining = daysUntilContractExpiry(contract.endDate, now);
      return {
        id: String(contract._id),
        contractType: contract.contractType,
        employeeId: contract.employeeId,
        employeeName: contract.employeeName,
        endDate: contract.endDate,
        daysRemaining,
        reminderDays: daysRemaining <= 3 ? 3 as const : 7 as const,
      };
    });
  },
};
