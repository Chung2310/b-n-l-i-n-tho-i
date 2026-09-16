import { CommissionLedgerModel } from "../modules/partners/partner.models";
import { StockLogModel } from "../model/stock-log.model";
import { PayrollPaymentModel } from "../model/payroll-payment.model";
import { OperatingExpenseModel } from "../model/operating-expense.model";
import { BranchModel } from "../model/branch.model";

export interface AnalyticsScope { companyCode?: string; branchId?: string; courseId?: string; }
export type RevenueGranularity = "day" | "week" | "month";
export interface RevenueRange { from: Date; to: Date; granularity: RevenueGranularity; }
export interface RevenueBucket { bucket: string; amount: number; count: number; tuitionAmount: number; tuitionCount: number; goodsAmount: number; goodsCount: number; }
export interface GoodsCategoryBreakdown { category: string; revenue: number; grossProfit: number | null; quantity: number; }
export interface RevenueSourceStatus { key: "tuition" | "goods"; label: string; available: boolean; blockedReason?: string; excludedRecords?: number; }
export interface RetailAnalyticsReconciliation { retailNetSales: number; analyticsNetSales: number; difference: number; matched: boolean; }
export function reconcileRetailAnalyticsRevenue(retail: { netSales: number }, analytics: { goodsTotal: number }): RetailAnalyticsReconciliation { const retailNetSales = Number(retail.netSales || 0); const analyticsNetSales = Number(analytics.goodsTotal || 0); const difference = retailNetSales - analyticsNetSales; return { retailNetSales, analyticsNetSales, difference, matched: difference === 0 }; }

const BUCKET_FORMAT: Record<RevenueGranularity, string> = { day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m" };
function scopeQuery(scope: AnalyticsScope) { return { ...(scope.companyCode ? { companyCode: scope.companyCode } : {}), ...(scope.branchId ? { branchId: scope.branchId } : {}) }; }
function zeroReceivables(asOf: Date) { return { asOf: asOf.toISOString(), total: 0, count: 0, aging: ["notScheduled", "notDue", "0-30", "31-60", "60+"].map((bucket) => ({ bucket, amount: 0, count: 0 })), agingBasis: "dueAt" as const, currency: "VND" }; }

export const analyticsService = {
  async getTuitionRevenue(_scope: AnalyticsScope, range: RevenueRange) { return this.getCombinedRevenue({}, range); },
  async getCombinedRevenue(scope: AnalyticsScope, range: RevenueRange) {
    const query = { ...scopeQuery(scope), type: "xuất", purpose: "bán", createdAt: { $gte: range.from, $lte: range.to } };
    const rows = await StockLogModel.aggregate([
      { $match: query }, { $unwind: "$items" },
      { $match: { "items.lineTotal": { $type: "number" } } },
      { $group: { _id: { $dateToString: { format: BUCKET_FORMAT[range.granularity], date: "$createdAt", timezone: "UTC" } }, amount: { $sum: "$items.lineTotal" }, count: { $sum: 1 }, cost: { $sum: { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] } } } },
      { $sort: { _id: 1 } },
    ]);
    const series: RevenueBucket[] = rows.map((row: any) => ({ bucket: row._id, amount: Number(row.amount || 0), count: Number(row.count || 0), tuitionAmount: 0, tuitionCount: 0, goodsAmount: Number(row.amount || 0), goodsCount: Number(row.count || 0) }));
    const goodsTotal = series.reduce((sum, row) => sum + row.goodsAmount, 0);
    const cost = rows.reduce((sum: number, row: any) => sum + Number(row.cost || 0), 0);
    return { range: { from: range.from.toISOString(), to: range.to.toISOString(), granularity: range.granularity }, total: goodsTotal, tuitionTotal: 0, goodsTotal, previousTotal: 0, growthPct: null, series, goodsGrossProfit: goodsTotal - cost, goodsBreakdown: [], excludedRecords: 0, excludedGoodsLines: 0, excludedCostLines: 0, excludedUnclassifiedStockOut: 0, currency: "VND" };
  },
  async getReceivables(_scope: AnalyticsScope, asOf: Date) { return zeroReceivables(asOf); },
  async getExpenses(scope: AnalyticsScope, range: RevenueRange) {
    const query = { ...scopeQuery(scope), status: "confirmed", paymentDate: { $gte: range.from, $lte: range.to } };
    const payrollRows = await PayrollPaymentModel.aggregate([{ $match: query }, { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } }]);
    const operatingRows = await OperatingExpenseModel.aggregate([{ $match: { ...scopeQuery(scope), status: "confirmed", incurredOn: { $gte: range.from, $lte: range.to } } }, { $group: { _id: "$category", amount: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]);
    const commissionRows = await CommissionLedgerModel.aggregate([{ $match: { ...scopeQuery(scope), kind: "payout", createdAt: { $gte: range.from, $lte: range.to } } }, { $group: { _id: null, amount: { $sum: { $multiply: ["$amount", -1] } }, count: { $sum: 1 } } }]);
    const commission = { amount: Number(commissionRows[0]?.amount || 0), count: Number(commissionRows[0]?.count || 0) };
    const payroll = payrollRows[0] || {}; const operatingAmount = operatingRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    return { range: { from: range.from.toISOString(), to: range.to.toISOString() }, total: Number(payroll.amount || 0) + operatingAmount + commission.amount, payroll: { amount: Number(payroll.amount || 0), count: Number(payroll.count || 0) }, commission, operating: { amount: operatingAmount, count: operatingRows.reduce((sum: number, row: any) => sum + Number(row.count || 0), 0) }, operatingByCategory: operatingRows.map((row: any) => ({ category: row._id, amount: Number(row.amount || 0), count: Number(row.count || 0) })), excludedCommissionRecords: 0, currency: "VND" };
  },
  async getProfitAndLoss(scope: AnalyticsScope, range: RevenueRange) { const [revenue, expenses] = await Promise.all([this.getCombinedRevenue(scope, range), this.getExpenses(scope, range)]); return { range: revenue.range, revenue: revenue.total, tuitionRevenue: 0, goodsRevenue: revenue.goodsTotal, goodsGrossProfit: revenue.goodsGrossProfit, payrollExpense: expenses.payroll.amount, commissionExpense: expenses.commission.amount, generalOperatingExpense: expenses.operating.amount, totalOperatingExpenses: expenses.total, operatingResult: revenue.goodsGrossProfit - expenses.total, excludedCostLines: revenue.excludedCostLines, excludedCommissionRecords: 0, currency: "VND" }; },
  async getMeta(scope: AnalyticsScope) {
    const [stockOutTotal, stockOutPriced, branches] = await Promise.all([StockLogModel.countDocuments({ ...scopeQuery(scope), type: "xuất" }), StockLogModel.countDocuments({ ...scopeQuery(scope), type: "xuất", "items.unitPrice": { $exists: true } }), BranchModel.find({ ...(scope.companyCode ? { companyCode: scope.companyCode } : {}), isActive: true }).select("_id code name").sort({ name: 1 }).lean()]);
    return { sources: [{ key: "tuition" as const, label: "Doanh thu đào tạo (đã tắt)", available: false, blockedReason: "Module đã được gỡ khỏi hệ thống." }, { key: "goods" as const, label: "Bán hàng từ kho", available: true, excludedRecords: stockOutTotal - stockOutPriced }], grossProfitAvailable: true, currency: "VND", filters: { branches: branches.map((branch: any) => ({ id: String(branch._id), code: branch.code, name: branch.name })), courses: [] } };
  },
};