import { Schema, model } from "mongoose";
const partner = new Schema({
  companyCode: { type: String, required: true }, code: { type: String, required: true }, name: { type: String, required: true },
  roles: [{ type: String, enum: ["collaborator", "dealer", "supplier"] }], phone: String, email: String, address: String,
  status: { type: String, enum: ["active", "inactive"], default: "active" }, userId: String, supplierId: String, customerId: String,
  balance: { type: Number, default: 0 }, revision: { type: Number, default: 0 }, createdBy: String, updatedBy: String,
}, { timestamps: true });
partner.index({ companyCode: 1, code: 1 }, { unique: true });
partner.index({ companyCode: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "string" } } });
partner.index({ companyCode: 1, supplierId: 1 }, { unique: true, partialFilterExpression: { supplierId: { $type: "string" } } });
export const PartnerModel = model("RetailPartner", partner);
const policy = new Schema({ companyCode: { type: String, required: true }, partnerId: { type: String, default: "" }, effectiveAt: { type: Date, required: true }, config: { type: Schema.Types.Mixed, required: true }, createdBy: String }, { timestamps: true });
policy.index({ companyCode: 1, partnerId: 1, effectiveAt: 1 }, { unique: true });
export const CommissionPolicyModel = model("PartnerCommissionPolicy", policy);
const ledger = new Schema({
  companyCode: { type: String, required: true }, partnerId: { type: String, required: true }, branchId: String,
  sourceType: { type: String, required: true }, sourceId: { type: String, required: true }, sourceCode: String,
  line: { type: Number, default: 0 }, period: { type: String, required: true }, kind: { type: String, enum: ["earning", "reversal", "kpi", "payout"], required: true },
  amount: { type: Number, required: true }, machines: { type: Number, default: 0 }, calculation: Schema.Types.Mixed,
  reason: { type: String, required: true }, createdBy: String, reference: String, idempotencyKey: String,
}, { timestamps: true });
ledger.index({ companyCode: 1, partnerId: 1, period: 1, createdAt: -1 });
ledger.index({ companyCode: 1, sourceType: 1, sourceId: 1, line: 1 });
ledger.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
export const CommissionLedgerModel = model("PartnerCommissionLedger", ledger);
