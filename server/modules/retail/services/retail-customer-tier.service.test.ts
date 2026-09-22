import assert from "node:assert/strict";
import { test } from "vitest";
import * as tierService from "./retail-customer-tier.service";

test("builds company-wide order filters for all tier evaluation windows", () => {
  const build = (tierService as any).buildTierSalesFilter;
  assert.deepEqual(build("ACME", "c1", { type: "lifetime" }, new Date("2026-08-12T00:00:00Z")), { companyCode: "ACME", customerId: "c1", status: { $in: ["confirmed", "completed"] } });
  assert.deepEqual(build("ACME", "c1", { type: "rolling12Months" }, new Date("2026-08-12T00:00:00Z")).businessDate, { $gte: "2025-08-12", $lte: "2026-08-12" });
  assert.deepEqual(build("ACME", "c1", { type: "custom", from: "2026-01-01", to: "2026-06-30" }, new Date()).businessDate, { $gte: "2026-01-01", $lte: "2026-06-30" });
});

test("tier sales filter is not scoped to a single branch", () => {
  const filter = (tierService as any).buildTierSalesFilter("ACME", "c1", { type: "lifetime" }, new Date());
  assert.equal("branchId" in filter, false);
});

test("net tier sales exclude cancelled orders and subtract refunds", () => {
  const total = (tierService as any).calculateTierNetSales;
  assert.equal(total([{ status: "completed", grandTotal: 100, refundedAmount: 30 }, { status: "confirmed", grandTotal: 50, refundedAmount: 0 }, { status: "cancelled", grandTotal: 999, refundedAmount: 0 }]), 120);
});

test("tính Lợi nhuận gộp kết hợp cả đơn bán lẻ và phiếu sửa chữa", () => {
  const calculateGrossProfit = (tierService as any).calculateTierGrossProfit;
  const orders = [
    // Bán lẻ 50 củ sạc: thu 15tr, vốn 7.5tr -> lãi 7.5tr
    { status: "completed", grandTotal: 15000000, totalCost: 7500000, refundedAmount: 0 },
  ];
  const repairTickets = [
    // Sửa máy: thu 1tr, vốn linh kiện 400k -> lãi 600k
    { status: "delivered", totalAmount: 1000000, partCost: 400000 },
  ];
  const totalProfit = calculateGrossProfit(orders, repairTickets);
  assert.equal(totalProfit, 8100000); // 7.5tr + 600k = 8.1tr
});

test("phân hạng VIP theo LỢI NHUẬN GỘP: khách mua phụ kiện lãi 7.5tr đạt Kim Cương > khách mua 15 Pro Max lãi 700k đạt Hạng Đồng", () => {
  const resolve = (tierService as any).resolveTier;
  const tiers = [
    { code: "bronze", name: "Hạng Đồng", minGrossProfit: 0 },
    { code: "silver", name: "Hạng Bạc", minGrossProfit: 1500000 },
    { code: "gold", name: "Hạng Vàng", minGrossProfit: 4000000 },
    { code: "diamond", name: "Kim Cương", minGrossProfit: 7000000 },
  ];

  // Khách 1: Mua 50 củ sạc lãi 7.5tr
  const tierCustomer1 = resolve(7500000, tiers, "gross_profit");
  assert.equal(tierCustomer1.code, "diamond");

  // Khách 2: Mua 1 máy iPhone 15 Pro Max lãi 700k (doanh thu 35tr)
  const tierCustomer2 = resolve(700000, tiers, "gross_profit");
  assert.equal(tierCustomer2.code, "bronze");
});

test("retry sweep only picks up unfinished jobs with attempts left", async () => {
  const calls: string[] = [];
  const jobModel = (await import("../models/retail-customer-tier-job.model") as any).RetailCustomerTierJobModel;
  const original = jobModel.find;
  jobModel.find = (filter: any) => {
    calls.push(JSON.stringify(filter));
    const chain: any = { sort: () => chain, limit: () => chain, select: () => chain, lean: async () => [] };
    return chain;
  };
  try {
    const result = await (tierService as any).processPendingTierRefreshJobs();
    assert.deepEqual(result, { processed: 0, failed: 0 });
  } finally { jobModel.find = original; }
  const filter = JSON.parse(calls[0]);
  assert.deepEqual(filter.status, { $in: ["pending", "failed"] });
  assert.deepEqual(filter.attempts, { $lt: (tierService as any).TIER_JOB_MAX_ATTEMPTS });
});

test("tier job and history models enforce retry-safe source keys", async () => {
  const job = (await import("../models/retail-customer-tier-job.model") as any).RetailCustomerTierJobModel;
  const history = (await import("../models/retail-customer-tier-history.model") as any).RetailCustomerTierHistoryModel;
  assert.ok(job.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.sourceKey === 1 && options.unique));
  assert.ok(history.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.sourceKey === 1 && options.unique));
});
