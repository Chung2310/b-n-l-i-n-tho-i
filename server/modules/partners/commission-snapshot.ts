import type { ClientSession } from "mongoose";
import { PartnerModel, CommissionPolicyModel, ProductCommissionModel } from "./partner.models";
import { defaultPolicy, invalid, retailLines, type CommissionPolicy } from "./commission-calculation";
export async function resolveCollaborator(companyCode: string, id: unknown, session?: ClientSession) {
  if (!id) return undefined;
  const partner = await PartnerModel.findOne({ companyCode, _id: String(id), roles: "collaborator", status: "active" }).session(session || null).lean();
  if (!partner) throw invalid("CTV không tồn tại hoặc đã ngừng hoạt động.");
  return partner;
}
export async function snapshotPolicy(companyCode: string, partnerId: string, session?: ClientSession, allowMissing = false) {
  const partner = await resolveCollaborator(companyCode, partnerId, session);
  if (!partner) return undefined;
  const at = new Date();
  const policy = await CommissionPolicyModel.findOne({ companyCode, partnerId: String(partner._id), effectiveAt: { $lte: at } }).sort({ effectiveAt: -1 }).session(session || null).lean()
    || await CommissionPolicyModel.findOne({ companyCode, partnerId: "", effectiveAt: { $lte: at } }).sort({ effectiveAt: -1 }).session(session || null).lean();
  if (!policy && !allowMissing) throw invalid("Chưa có chính sách hoa hồng có hiệu lực.");
  return { partnerId: String(partner._id), partnerName: partner.name, policyId: policy ? String(policy._id) : "", policy: (policy?.config || defaultPolicy) as CommissionPolicy, lockedAt: at };
}
export async function snapshotRetail(order: any, session?: ClientSession) {
  if (!order.collaboratorId) return;
  const productRules = await ProductCommissionModel.find({ companyCode: order.companyCode, sku: { $in: order.items.map((item: any) => item.sku) } }).session(session || null).lean();
  const snapshot = await snapshotPolicy(order.companyCode, order.collaboratorId, session, order.items.every((item: any) => productRules.some(r => r.sku === item.sku && r.rule)));
  return { ...snapshot, productRules, lines: retailLines(order, snapshot!.policy, productRules.map(r => ({ sku: r.sku, rule: r.rule ?? null }))) };
}
