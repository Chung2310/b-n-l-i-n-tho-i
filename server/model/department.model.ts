import { Schema, model } from "mongoose";
import { IDepartment } from "../interface/department.interface";

const DepartmentSchema = new Schema<IDepartment>(
  {
    companyCode: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    managerUid: {
      type: String,
      trim: true,
      default: "",
    },
    managerName: {
      type: String,
      trim: true,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Đảm bảo mã phòng ban là duy nhất trong cùng một công ty
DepartmentSchema.index({ companyCode: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ companyCode: 1, name: 1 });

export const DepartmentModel = model<IDepartment>("Department", DepartmentSchema);
