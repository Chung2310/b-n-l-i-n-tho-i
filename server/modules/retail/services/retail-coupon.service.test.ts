import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { BranchModel } from "../../../model/branch.model";
import { RetailBirthdayProgramModel } from "../models/retail-birthday-program.model";
import { birthdayWindow, birthdayCandidateDays, validateBirthdayProgram, retailBirthdayProgramService, issueBirthdayCoupons } from "./retail-birthday-coupon.service";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { CustomerSettingsModel } from "../../customer-management/models/customer-settings.model";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { consumeCoupon, couponDiscount, normalizeCouponCode, releaseCoupon, resolveCoupon, retailCouponService, validateCouponInput } from "./retail-coupon.service";

const input = { code: "SALE10", name: "Ưu đãi tháng", discountType: "percent", value: 10, minSubtotal: 100000, maxDiscount: 50000, usageLimit: 1, startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", active: true };
const scope = { companyCode: "COUPON_TEST", branchId: "b1" };
describe("coupon rules", () => {
  it("normalizes codes and rejects invalid definitions", () => {
    expect(normalizeCouponCode(" sale10 ")).toBe("SALE10");
    for (const patch of [{ code: {} }, { value: 101 }, { value: NaN }, { value: 0 }, { usageLimit: 0 }, { maxDiscount: -1 }, { startsAt: input.endsAt }, { active: "true" }, { minSubtotal: 0.5 }]) expect(() => validateCouponInput({ ...input, ...patch })).toThrow();
    expect(validateCouponInput({ ...input, value: 10.25 }).value).toBe(10.25);
  });
  it("caps discounts to the configured limit and merchandise amount", () => {
    const coupon = { ...validateCouponInput(input), usedCount: 0 };
    expect(couponDiscount(coupon, 200000)).toBe(20000);
    expect(couponDiscount(coupon, 1000000)).toBe(50000);
    expect(couponDiscount({ ...coupon, discountType: "amount", value: 500000, maxDiscount: null }, 100000)).toBe(100000);
  });
  it("checks exact date boundaries, status, minimum spend and usage", () => {
    const coupon = { ...validateCouponInput(input), usedCount: 0 };
    expect(couponDiscount(coupon, 100000, coupon.startsAt)).toBe(10000);
    expect(() => couponDiscount(coupon, 100000, coupon.endsAt)).toThrow(/hết hạn/);
    expect(() => couponDiscount(coupon, 100000, new Date("2019-01-01"))).toThrow(/chưa đến/);
    expect(() => couponDiscount({ ...coupon, active: false }, 100000)).toThrow(/tạm dừng/);
    expect(() => couponDiscount({ ...coupon, usedCount: 1 }, 100000)).toThrow(/hết lượt/);
    expect(() => couponDiscount(coupon, 99999)).toThrow(/tối thiểu/);
  });
});
describe("coupon persistence and transactions", () => {
  let repl: MongoMemoryReplSet;
  beforeAll(async () => { repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(repl.getUri()); await RetailCouponModel.init(); await RetailBirthdayProgramModel.init(); }, 120000);
  afterAll(async () => { await mongoose.disconnect(); await repl?.stop(); });
  beforeEach(async () => { await RetailBirthdayProgramModel.deleteMany({}); await BranchModel.deleteMany({}); await RetailCouponModel.deleteMany({}); await CustomerModel.deleteMany({}); await CustomerSettingsModel.deleteMany({}); });
  it("validates tier definitions against customer management settings", async () => {
    for (const customerTierCodes of [null, "silver", [12], ["SILVER"]]) expect(() => validateCouponInput({ ...input, customerTierCodes })).toThrow();
    await expect(retailCouponService.create(scope, { ...input, customerTierCodes: ["unknown"] }, "actor")).rejects.toThrow(/không còn tồn tại/);
    await CustomerSettingsModel.create({ companyCode: scope.companyCode, customerTiers: [{ code: "vip", name: "Khách VIP", minGrossProfit: 0 }] });
    expect(await retailCouponService.tiers(scope)).toEqual([{ code: "vip", name: "Khách VIP" }]);
    const saved = await retailCouponService.create(scope, { ...input, customerTierCodes: ["vip", "vip"] }, "actor");
    expect(saved.customerTierCodes).toEqual(["vip"]);
    await expect(retailCouponService.update(scope, String(saved._id), { ...input, version: 0, customerTierCodes: ["silver"] }, "actor")).rejects.toThrow(/không còn tồn tại/);
  });
  it("checks current customer tier, company and status when applying a restricted coupon", async () => {
    const coupon = await retailCouponService.create(scope, { ...input, customerTierCodes: ["silver", "gold"] }, "actor");
    const id = new mongoose.Types.ObjectId();
    await CustomerModel.collection.insertOne({ _id: id, companyCode: scope.companyCode, status: "active", tier: { code: "silver" } } as any);
    await expect(resolveCoupon(scope, input.code, 200000)).rejects.toThrow(/chọn khách hàng/);
    expect((await resolveCoupon(scope, input.code, 200000, undefined, String(id))).amount).toBe(20000);
    await CustomerModel.updateOne({ _id: id }, { $set: { "tier.code": "gold" } });
    expect((await resolveCoupon(scope, input.code, 200000, undefined, String(id))).amount).toBe(20000);
    await CustomerModel.updateOne({ _id: id }, { $set: { "tier.code": "diamond" } });
    const session = await mongoose.startSession();
    try { await expect(session.withTransaction(async () => { await resolveCoupon(scope, input.code, 200000, session, String(id)); })).rejects.toThrow(/không thuộc/); }
    finally { await session.endSession(); }
    await CustomerModel.updateOne({ _id: id }, { $set: { "tier.code": "silver", status: "inactive" } });
    await expect(resolveCoupon(scope, input.code, 200000, undefined, String(id))).rejects.toThrow(/không thuộc/);
    await CustomerModel.updateOne({ _id: id }, { $set: { status: "active", companyCode: "OTHER" } });
    await expect(resolveCoupon(scope, input.code, 200000, undefined, String(id))).rejects.toThrow(/không thuộc/);
    expect((await RetailCouponModel.findById(coupon._id))?.usedCount).toBe(0);
    await retailCouponService.update(scope, String(coupon._id), { ...input, version: 0, customerTierCodes: [] }, "actor");
    expect((await resolveCoupon(scope, input.code, 200000)).amount).toBe(20000);
  });
  it("isolates branch/company data, prevents duplicates and stale edits", async () => {
    const coupon = await retailCouponService.create(scope, input, "actor");
    await expect(retailCouponService.create(scope, { ...input, code: "sale10" }, "actor")).rejects.toMatchObject({ code: 11000 });
    expect((await retailCouponService.list({ ...scope, branchId: "other" })).total).toBe(0);
    await expect(resolveCoupon({ ...scope, companyCode: "OTHER" }, input.code, 200000)).rejects.toThrow(/Không tìm thấy/);
    await expect(retailCouponService.update({ ...scope, branchId: "other" }, String(coupon._id), { ...input, version: 0 }, "actor")).rejects.toThrow();
    await retailCouponService.update(scope, String(coupon._id), { ...input, active: false, version: 0 }, "actor");
    await expect(retailCouponService.update(scope, String(coupon._id), { ...input, version: 0 }, "actor")).rejects.toThrow(/đã thay đổi/);
  });
  it("allows only one competing transaction to consume the final use", async () => {
    await retailCouponService.create(scope, input, "actor");
    const snapshot = await resolveCoupon(scope, "sale10", 200000);
    const results = await Promise.allSettled([1, 2].map(async () => {
      const session = await mongoose.startSession();
      try { await session.withTransaction(async () => { await consumeCoupon(scope, snapshot, session); }); }
      finally { await session.endSession(); }
    }));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await RetailCouponModel.findById(snapshot.id))?.usedCount).toBe(1);
    await expect(resolveCoupon(scope, input.code, 200000)).rejects.toThrow(/hết lượt/);
  });
  it("rolls usage back on failure and releases usage in a cancellation transaction", async () => {
    await retailCouponService.create(scope, input, "actor");
    const snapshot = await resolveCoupon(scope, input.code, 200000);
    const session = await mongoose.startSession();
    try {
      await expect(session.withTransaction(async () => { await consumeCoupon(scope, snapshot, session); throw new Error("stock failure"); })).rejects.toThrow("stock failure");
      expect((await RetailCouponModel.findById(snapshot.id))?.usedCount).toBe(0);
      await session.withTransaction(async () => { await consumeCoupon(scope, snapshot, session); });
      await session.withTransaction(async () => { await releaseCoupon(scope, snapshot.id, session); });
      expect((await RetailCouponModel.findById(snapshot.id))?.usedCount).toBe(0);
    } finally { await session.endSession(); }
  });
  it("rejects a coupon changed after quotation", async () => {
    const coupon = await retailCouponService.create(scope, input, "actor");
    const snapshot = await resolveCoupon(scope, input.code, 200000);
    await retailCouponService.update(scope, String(coupon._id), { ...input, version: 0, active: false }, "actor");
    const session = await mongoose.startSession();
    try { await expect(session.withTransaction(async () => { await consumeCoupon(scope, snapshot, session); })).rejects.toThrow(/đã thay đổi/); }
    finally { await session.endSession(); }
  });

  const customer = async (patch: any = {}) => {
    const id = new mongoose.Types.ObjectId();
    const row = { _id: id, normalizedPhone: String(id), companyCode: scope.companyCode, status: "active", name: "Khách An", customerCode: `KH-${id}`, dateOfBirth: new Date("1990-09-23T00:00:00Z"), ...patch };
    await CustomerModel.collection.insertOne(row as any);
    return row;
  };
  it("binds a private coupon to one active customer in the same company", async () => {
    const owner = await customer();
    const other = await customer({ customerCode: "KH-OTHER" });
    const coupon = await retailCouponService.create(scope, { ...input, customerId: String(owner._id) }, "actor");
    expect(coupon.customerName).toBe("Khách An");
    await expect(resolveCoupon(scope, input.code, 200000)).rejects.toThrow(/chỉ dành/);
    await expect(resolveCoupon(scope, input.code, 200000, undefined, String(other._id))).rejects.toThrow(/chỉ dành/);
    expect((await resolveCoupon(scope, input.code, 200000, undefined, String(owner._id))).amount).toBe(20000);
    await expect(retailCouponService.create({ ...scope, companyCode: "OTHER" }, { ...input, customerId: String(owner._id) }, "actor")).rejects.toThrow(/không tồn tại/);
    await expect(retailCouponService.update(scope, String(coupon._id), { ...input, customerId: String(other._id), version: 0 }, "actor")).rejects.toThrow(/khách hàng nhận mã/);
    await expect(retailCouponService.update(scope, String(coupon._id), { ...input, version: 0 }, "actor")).rejects.toThrow();
    await CustomerModel.updateOne({ _id: owner._id }, { $set: { status: "inactive" } });
    await expect(resolveCoupon(scope, input.code, 200000, undefined, String(owner._id))).rejects.toThrow(/ngừng hoạt động/);
  });
  it("enforces private ownership and single use atomically, including cancellation", async () => {
    const owner = await customer(); const id = String(owner._id);
    await retailCouponService.create(scope, { ...input, customerId: id }, "actor");
    const snapshot = await resolveCoupon(scope, input.code, 200000, undefined, id);
    const session = await mongoose.startSession();
    try {
      await expect(session.withTransaction(() => consumeCoupon(scope, snapshot, session, String(new mongoose.Types.ObjectId())))).rejects.toThrow();
      await expect(session.withTransaction(async () => { await consumeCoupon(scope, snapshot, session, id); throw new Error("stock failure"); })).rejects.toThrow("stock failure");
      expect((await RetailCouponModel.findById(snapshot.id))?.usedCount).toBe(0);
      const outcomes = await Promise.allSettled([1, 2].map(async () => {
        const transaction = await mongoose.startSession();
        try { await transaction.withTransaction(() => consumeCoupon(scope, snapshot, transaction, id)); }
        finally { await transaction.endSession(); }
      }));
      expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
      await session.withTransaction(() => releaseCoupon(scope, snapshot.id, session));
      expect((await RetailCouponModel.findById(snapshot.id))?.usedCount).toBe(1);
      await expect(resolveCoupon(scope, input.code, 200000, undefined, id)).rejects.toThrow(/hết lượt/);
    } finally { await session.endSession(); }
  });
  it("only lists usable private gifts for the selected customer and branch", async () => {
    const owner = await customer(); const id = String(owner._id);
    await retailCouponService.create(scope, { ...input, customerId: id }, "actor");
    await retailCouponService.create(scope, { ...input, code: "PUBLIC" }, "actor");
    await retailCouponService.create(scope, { ...input, customerId: id, code: "DISABLED", active: false }, "actor");
    expect((await retailCouponService.available(scope, id)).map(row => row.code)).toEqual([input.code]);
    expect(await retailCouponService.available({ ...scope, branchId: "another" }, id)).toEqual([]);
    await expect(retailCouponService.available({ ...scope, companyCode: "OTHER" }, id)).rejects.toThrow();
  });
  const birthdayScope = { ...scope, branchId: "507f1f77bcf86cd799439011" };
  const program = { enabled: true, discountType: "percent", value: 10, minSubtotal: 0, maxDiscount: 50000, validityDays: 7, version: 0 };
  const setupBirthday = async () => {
    await BranchModel.create({ _id: birthdayScope.branchId, companyCode: scope.companyCode, code: "BIRTHDAY", name: "Birthday" });
    await retailBirthdayProgramService.save(birthdayScope, program, "actor");
  };
  it("defaults birthday automation off and protects concurrent configuration edits", async () => {
    expect((await retailBirthdayProgramService.get(birthdayScope)).enabled).toBe(false);
    const results = await Promise.allSettled([1, 2].map(() => retailBirthdayProgramService.save(birthdayScope, program, "actor")));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    await expect(retailBirthdayProgramService.save(birthdayScope, program, "actor")).rejects.toThrow(/đã thay đổi/);
  });
  it("issues one birthday gift per customer and year even across concurrent scans", async () => {
    await setupBirthday(); const owner = await customer();
    const now = new Date("2026-09-23T01:00:00Z");
    await Promise.all([issueBirthdayCoupons(birthdayScope, now), issueBirthdayCoupons(birthdayScope, now)]);
    const rows = await RetailCouponModel.find(birthdayScope).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ customerId: String(owner._id), usageLimit: 1, source: "birthday", value: 10 });
    expect(rows[0].startsAt.toISOString()).toBe("2026-09-22T17:00:00.000Z");
    expect(rows[0].endsAt.toISOString()).toBe("2026-09-29T17:00:00.000Z");
    await retailBirthdayProgramService.save(birthdayScope, { ...program, value: 20, version: 1 }, "actor");
    await issueBirthdayCoupons(birthdayScope, now);
    expect((await RetailCouponModel.findById(rows[0]._id))?.value).toBe(10);
    await issueBirthdayCoupons(birthdayScope, new Date("2027-09-23T01:00:00Z"));
    expect(await RetailCouponModel.countDocuments(birthdayScope)).toBe(2);
  });
  it("catches up within validity and excludes expired, inactive and other-company birthdays", async () => {
    await setupBirthday();
    await customer({ dateOfBirth: new Date("1990-09-20") });
    await customer({ dateOfBirth: new Date("1990-09-01") });
    await customer({ status: "inactive" });
    await customer({ companyCode: "OTHER" });
    await customer({ dateOfBirth: undefined });
    expect(await issueBirthdayCoupons(birthdayScope, new Date("2026-09-23T01:00:00Z"))).toBe(1);
    await customer();
    await retailBirthdayProgramService.save(birthdayScope, { ...program, enabled: false, version: 1 }, "actor");
    expect(await issueBirthdayCoupons(birthdayScope, new Date("2026-09-23T01:00:00Z"))).toBe(0);
  });
});


describe("birthday date and configuration rules", () => {
  it("uses Vietnam midnight, leap-day fallback, year boundaries and exclusive expiration", () => {
    const birth = new Date("2000-02-29T00:00:00Z");
    expect(birthdayWindow(birth, new Date("2025-02-27T16:59:59Z"), 1)).toBeNull();
    expect(birthdayWindow(birth, new Date("2025-02-27T17:00:00Z"), 1)?.startsAt.toISOString()).toBe("2025-02-27T17:00:00.000Z");
    expect(birthdayWindow(birth, new Date("2024-02-28T00:00:00Z"), 7)).toBeNull();
    expect(birthdayWindow(birth, new Date("2024-02-28T17:00:00Z"), 7)?.year).toBe(2024);
    expect(birthdayWindow(birth, new Date("2025-02-28T17:00:00Z"), 1)).toBeNull();
    expect(birthdayWindow(new Date("1990-12-31"), new Date("2027-01-02"), 7)?.year).toBe(2026);
    expect(birthdayCandidateDays(new Date("2025-02-27T17:00:00Z"), 1)).toContain("02-29");
  });
  it("validates birthday amounts and validity and forces private coupons to one use", () => {
    const base = { enabled: true, validityDays: 7, discountType: "percent", value: 10, minSubtotal: 0, maxDiscount: null };
    for (const patch of [{ validityDays: 0 }, { validityDays: 91 }, { validityDays: 1.5 }, { value: 101 }, { enabled: "true" }]) expect(() => validateBirthdayProgram({ ...base, ...patch })).toThrow();
    const customerId = String(new mongoose.Types.ObjectId());
    expect(validateCouponInput({ ...input, customerId, usageLimit: null }).usageLimit).toBe(1);
    expect(() => validateCouponInput({ ...input, customerId, usageLimit: 2 })).toThrow(/một lần/);
    expect(() => validateCouponInput({ ...input, customerId: "" })).toThrow(/Khách hàng/);
  });
});
