import { Schema, model } from "mongoose";

// Both receipt creation and revocation must write this durable key in their transaction.
const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  ticketCode: { type: String, required: true },
  requestFingerprint: { type: String, required: true },
  revision: { type: Number, default: 0 },
  revoked: { type: Boolean, default: false },
  revokedAt: Date,
  revokedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, ticketCode: 1 }, { unique: true });
export const RepairCreationRequestModel = model("RepairCreationRequest", schema);
