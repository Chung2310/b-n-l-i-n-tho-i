import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  ticketId: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  requestFingerprint: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  paidBefore: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
}, { timestamps: true });
schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, ticketId: 1, createdAt: 1 });
export const RepairPaymentModel = model("RepairPayment", schema);
