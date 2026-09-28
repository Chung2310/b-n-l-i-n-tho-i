import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PartnerModel, CommissionLedgerModel, CommissionPolicyModel, ProductCommissionModel } from "./partner.models";
import { ProductVariantModel } from "../../model/product-variant.model";
import { saveProductCommissions } from "./product-commission.service";
import { RetailOrderModel } from "../retail/models/retail-order.model";
import { RetailAfterSaleModel } from "../retail/models/retail-after-sale.model";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { closePartnerMonths, reconcileCommission, recordPartnerPayout, refundRepairCommission } from "./commission.service";
import { defaultPolicy, retailLines, validatePolicy } from "./commission-calculation";
import { snapshotPolicy, snapshotRetail } from "./commission-snapshot";

let repl: MongoMemoryReplSet;
const companyCode = "COMMISSION_TEST";
let partnerId: string;
const policy = validatePolicy({ ...defaultPolicy, rules: [{ kind: 'phone', sku: 'P' }, { kind: 'accessory', sku: 'A' }] });
async function order(quantity: number, status = 'completed') {
  const _id = new Types.ObjectId();
  const items = [{ sku: 'P', productName: 'Phone', quantity, lineTotal: quantity * 1000000 }];
  await RetailOrderModel.collection.insertOne({ _id, companyCode, branchId: 'b1', orderCode: String(_id), status, dueAmount: status === 'completed' ? 0 : 100, completedAt: status === 'completed' ? new Date('2025-01-20T00:00:00Z') : undefined, commissionSnapshot: { partnerId, policyId: 'v1', policy, lines: retailLines({ items }, policy) }, items } as any);
  return String(_id);
}
const balance = async () => (await PartnerModel.findById(partnerId).lean())!.balance;
describe('commission ledger transactions', () => {
  beforeAll(async () => {
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(repl.getUri());
    await Promise.all([PartnerModel.init(), CommissionLedgerModel.init(), CommissionPolicyModel.init()]);
  }, 120000);
  afterAll(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
  beforeEach(async () => {
    await Promise.all([ProductCommissionModel.deleteMany({}), ProductVariantModel.deleteMany({})]);
    await Promise.all([PartnerModel.deleteMany({}), CommissionLedgerModel.deleteMany({}), CommissionPolicyModel.deleteMany({}), RetailOrderModel.deleteMany({}), RetailAfterSaleModel.deleteMany({}), RepairTicketModel.deleteMany({})]);
    partnerId = String((await PartnerModel.create({ companyCode, code: 'CTV', name: 'CTV test', roles: ['collaborator'] }))._id);
  });
  it('saves standalone rates in bulk, isolates tenants and freezes order snapshots', async () => {
    await ProductVariantModel.collection.insertMany([{ companyCode, sku: 'P' }, { companyCode, sku: 'A' }] as any);
    await expect(saveProductCommissions('OTHER', { skus: ['P'], rule: { kind: 'phone', amount: 300000 } }, 'admin')).rejects.toThrow();
    await saveProductCommissions(companyCode, { skus: ['P', 'A'], rule: { kind: 'phone', amount: 300000 } }, 'admin');
    const input = { companyCode, collaboratorId: partnerId, items: [{ sku: 'P', quantity: 2, lineTotal: 2000000 }] };
    const snapshot = await snapshotRetail(input);
    expect(snapshot!.lines[0].amount).toBe(600000);
    await saveProductCommissions(companyCode, { skus: ['P'], rule: { kind: 'phone', amount: 150000 } }, 'admin');
    expect(snapshot!.lines[0].amount).toBe(600000);
    expect((await snapshotRetail(input))!.lines[0].amount).toBe(300000);
    await CommissionPolicyModel.create({ companyCode, partnerId: '', effectiveAt: new Date(0), config: { ...policy, rules: [{ kind: 'phone', category: 'PHONE', amount: 200000 }, { kind: 'phone', sku: 'P', amount: 250000 }] } });
    await saveProductCommissions(companyCode, { skus: ['P'], rule: null }, 'admin');
    expect((await snapshotRetail({ ...input, items: [{ ...input.items[0], category: 'PHONE', trackingMode: 'serial' }] }))!.lines[0].amount).toBe(400000);
  });
  it('is idempotent under concurrent delivery and adjusts a closed KPI month after return', async () => {
    const id = await order(20);
    await Promise.all([reconcileCommission('retail',id,companyCode), reconcileCommission('retail',id,companyCode)]);
    expect(await balance()).toBe(6500000);
    expect(await CommissionLedgerModel.countDocuments({kind:'earning'})).toBe(1);
    await RetailAfterSaleModel.collection.insertOne({ companyCode, orderId:id, type:'return', items:[{orderLineIndex:0,quantity:1}] } as any);
    await reconcileCommission('retail',id,companyCode);
    expect(await balance()).toBe(4800000); // 19 x 200k + 1m; reversed 200k + 1.5m bonus.
    await closePartnerMonths(companyCode,partnerId);
    await reconcileCommission('retail',id,companyCode);
    expect(await balance()).toBe(4800000);
    await RetailOrderModel.updateOne({_id:id},{$set:{status:'cancelled'}});
    await reconcileCommission('retail',id,companyCode);
    expect(await balance()).toBe(0);
  });
  it('prevents concurrent double spending, replays payouts and leaves debt after cancellation', async () => {
    const id = await order(1); await reconcileCommission('retail',id,companyCode);
    const results = await Promise.allSettled(['a','b'].map(key => recordPartnerPayout(companyCode,partnerId,{amount:200000,reference:'BANK',idempotencyKey:key},'admin')));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const paid: any = (results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;
    await recordPartnerPayout(companyCode,partnerId,{amount:200000,reference:'BANK',idempotencyKey:paid.sourceId},'admin');
    expect(await balance()).toBe(0);
    await RetailOrderModel.updateOne({_id:id},{$set:{status:'cancelled'}});
    await reconcileCommission('retail',id,companyCode);
    expect(await balance()).toBe(-200000);
    expect(await CommissionLedgerModel.countDocuments({kind:'payout'})).toBe(1);
  });
  it('does not count unpaid orders, buybacks, or another company', async () => {
    const pending = await order(1,'confirmed'); await reconcileCommission('retail',pending,companyCode); expect(await balance()).toBe(0);
    const id = await order(1); await reconcileCommission('retail',id,'OTHER'); expect(await balance()).toBe(0);
    await RetailAfterSaleModel.collection.insertOne({ companyCode, orderId:id, type:'buyback', items:[{orderLineIndex:0,quantity:1}] } as any);
    await reconcileCommission('retail',id,companyCode); expect(await balance()).toBe(200000);
  });
  it('preserves a locked policy when a new version is created', async () => {
    await CommissionPolicyModel.create({companyCode,partnerId:'',effectiveAt:new Date('2020-01-01'),config:policy});
    const snapshot = await snapshotPolicy(companyCode,partnerId);
    await CommissionPolicyModel.create({companyCode,partnerId:'',effectiveAt:new Date(),config:{...policy,phoneAmount:300000}});
    expect(snapshot!.policy.phoneAmount).toBe(200000);
    await expect(snapshotPolicy('OTHER',partnerId)).rejects.toThrow();
  });
  it('refunds labor only, rejects excessive refunds, and safely replays a repair refund', async () => {
    const _id = new Types.ObjectId();
    await RepairTicketModel.collection.insertOne({_id,companyCode,branchId:'b1',ticketCode:'R1',status:'delivered',deliveredAt:new Date('2025-01-20'),laborFee:400000,partRevenue:600000,totalAmount:1000000,paidAmount:1000000,dueAmount:0,commissionSnapshot:{partnerId,policyId:'v1',policy},commissionRefunds:[],customerPhone:'0901234567',device:{name:'Phone',condition:'Good'},coverage:{costBearer:'customer',checkedAt:new Date()},customerId:'c1',customerName:'Customer',symptom:'Test',receivedAt:new Date(),createdBy:'a',createdByName:'A'} as any);
    await reconcileCommission('repair',String(_id),companyCode); expect(await balance()).toBe(40000);
    const input = {amount:200000,laborAmount:200000,reason:'Refund',reference:'REF1',idempotencyKey:'ref1'};
    await refundRepairCommission({companyCode,branchId:'b1'},String(_id),input,'admin');
    await refundRepairCommission({companyCode,branchId:'b1'},String(_id),input,'admin');
    expect(await balance()).toBe(20000);
    await expect(refundRepairCommission({companyCode,branchId:'b1'},String(_id),{...input,amount:900000,idempotencyKey:'ref2'},'admin')).rejects.toThrow();
  });
  it('operates correctly on standalone MongoDB when transactions are disabled', async () => {
    process.env.DISABLE_TRANSACTIONS = "true";
    try {
      const id = await order(1);
      await reconcileCommission('retail', id, companyCode);
      expect(await balance()).toBe(200000);
      await closePartnerMonths(companyCode, partnerId);
      const paid = await recordPartnerPayout(companyCode, partnerId, { amount: 100000, reference: 'CASH', idempotencyKey: 'payout-standalone' }, 'admin');
      expect(paid).toBeDefined();
      expect(await balance()).toBe(100000);
    } finally {
      delete process.env.DISABLE_TRANSACTIONS;
    }
  });
});
