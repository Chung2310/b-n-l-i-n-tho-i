import type { ClientSession } from "mongoose";
import { PartnerModel, CommissionPolicyModel } from "./partner.models";
import { invalid, retailLines, type CommissionPolicy } from "./commission-calculation";
export async function resolveCollaborator(companyCode: string, id: unknown, session?: ClientSession) {
  if (!id) return undefined;
  const partner = await PartnerModel.findOne({ companyCode, _id: String(id), roles: "collaborator", status: "active" }).session(session || null).lean();
  if (!partner) throw invalid("CTV không tồn tại hoặc đã ngừng hoạt động.");
  return partner;
}
export async function snapshotPolicy(companyCode: string, partnerId: string, session?: ClientSession) {
  const partner = await resolveCollaborator(companyCode, partnerId, session);
  if (!partner) return undefined;
  const at = new Date();
  const policy = await CommissionPolicyModel.findOne({ companyCode, partnerId: String(partner._id), effectiveAt: { $lte: at } }).sort({ effectiveAt: -1 }).session(session || null).lean()
    || await CommissionPolicyModel.findOne({ companyCode, partnerId: "", effectiveAt: { $lte: at } }).sort({ effectiveAt: -1 }).session(session || null).lean();
  if (!policy) throw invalid("Chưa có chính sách hoa hồng có hiệu lực.");
  return { partnerId: String(partner._id), partnerName: partner.name, policyId: String(policy._id), policy: policy.config as CommissionPolicy, lockedAt: at };
}
export async function snapshotRetail(order: any, session?: ClientSession) {
  if (!order.collaboratorId) return;
  const snapshot = await snapshotPolicy(order.companyCode, order.collaboratorId, session);
  return { ...snapshot, lines: retailLines(order, snapshot!.policy) };
}
