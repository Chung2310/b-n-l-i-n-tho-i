import { Schema, model } from "mongoose";

// Durable company-wide key fence, separate from actual payment receipts.
const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  ticketId: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  requestFingerprint: { type: String, required: true },
  revision: { type: Number, default: 0 },
  revoked: { type: Boolean, default: false },
  revokedAt: Date,
  revokedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
export const RepairPaymentRequestModel = model("RepairPaymentRequest", schema);
