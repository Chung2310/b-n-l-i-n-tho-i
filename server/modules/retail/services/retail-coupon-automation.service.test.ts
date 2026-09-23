import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { BranchModel } from "../../../model/branch.model";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailCouponAutomationModel } from "../models/retail-coupon-automation.model";
import { RetailBirthdayProgramModel } from "../models/retail-birthday-program.model";
import { issueCouponAutomations, retailCouponAutomationService, validateCouponAutomation } from "./retail-coupon-automation.service";
import { retailBirthdayProgramService } from "./retail-birthday-coupon.service";
import { consumeCoupon, resolveCoupon, retailCouponService } from "./retail-coupon.service";

import { deliverPendingCouponEmails } from "./retail-coupon-email.service";
import { companyEmailService } from "../../../service/company-email.service";
vi.mock("../../../service/company-email.service", () => ({ companyEmailService: { getSmtp: vi.fn(), send: vi.fn() } }));
vi.mock("../../../middleware/require-module", () => ({ getModuleStateForCompany: vi.fn(async () => ({ exists: true, modules: ["retail"] })) }));
const scope = { companyCode: "AUTO_TEST", branchId: "507f1f77bcf86cd799439011" };
const enabledAt = new Date("2026-09-22T17:00:00Z");
const now = new Date("2026-09-23T10:00:00Z");
const input = { name: "Quà đơn từ 2 triệu", trigger: "order_total", orderMinTotal: 2000000, enabled: true,
  discountType: "amount", value: 100000, minSubtotal: 500000, maxDiscount: null, validityDays: 7, version: 0 };

it("validates trigger, purchase threshold and reward independently", () => {
  for (const deliveryChannels of [["zalo"], ["sms"], "email", null]) expect(() => validateCouponAutomation({ ...input, deliveryChannels })).toThrow();
  expect(validateCouponAutomation(input)).toMatchObject({ orderMinTotal: 2000000, minSubtotal: 500000 });
  for (const patch of [{ name: "" }, { trigger: "unknown" }, { orderMinTotal: null }, { orderMinTotal: 0 }, { orderMinTotal: 1.5 }, { orderMinTotal: Infinity }]) expect(() => validateCouponAutomation({ ...input, ...patch })).toThrow();
  expect(validateCouponAutomation({ ...input, trigger: "birthday" }).orderMinTotal).toBeNull();
});

describe("automatic coupon programs", () => {
  let repl: MongoMemoryReplSet;
  let customerId: string;
  beforeAll(async () => {
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(repl.getUri());
    await Promise.all([RetailCouponModel.init(), RetailCouponAutomationModel.init(), RetailBirthdayProgramModel.init(), CustomerModel.init(), RetailOrderModel.init(), BranchModel.init()]);
  }, 120000);
  afterAll(async () => { await mongoose.disconnect(); await repl?.stop(); });
  beforeEach(async () => {
    await Promise.all([RetailCouponModel.deleteMany({}), RetailCouponAutomationModel.deleteMany({}), RetailBirthdayProgramModel.deleteMany({}), CustomerModel.deleteMany({}), RetailOrderModel.deleteMany({}), BranchModel.deleteMany({})]);
    await BranchModel.create({ _id: scope.branchId, companyCode: scope.companyCode, code: "TEST", name: "Test branch" });
    const id = new mongoose.Types.ObjectId(); customerId = String(id);
    await CustomerModel.collection.insertOne({ _id: id, companyCode: scope.companyCode, customerCode: "KH01", normalizedPhone: "0900000001", name: "Khách An", status: "active", dateOfBirth: new Date("1990-09-23") } as any);
  });
  const order = async (patch: any = {}) => {
    const id = new mongoose.Types.ObjectId();
    const doc = { _id: id, ...scope, customerId, grandTotal: 2000000, refundedAmount: 0, dueAmount: 0, paidAmount: 2000000,
      status: "completed", paymentStatus: "paid", completedAt: new Date("2026-09-23T09:00:00Z"), ...patch };
    await RetailOrderModel.collection.insertOne(doc as any); return doc;
  };
  it("queues email only for new gifts and claims concurrent sends once", async () => {
    vi.mocked(companyEmailService.getSmtp).mockResolvedValue({ hasPassword: true } as any);
    vi.mocked(companyEmailService.send).mockClear().mockResolvedValue({ messageId: "mail-1" });
    await CustomerModel.updateOne({ _id: customerId }, { $set: { email: "customer@example.test" } });
    const program = await retailCouponAutomationService.create(scope, { ...input, deliveryChannels: ["email"] }, "actor", enabledAt);
    await order(); await issueCouponAutomations(scope, now);
    expect((await RetailCouponModel.findOne(scope))?.emailDelivery?.status).toBe("pending");
    await Promise.all([deliverPendingCouponEmails(now), deliverPendingCouponEmails(now)]);
    expect(companyEmailService.send).toHaveBeenCalledTimes(1);
    expect(companyEmailService.send).toHaveBeenCalledWith(scope.companyCode, expect.objectContaining({ to: "customer@example.test", text: expect.stringContaining("Mã giảm giá:") }));
    expect((await RetailCouponModel.findOne(scope))?.emailDelivery?.status).toBe("sent");
    await issueCouponAutomations(scope, now); await deliverPendingCouponEmails(now);
    expect(companyEmailService.send).toHaveBeenCalledTimes(1);
    await retailCouponAutomationService.update(scope, String(program._id), { ...input, version: 0 }, "actor");
    expect((await RetailCouponAutomationModel.findById(program._id))?.deliveryChannels).toEqual(["email"]);
  });
  it("records missing recipient and SMTP failure without retrying uncertain sends", async () => {
    vi.mocked(companyEmailService.send).mockClear().mockRejectedValue(new Error("SMTP timeout"));
    vi.mocked(companyEmailService.getSmtp).mockResolvedValue({ hasPassword: true } as any);
    await retailCouponAutomationService.create(scope, { ...input, deliveryChannels: ["email"] }, "actor", enabledAt);
    await order(); await issueCouponAutomations(scope, now); await deliverPendingCouponEmails(now);
    expect((await RetailCouponModel.findOne(scope))?.emailDelivery?.status).toBe("skipped");
    expect(companyEmailService.send).not.toHaveBeenCalled();
    await CustomerModel.updateOne({ _id: customerId }, { $set: { email: "customer@example.test" } });
    await order(); await issueCouponAutomations(scope, now); await deliverPendingCouponEmails(now); await deliverPendingCouponEmails(now);
    expect(companyEmailService.send).toHaveBeenCalledTimes(1);
    expect(await RetailCouponModel.countDocuments({ "emailDelivery.status": "failed" })).toBe(1);
  });
  it("does not queue email retroactively or send a cancelled order's reward", async () => {
    vi.mocked(companyEmailService.send).mockClear();
    const program = await retailCouponAutomationService.create(scope, input, "actor", enabledAt);
    await order(); await issueCouponAutomations(scope, now);
    await retailCouponAutomationService.update(scope, String(program._id), { ...input, deliveryChannels: ["email"] }, "actor");
    await issueCouponAutomations(scope, now);
    expect((await RetailCouponModel.findOne(scope))?.emailDelivery?.status).toBeUndefined();
    const source = await order(); await issueCouponAutomations(scope, now);
    await RetailOrderModel.updateOne({ _id: source._id }, { $set: { status: "cancelled" } });
    await deliverPendingCouponEmails(now);
    expect(companyEmailService.send).not.toHaveBeenCalled();
    expect(await RetailCouponModel.countDocuments({ "emailDelivery.status": "skipped" })).toBe(1);
  });
  it("runs multiple programs and includes legacy birthdays without migrating or duplicating gifts", async () => {
    await retailBirthdayProgramService.save(scope, input, "actor");
    await retailCouponAutomationService.create(scope, input, "actor", enabledAt);
    await order();
    expect((await retailCouponAutomationService.list(scope))).toHaveLength(2);
    expect(await issueCouponAutomations(scope, now)).toBe(2);
    expect(await issueCouponAutomations(scope, now)).toBe(0);
    const old = (await retailCouponAutomationService.list(scope)).find((row: any) => row.legacy)!;
    await retailCouponAutomationService.update(scope, String(old._id), { ...old, enabled: false }, "actor", now);
    expect((await RetailBirthdayProgramModel.findOne(scope))?.enabled).toBe(false);
  });
  it("uses each fully paid order's net total with inclusive threshold and excludes older orders", async () => {
    await retailCouponAutomationService.create(scope, input, "actor", enabledAt);
    const eligible = await order();
    await order({ grandTotal: 1999999 });
    await order({ dueAmount: 1, status: "confirmed", paymentStatus: "partial" });
    await order({ status: "cancelled" });
    await order({ status: "draft" });
    await order({ completedAt: new Date(+enabledAt - 1) });
    await order({ refundedAmount: 1 });
    await order({ companyCode: "OTHER" });
    await order({ branchId: "507f1f77bcf86cd799439022" });
    expect(await issueCouponAutomations(scope, now)).toBe(1);
    const gift = await RetailCouponModel.findOne(scope).lean();
    expect(gift).toMatchObject({ source: "purchase", sourceOrderId: String(eligible._id), customerId, usageLimit: 1, triggerThreshold: 2000000, minSubtotal: 500000 });
    expect(gift?.startsAt.toISOString()).toBe(eligible.completedAt.toISOString());
  });
  it("concurrent scans cannot grant the same order twice but another order earns another gift", async () => {
    await retailCouponAutomationService.create(scope, input, "actor", enabledAt);
    await order();
    await Promise.all([issueCouponAutomations(scope, now), issueCouponAutomations(scope, now)]);
    expect(await RetailCouponModel.countDocuments(scope)).toBe(1);
    await order();
    expect(await issueCouponAutomations(scope, now)).toBe(1);
    expect(await RetailCouponModel.countDocuments(scope)).toBe(2);
  });
  it("does not grant disabled, expired, inactive-customer or inactive-branch rewards", async () => {
    const program = await retailCouponAutomationService.create(scope, { ...input, enabled: false }, "actor", enabledAt);
    await order();
    expect(await issueCouponAutomations(scope, now)).toBe(0);
    await retailCouponAutomationService.update(scope, String(program._id), { ...input, version: 0 }, "actor", enabledAt);
    await CustomerModel.updateOne({ _id: customerId }, { $set: { status: "inactive" } });
    expect(await issueCouponAutomations(scope, now)).toBe(0);
    await CustomerModel.updateOne({ _id: customerId }, { $set: { status: "active" } });
    await BranchModel.updateOne({ _id: scope.branchId }, { $set: { isActive: false } });
    expect(await issueCouponAutomations(scope, now)).toBe(0);
    await BranchModel.updateOne({ _id: scope.branchId }, { $set: { isActive: true } });
    expect(await issueCouponAutomations(scope, new Date("2026-10-01T10:00:00Z"))).toBe(0);
  });
  it("scopes updates, freezes triggers and prevents stale edits without changing issued rewards", async () => {
    const program = await retailCouponAutomationService.create(scope, input, "actor", enabledAt);
    await order(); await issueCouponAutomations(scope, now);
    await expect(retailCouponAutomationService.update({ ...scope, companyCode: "OTHER" }, String(program._id), input, "actor")).rejects.toThrow();
    await expect(retailCouponAutomationService.update(scope, String(program._id), { ...input, trigger: "birthday" }, "actor")).rejects.toThrow(/Không đổi/);
    await retailCouponAutomationService.update(scope, String(program._id), { ...input, value: 200000, version: 0 }, "actor", now);
    await expect(retailCouponAutomationService.update(scope, String(program._id), input, "actor")).rejects.toThrow(/đã thay đổi/);
    await issueCouponAutomations(scope, now);
    expect((await RetailCouponModel.findOne(scope))?.value).toBe(100000);
  });
  it("rechecks cancellations and refunds before quoting, listing and consuming purchase gifts", async () => {
    const actualNow = new Date();
    await retailCouponAutomationService.create(scope, input, "actor", new Date(+actualNow - 2000));
    const source = await order({ completedAt: new Date(+actualNow - 1000) });
    await issueCouponAutomations(scope, actualNow);
    const gift = (await RetailCouponModel.findOne(scope))!;
    const snapshot = await resolveCoupon(scope, gift.code, 600000, undefined, customerId);
    await expect(resolveCoupon(scope, gift.code, 600000, undefined, String(new mongoose.Types.ObjectId()))).rejects.toThrow(/chỉ dành/);
    await RetailOrderModel.updateOne({ _id: source._id }, { $set: { refundedAmount: 1 } });
    await expect(resolveCoupon(scope, gift.code, 600000, undefined, customerId)).rejects.toMatchObject({ code: "COUPON_SOURCE_INELIGIBLE" });
    expect(await retailCouponService.available(scope, customerId)).toEqual([]);
    const session = await mongoose.startSession();
    try { await expect(session.withTransaction(() => consumeCoupon(scope, snapshot, session, customerId))).rejects.toThrow(/không còn đủ/); }
    finally { await session.endSession(); }
    expect((await RetailCouponModel.findById(gift._id))?.usedCount).toBe(0);
    await RetailOrderModel.updateOne({ _id: source._id }, { $set: { refundedAmount: 0, status: "cancelled" } });
    await expect(resolveCoupon(scope, gift.code, 600000, undefined, customerId)).rejects.toThrow(/đã hủy/);
  });
  it("keeps the birthday annual limit separate for each configured program", async () => {
    await retailCouponAutomationService.create(scope, { ...input, trigger: "birthday", name: "Sinh nhật A" }, "actor", enabledAt);
    await retailCouponAutomationService.create(scope, { ...input, trigger: "birthday", name: "Sinh nhật B" }, "actor", enabledAt);
    expect(await issueCouponAutomations(scope, now)).toBe(2);
    expect(await issueCouponAutomations(scope, now)).toBe(0);
    expect(await issueCouponAutomations(scope, new Date("2027-09-23T10:00:00Z"))).toBe(2);
  });
});
