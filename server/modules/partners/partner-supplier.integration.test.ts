import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PartnerModel } from "./partner.models";
import { SupplierModel } from "../../model/supplier.model";
import { saveSupplierPartner, supplierPartnerProfile } from "./partner-supplier.service";

let repl: MongoMemoryReplSet;
const input = { companyCode: "SUPPLIER_TEST", code: "NCC-1", name: "Nguồn hàng", roles: ["supplier" as const], status: "active" as const, phone: "0901234567", email: "supplier@example.com", address: "Hà Nội", updatedBy: "admin" };
describe("supplier profiles managed through partners", () => {
  beforeAll(async () => {
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(repl.getUri());
    await Promise.all([PartnerModel.init(), SupplierModel.init()]);
  }, 120000);
  afterAll(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
  beforeEach(async () => { await Promise.all([PartnerModel.deleteMany({}), SupplierModel.deleteMany({})]); });

  it("creates a complete supplier selectable by inventory using the linked ID", async () => {
    const partner = await saveSupplierPartner(input, { taxCode: " 0312345678 ", paymentTerms: "30 ngày", notes: "Giao sáng" });
    const supplier = await SupplierModel.findOne({ companyCode: input.companyCode, _id: partner.supplierId, status: "active" }).lean();
    expect(supplier).toMatchObject({ name: input.name, code: input.code, taxCode: "0312345678", paymentTerms: "30 ngày", notes: "Giao sáng" });
    expect(partner.supplierCode).toBe(input.code);
    expect(await PartnerModel.countDocuments({ supplierId: partner.supplierId })).toBe(1);
  });

  it("edits contacts and status, preserves supplier ID, and allows clearing optional fields", async () => {
    const partner = await saveSupplierPartner(input, { taxCode: "0312345678", notes: "Ghi chú cũ", paymentTerms: "30 ngày" });
    const updated = await saveSupplierPartner({ ...input, name: "Tên mới", status: "inactive", phone: "", email: "" }, { notes: "", taxCode: "" }, String(partner._id));
    expect(updated).toMatchObject({ supplierId: partner.supplierId, name: "Tên mới", status: "inactive", notes: "", taxCode: "", paymentTerms: "30 ngày" });
    const supplier = await SupplierModel.findById(partner.supplierId).lean();
    expect(supplier).toMatchObject({ name: "Tên mới", phone: "", email: "", status: "inactive", notes: "" });
    expect(await SupplierModel.countDocuments()).toBe(1);
  });

  it("keeps existing inventory details when linking a legacy supplier", async () => {
    const supplier = await SupplierModel.create({ ...input, code: "OLD-NCC", taxCode: "OLD-TAX", paymentTerms: "15 ngày", notes: "Cũ", createdBy: "admin" });
    const partner = await saveSupplierPartner({ ...input, supplierId: String(supplier._id) }, {});
    expect(partner).toMatchObject({ supplierId: String(supplier._id), supplierCode: "OLD-NCC", taxCode: "OLD-TAX", paymentTerms: "15 ngày", notes: "Cũ" });
    expect(supplierPartnerProfile({ code: input.code }, supplier.toObject()).notes).toBe("Cũ");
  });

  it("creates an inventory record when editing an older unlinked supplier partner", async () => {
    const partner = await PartnerModel.create(input);
    const updated = await saveSupplierPartner(input, { taxCode: "NEW-TAX" }, String(partner._id));
    expect(updated.supplierId).toBeTruthy();
    expect(await SupplierModel.countDocuments()).toBe(1);
    expect(await PartnerModel.countDocuments()).toBe(1);
  });

  it("rejects cross-company supplier links", async () => {
    const supplier = await SupplierModel.create({ ...input, companyCode: "OTHER", createdBy: "admin" });
    await expect(saveSupplierPartner({ ...input, supplierId: String(supplier._id) }, {})).rejects.toThrow("Không tìm thấy nhà cung cấp");
    expect(await PartnerModel.countDocuments()).toBe(0);
  });

  it("rolls back inventory creation when a duplicate partner code fails", async () => {
    await PartnerModel.create({ ...input, roles: ["dealer"] });
    await expect(saveSupplierPartner(input, {})).rejects.toThrow();
    expect(await SupplierModel.countDocuments()).toBe(0);
    expect(await PartnerModel.countDocuments()).toBe(1);
  });
});
