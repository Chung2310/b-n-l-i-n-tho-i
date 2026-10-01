import type { PipelineStage } from "mongoose";
import { RepairFeedbackModel } from "../repair-feedback.model";
import { RepairPartModel } from "../repair-part.model";
import { RepairTicketModel } from "../repair-ticket.model";
import { pausesSla, type RepairStatus } from "../repair-state";
import { repairCompletionFilter } from "./repair-completion";
import { verifiedRepairRefunds, repairRefundReportingNote } from "./repair-refunds";
import { financeToday } from "../../finance/services/financial-calculations";

export type RepairReportScope = { companyCode: string; branchId?: string };
export type RepairReportRange = { from: string; to: string };
export type RepairRevenueGroupBy = "branch" | "technician" | "day";

export function parseStartOfDay(dateStr: string): Date {
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dateStr);
  const normalized = hasZone
    ? dateStr
    : /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? `${dateStr}T00:00:00.000+07:00`
      : `${dateStr}+07:00`;
  return new Date(normalized);
}

export function parseEndOfDay(dateStr: string): Date {
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dateStr);
  const normalized = hasZone
    ? dateStr
    : /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? `${dateStr}T23:59:59.999+07:00`
      : `${dateStr}+07:00`;
  return new Date(normalized);
}

function reportDates(range: RepairReportRange) {
  const from = parseStartOfDay(range.from), to = parseEndOfDay(range.to);
  const validDay = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
    const date = new Date(value + "T00:00:00.000Z");
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  };
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || !validDay(range.from) || !validDay(range.to)) throw Object.assign(new Error("Khoảng thời gian không hợp lệ."), { statusCode: 400 });
  if (from > to) throw Object.assign(new Error("Ngày bắt đầu phải trước ngày kết thúc."), { statusCode: 400 });
  return { from, to };
}

function rangeMatch(scope: RepairReportScope, range: RepairReportRange): PipelineStage.Match {
  const { from, to } = reportDates(range);
  // Read-time fallback only: never backfill historical tickets from a report.
  return { $match: { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), ...repairCompletionFilter(from, to) } };
}

const groupKey: Record<RepairRevenueGroupBy, unknown> = {
  branch: "$branchId",
  technician: { $ifNull: ["$technicianId", ""] },
  day: { $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$completedAt", "$deliveredAt"] }, timezone: "+07:00" } },
};

export function buildRepairRevenuePipeline(scope: RepairReportScope, range: RepairReportRange, groupBy: RepairRevenueGroupBy = "branch"): PipelineStage[] {
  if (!["branch", "technician", "day"].includes(groupBy)) throw Object.assign(new Error("Cách nhóm báo cáo không hợp lệ."), { statusCode: 400 });
  const isWarranty = {
    $or: [
      { $eq: ["$ticketType", "warranty"] },
      { $ne: ["$coverage.costBearer", "customer"] },
    ],
  };
  const labor = { $ifNull: ["$laborFee", 0] }, parts = { $ifNull: ["$partRevenue", 0] }, total = { $ifNull: ["$totalAmount", 0] };
  const gross = { $add: [labor, parts] };
  // Same allocation and half-up rounding as the frozen commission policy.
  const netLabor = { $cond: [{ $gt: [gross, 0] }, { $floor: { $add: [0.5, { $divide: [{ $multiply: [labor, { $min: [gross, total] }] }, gross] }] } }, 0] };
  return [
    rangeMatch(scope, range),
    {
      $group: {
        _id: groupKey[groupBy],
        ticketCount: { $sum: 1 },
        warrantyTicketCount: { $sum: { $cond: [isWarranty, 1, 0] } },
        laborRevenue: { $sum: netLabor },
        partRevenue: { $sum: { $subtract: [total, netLabor] } },
        revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
        collected: { $sum: { $ifNull: ["$paidAmount", 0] } },
        outstanding: { $sum: { $ifNull: ["$dueAmount", 0] } },
        partCost: { $sum: { $ifNull: ["$partCost", 0] } },
        warrantyPartCost: { $sum: { $cond: [isWarranty, { $ifNull: ["$partCost", 0] }, 0] } },
        branchIds: { $addToSet: "$branchId" },
        technicianName: { $last: "$technicianName" },
      },
    },
    { $sort: { revenue: -1, _id: 1 } },
  ];
}

/** Cột giá vốn và lãi gộp là số nhạy cảm — chỉ trả cho người có repair:cost:read. */
function applyCostVisibility(rows: any[], includeCost: boolean) {
  return rows.map(({ _id, branchIds, partCost, warrantyPartCost, ...rest }) => ({
    key: String(_id ?? ""),
    ...(branchIds?.length === 1 ? { branchId: String(branchIds[0]) } : {}),
    ...rest,
    ...(includeCost ? { partCost, warrantyPartCost, grossProfit: Number(rest.revenue || 0) - Number(partCost || 0) } : {}),
  }));
}

export async function repairRevenueReport(scope: RepairReportScope, range: RepairReportRange, options: { groupBy?: RepairRevenueGroupBy; includeCost?: boolean } = {}) {
  const groupBy = options.groupBy || "branch";
  const rows: any[] = await RepairTicketModel.aggregate(buildRepairRevenuePipeline(scope, range, groupBy));
  const { from, to } = reportDates(range);
  for (const item of await verifiedRepairRefunds(scope, from, to)) {
    const key = groupBy === "branch" ? item.branchId : groupBy === "technician" ? (item.technicianId ?? "") : financeToday(item.refund.at);
    let row = rows.find(r => String(r._id ?? "") === String(key));
    if (!row) { row = { _id: key, branchIds: [], technicianName: item.technicianName, ticketCount: 0, warrantyTicketCount: 0, laborRevenue: 0, partRevenue: 0, revenue: 0, collected: 0, outstanding: 0, partCost: 0, warrantyPartCost: 0 }; rows.push(row); }
    if (!row.branchIds.includes(item.branchId)) row.branchIds.push(item.branchId);
    row.revenue -= item.refund.amount;
    row.collected -= item.refund.amount;
    row.laborRevenue -= item.refund.laborAmount;
    row.partRevenue -= item.refund.amount - item.refund.laborAmount;
  }
  rows.sort((a, b) => b.revenue - a.revenue || String(a._id).localeCompare(String(b._id)));
  const items = applyCostVisibility(rows, Boolean(options.includeCost));
  const total: any = items.reduce((sum, row) => ({
    ticketCount: sum.ticketCount + Number(row.ticketCount || 0),
    warrantyTicketCount: sum.warrantyTicketCount + Number(row.warrantyTicketCount || 0),
    laborRevenue: sum.laborRevenue + Number(row.laborRevenue || 0),
    partRevenue: sum.partRevenue + Number(row.partRevenue || 0),
    revenue: sum.revenue + Number(row.revenue || 0),
    collected: sum.collected + Number(row.collected || 0),
    outstanding: sum.outstanding + Number(row.outstanding || 0),
    ...(options.includeCost ? {
      partCost: (sum.partCost || 0) + Number(row.partCost || 0),
      warrantyPartCost: (sum.warrantyPartCost || 0) + Number(row.warrantyPartCost || 0),
      grossProfit: (sum.grossProfit || 0) + Number(row.grossProfit || 0),
    } : {}),
  }), {
    ticketCount: 0,
    warrantyTicketCount: 0,
    laborRevenue: 0,
    partRevenue: 0,
    revenue: 0,
    collected: 0,
    outstanding: 0,
    ...(options.includeCost ? { partCost: 0, warrantyPartCost: 0, grossProfit: 0 } : {}),
  });
  return { groupBy, range, items, total, notes: [repairRefundReportingNote] };
}

export function buildRepairPartUsagePipeline(scope: RepairReportScope, range: RepairReportRange): PipelineStage[] {
  const { from, to } = reportDates(range);
  return [
    { $match: { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: "issued", issuedAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { branchId: "$branchId", sku: "$sku" },
        productName: { $last: "$productName" },
        quantity: { $sum: "$quantity" },
        warrantyQuantity: { $sum: { $cond: [{ $eq: ["$chargeable", false] }, "$quantity", 0] } },
        cost: { $sum: { $multiply: ["$unitCost", "$quantity"] } },
        revenue: { $sum: { $cond: [{ $eq: ["$chargeable", false] }, 0, { $multiply: ["$unitPrice", "$quantity"] }] } },
      },
    },
    { $sort: { quantity: -1 } },
  ];
}

export async function repairPartUsageReport(scope: RepairReportScope, range: RepairReportRange) {
  const rows: any[] = await RepairPartModel.aggregate(buildRepairPartUsagePipeline(scope, range));
  return rows.map(({ _id, ...rest }) => ({ branchId: String(_id.branchId), sku: String(_id.sku), ...rest }));
}

/** Trừ các quãng chờ linh kiện / chờ nhà cung cấp khỏi thời gian sửa — lỗi không thuộc kỹ thuật viên. */
export function activeRepairMinutes(ticket: { receivedAt?: unknown; completedAt?: unknown; statusHistory?: Array<{ to: RepairStatus; at: unknown }> }): number {
  const start = ticket.receivedAt ? new Date(ticket.receivedAt as string).getTime() : NaN;
  const end = ticket.completedAt ? new Date(ticket.completedAt as string).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  let paused = 0;
  let pauseStart: number | undefined;
  for (const entry of ticket.statusHistory || []) {
    const at = new Date(entry.at as string).getTime();
    if (!Number.isFinite(at)) continue;
    if (pausesSla(entry.to)) { pauseStart ??= at; continue; }
    if (pauseStart !== undefined) { paused += Math.max(0, at - pauseStart); pauseStart = undefined; }
  }
  if (pauseStart !== undefined) paused += Math.max(0, end - pauseStart);
  return Math.round(Math.max(0, end - start - paused) / 60_000);
}

export async function repairTechnicianPerformanceReport(scope: RepairReportScope, range: RepairReportRange) {
  const tickets: any[] = await RepairTicketModel.find({
    ...rangeMatch(scope, range).$match,
    $and: [{ $or: [
      { technicianId: { $exists: true, $nin: [null, ""] } },
      { technicianName: { $exists: true, $nin: [null, ""] } },
    ] }],
  }).select("technicianId technicianName branchId receivedAt completedAt deliveredAt statusHistory totalAmount").lean();

  const ticketIds = tickets.map((ticket) => String(ticket._id));
  const feedbacks: any[] = await RepairFeedbackModel.find({ companyCode: scope.companyCode, ticketId: { $in: ticketIds } }).lean();
  const feedbackByTicket = new Map(feedbacks.map((item) => [String(item.ticketId), item]));

  const rows = new Map<string, any>();
  for (const ticket of tickets) {
    const key = String(ticket.technicianId || ticket.technicianName || "unknown");
    const name = String(ticket.technicianName || ticket.technicianId || "Chưa gán tên");
    const row = rows.get(key) || {
      technicianId: String(ticket.technicianId || key),
      technicianName: name,
      ticketCount: 0,
      revenue: 0,
      totalMinutes: 0,
      reworkCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      criteria: { skill: 0, attitude: 0, speed: 0 },
      criteriaCount: 0,
    };
    row.ticketCount += 1;
    row.revenue += Number(ticket.totalAmount || 0);
    row.totalMinutes += activeRepairMinutes({ ...ticket, completedAt: ticket.completedAt ?? ticket.deliveredAt });
    // Quay lại "repairing" sau khi đã "done" nghĩa là phải sửa lại.
    row.reworkCount += (ticket.statusHistory || []).filter((entry: any) => entry.from === "done" && entry.to === "repairing").length;
    const feedback = feedbackByTicket.get(String(ticket._id));
    if (feedback && feedback.branchId === ticket.branchId) {
      row.ratingSum += Number(feedback.rating || 0);
      row.ratingCount += 1;
      if (feedback.criteria) {
        row.criteria.skill += Number(feedback.criteria.skill || 0);
        row.criteria.attitude += Number(feedback.criteria.attitude || 0);
        row.criteria.speed += Number(feedback.criteria.speed || 0);
        row.criteriaCount += 1;
      }
    }
    rows.set(key, row);
  }

  const round = (value: number, count: number) => (count ? Math.round((value / count) * 10) / 10 : 0);
  return [...rows.values()].map((row) => ({
    technicianId: row.technicianId,
    technicianName: row.technicianName,
    ticketCount: row.ticketCount,
    revenue: row.revenue,
    averageMinutes: row.ticketCount ? Math.round(row.totalMinutes / row.ticketCount) : 0,
    reworkCount: row.reworkCount,
    reworkRate: row.ticketCount ? Math.round((row.reworkCount / row.ticketCount) * 1000) / 10 : 0,
    ratingCount: row.ratingCount,
    averageRating: round(row.ratingSum, row.ratingCount),
    criteria: {
      skill: round(row.criteria.skill, row.criteriaCount),
      attitude: round(row.criteria.attitude, row.criteriaCount),
      speed: round(row.criteria.speed, row.criteriaCount),
    },
  })).sort((a, b) => b.ticketCount - a.ticketCount);
}

export async function repairFeedbackSummaryReport(scope: RepairReportScope, range: RepairReportRange) {
  const { from, to } = reportDates(range);
  const rows: any[] = await RepairFeedbackModel.aggregate([
    { $match: { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), submittedAt: { $gte: from, $lte: to } } },
    { $group: { _id: { branchId: "$branchId", rating: "$rating" }, count: { $sum: 1 } } },
  ]);
  const byBranch = new Map<string, any>();
  for (const row of rows) {
    const branchId = String(row._id.branchId);
    const current = byBranch.get(branchId) || { branchId, count: 0, ratingSum: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    current.count += row.count;
    current.ratingSum += Number(row._id.rating) * row.count;
    current.distribution[row._id.rating] = row.count;
    byBranch.set(branchId, current);
  }
  return [...byBranch.values()].map(({ ratingSum, ...row }) => ({ ...row, averageRating: row.count ? Math.round((ratingSum / row.count) * 10) / 10 : 0 }));
}
