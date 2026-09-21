import { Document } from "mongoose";

export interface IDepartment extends Document {
  companyCode: string;
  code: string;
  name: string;
  description?: string;
  managerUid?: string;
  managerName?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDepartmentInput {
  code: string;
  name: string;
  description?: string;
  managerUid?: string;
  managerName?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface IDepartmentWithStats {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  description?: string;
  managerUid?: string;
  managerName?: string;
  sortOrder: number;
  isActive: boolean;
  employeeCount: number;
  createdAt: Date;
  updatedAt: Date;
}
