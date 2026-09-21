import { Schema, model } from "mongoose";
import type { IPayrollCustomVariable } from "../interface/payroll-period-input.interface";
const calculationSchema = new Schema({
  expression: { type: String, trim: true },
  leftSource: String,
  operator: { type: String, enum: ["add", "subtract", "multiply", "divide", "percent"] },
  rightType: { type: String, enum: ["value", "source"] },
  rightValue: Number,
  rightSource: String,
  roundingMode: { type: String, enum: ["none", "nearest", "up", "down"], default: "none" },
  roundingUnit: { type: Number, default: 1 },
}, { _id: false });

const schema = new Schema<IPayrollCustomVariable>({
  companyCode: { type: String, required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: String,
  unit: { type: String, enum: ["money", "number", "days", "hours", "minutes", "percent"], required: true },
  defaultValue: Number,
  columnType: { type: String, enum: ["manual", "calculated"], default: "manual" },
  calculation: calculationSchema,
  status: { type: String, enum: ["draft", "active", "retired"], default: "draft", index: true },
  version: { type: Number, default: 0 },
  createdBy: { type: String, required: true },
  activatedBy: String,
  retiredBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, code: 1 }, { unique: true });
export const PayrollCustomVariableModel = model<IPayrollCustomVariable>("PayrollCustomVariable", schema);
