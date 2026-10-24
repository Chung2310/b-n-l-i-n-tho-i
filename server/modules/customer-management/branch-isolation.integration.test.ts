import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, expect, test } from "vitest";
import { BranchModel } from "../../model/branch.model";
import { CustomerModel } from "./models/customer.model";
import { CustomerService } from "./customer.service";
import { customerScopeFromRequest, customerScopeFilter } from "./customer-branch-scope";
import { saveSupplierPartner } from "../partners/partner-supplier.service";
import { PartnerModel, CommissionPolicyModel } from "../partners/partner.models";
import { listSuppliers, updateSupplier } from "../inventory/receiving/receiving.service";
import { resolveCollaborator, snapshotPolicy } from "../partners/commission-snapshot";
import { CustomerPurchaseHistoryService } from "./customer-purchase-history.service";
import { RepairTicketModel } from "../repair/repair-ticket.model";

let repl: MongoMemoryReplSet;
let main: string, cn2: string;
const companyCode = "BRANCH_ISOLATION_TEST";
const actor = { id: "admin", name: "Admin" };
const scope = (branchId: string) => customerScopeFromRequest({ user: { role: "admin", companyCode, branchId }, query: {} } as any);
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  const branches = await BranchModel.create([{ companyCode, code: "MAIN", name: "MAIN" }, { companyCode, code: "CN2", name: "CN2" }]);
  [main, cn2] = branches.map(b => String(b._id));
}, 120000);
afterAll(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

test("switch MAIN → CN2 → MAIN: counts, search, detail, create and update remain isolated", async () => {
  const legacy = await CustomerModel.create({ companyCode, customerCode: "LEGACY", name: "Legacy MAIN", phone: "0901111111", normalizedPhone: "0901111111", createdBy: "admin", createdByName: "Admin" });
  const mainScope = await scope(main), otherScope = await scope(cn2);
  expect((await CustomerService.list(mainScope)).total).toBe(1);
  expect((await CustomerService.list(otherScope)).total).toBe(0);
  expect((await CustomerService.list(otherScope, { q: "Legacy" })).items).toEqual([]);
  await expect(CustomerService.detail(otherScope, String(legacy._id))).rejects.toMatchObject({ status: 404 });
  await expect(CustomerService.setStatus(otherScope, String(legacy._id), "inactive", 0)).rejects.toThrow();
  const created = await CustomerService.create(otherScope, { name: "CN2 Customer", phone: "0902222222" }, actor);
  expect(created.branchId).toBe(cn2);
  expect((await CustomerService.list(otherScope)).items.map(c => c.name)).toEqual(["CN2 Customer"]);
  expect((await CustomerService.list(mainScope)).items.map(c => c.name)).toEqual(["Legacy MAIN"]);
  await expect(CustomerService.detail(mainScope, String(created._id))).rejects.toMatchObject({ status: 404 });
  await RepairTicketModel.collection.insertOne({ companyCode, branchId: cn2, customerId: String(legacy._id), ticketCode: "OTHER-BRANCH", status: "done", totalAmount: 100, paidAmount: 100 });
  const history = await CustomerPurchaseHistoryService.get(mainScope, String(legacy._id), main);
  expect(history.items).toHaveLength(0);
});

test("supplier partners are shared across branches but remain company isolated", async () => {
  const mainScope = await scope(main), otherScope = await scope(cn2);
  const partner = await saveSupplierPartner({ companyCode, branchId: cn2, code: "CN2-NCC", name: "CN2 Supplier", roles: ["supplier"], status: "active", updatedBy: "admin" }, {});
  expect(await PartnerModel.countDocuments(customerScopeFilter(mainScope))).toBe(0);
  expect(await PartnerModel.countDocuments(customerScopeFilter(otherScope))).toBe(1);
  expect(await listSuppliers(mainScope)).toHaveLength(1);
  expect(await listSuppliers(otherScope)).toHaveLength(1);
  await updateSupplier(mainScope, partner.supplierId, { name: "Shared supplier" }, actor);
  expect(await listSuppliers(otherScope)).toEqual([expect.objectContaining({ name: "Shared supplier" })]);
  await expect(updateSupplier({ companyCode: "OTHER" }, partner.supplierId, { name: "Forbidden" }, actor)).rejects.toThrow();
});

test("the same collaborator can earn commission in MAIN and CN2, never another company", async () => {
  const legacy = await PartnerModel.create({ companyCode, code: "CTV-MAIN", name: "MAIN Collaborator", roles: ["collaborator"], status: "active" });
  expect(await resolveCollaborator(companyCode, legacy._id, undefined, cn2)).toMatchObject({ code: "CTV-MAIN" });
  await expect(resolveCollaborator("OTHER", legacy._id, undefined, cn2)).rejects.toThrow();
  expect(await resolveCollaborator(companyCode, legacy._id, undefined, main)).toMatchObject({ code: "CTV-MAIN" });
});

test("one commission policy applies to the same partner in either branch", async () => {
  const partner = await PartnerModel.create({ companyCode, code: "SHARED-COMMISSION", name: "Shared collaborator", roles: ["collaborator"], status: "active" });
  const policy = await CommissionPolicyModel.create({ companyCode, partnerId: String(partner._id), effectiveAt: new Date(0), config: { rate: 5 } });
  for (const branchId of [main, cn2]) {
    expect(await snapshotPolicy(companyCode, String(partner._id), undefined, false, branchId)).toMatchObject({ partnerId: String(partner._id), policyId: String(policy._id), policy: { rate: 5 } });
  }
});
