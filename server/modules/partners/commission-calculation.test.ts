import { describe, it, expect } from "vitest";
import { allocateBases, defaultPolicy, kpiBonus, monthKey, remainingLine, repairLines, retailLines, validatePolicy } from "./commission-calculation";

describe("commission calculations", () => {
  const policy = validatePolicy({ ...defaultPolicy, rules: [{ kind: "phone", category: "Điện thoại" }, { kind: "accessory", category: "Phụ kiện" }] });
  it("calculates a mixed basket and reverses only the returned phone", () => {
    const lines = retailLines({ orderDiscount: 0, items: [{ sku: "P", productName: "Máy", category: "Điện thoại", quantity: 2, lineTotal: 20000000 }, { sku: "A", category: "Phụ kiện", quantity: 1, lineTotal: 1000000 }] }, policy);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(500000);
    expect(remainingLine(lines[0], 1)).toEqual({ amount: 200000, machines: 1 });
    expect(remainingLine(lines[1], 0, 400000)).toEqual({ amount: 60000, machines: 0 });
    expect(remainingLine(lines[1], 1)).toEqual({ amount: 0, machines: 0 });
  });
  it("allocates discount exactly and excludes tax and shipping", () => {
    expect(allocateBases([{ lineTotal: 101 }, { lineTotal: 101 }, { lineTotal: 101 }], 100)).toEqual([68, 68, 67]);
    expect(retailLines({ orderDiscount: 100000, taxAmount: 999999, shippingFee: 888888, items: [{ sku: "A", category: "Phụ kiện", quantity: 1, lineTotal: 1000000 }] }, policy)[0].amount).toBe(90000);
  });
  it("requires explicit product classification and valid rates", () => {
    expect(() => retailLines({ items: [{ sku: "UNKNOWN", lineTotal: 100, quantity: 1 }] }, policy)).toThrow(/SKU/);
    expect(() => validatePolicy({ ...defaultPolicy, phoneAmount: 149999 })).toThrow();
    expect(() => validatePolicy({ ...defaultPolicy, repairBps: 1501 })).toThrow();
    expect(() => validatePolicy({ ...defaultPolicy, rules: [{ kind: 'phone', sku: 'P' }, { kind: 'accessory', sku: 'P' }] })).toThrow(/trùng/);
  });
  it("uses SKU override ahead of category and snapshots the resulting rate", () => {
    const custom = validatePolicy({ ...policy, rules: [...policy.rules, { kind: 'phone', sku: 'P', amount: 300000 }] });
    const line = retailLines({ items: [{ sku: 'P', category: 'Điện thoại', quantity: 1, lineTotal: 1000000 }] }, custom)[0];
    custom.rules[2].amount = 150000;
    expect(line.amount).toBe(300000);
  });
  it("calculates discounted labor only and supports partial labor refunds", () => {
    const line = repairLines({ laborFee: 400000, partRevenue: 600000, totalAmount: 900000 }, policy)[0];
    expect(line.base).toBe(360000); expect(line.amount).toBe(36000);
    expect(remainingLine(line, 0, 180000).amount).toBe(18000);
  });
  it("uses the highest KPI tier and Vietnamese month boundaries", () => {
    expect([9,10,19,20,25].map(kpiBonus)).toEqual([0,1000000,1000000,2500000,2500000]);
    expect(monthKey('2026-08-31T16:59:59Z')).toBe('2026-08');
    expect(monthKey('2026-08-31T17:00:00Z')).toBe('2026-09');
  });
});
