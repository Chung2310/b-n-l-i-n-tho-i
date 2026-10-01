import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  ticketId: { type: String, required: true },
  kind: { type: String, enum: ["issue", "return"], required: true },
  requestKey: { type: String, required: true },
  requestFingerprint: { type: String, required: true },
  revision: { type: Number, default: 0 },
  revoked: { type: Boolean, default: false },
  revokedAt: Date,
  revokedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, kind: 1, requestKey: 1 }, { unique: true });
export const RepairPartRequestModel = model("RepairPartRequest", schema);
