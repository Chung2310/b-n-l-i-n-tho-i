import mongoose from "mongoose";
import { customerScopeFilter, resolveCustomerBranchScope } from "../modules/customer-management/customer-branch-scope";
import { DepartmentModel } from "../model/department.model";
import { UserModel } from "../model/user.model";
import { IDepartmentInput, IDepartmentWithStats } from "../interface/department.interface";

async function departmentScope(companyCode: string, branchId?: string) {
  if (!branchId) throw new Error("Branch is required");
  return customerScopeFilter(await resolveCustomerBranchScope({ companyCode, branchId }));
}
async function managerNameFor(scope: Record<string, unknown>, uid: string) {
  if (!uid) return "";
  const user = await UserModel.findOne({ ...scope, $or: [{ uid }, ...(mongoose.isValidObjectId(uid) ? [{ _id: uid }] : [])] }).lean();
  if (!user) throw new Error("Manager must belong to the selected branch");
  return user.displayName || "";
}
export class DepartmentService {
  async list(companyCode: string, branchId?: string): Promise<IDepartmentWithStats[]> {
    const filter = await departmentScope(companyCode, branchId);
    const departments = await DepartmentModel.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();

    // Thống kê số lượng nhân sự theo phòng ban trong công ty
    const userMatch = filter;
    const counts = await UserModel.aggregate([
      { $match: userMatch },
      { $group: { _id: "$department", count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    counts.forEach((c) => {
      if (c._id) {
        countMap.set(String(c._id).trim().toLowerCase(), c.count);
      }
    });

    return departments.map((d) => {
      const nameKey = String(d.name || "").trim().toLowerCase();
      const codeKey = String(d.code || "").trim().toLowerCase();
      const count = countMap.get(nameKey) || countMap.get(codeKey) || 0;

      return {
        _id: String(d._id),
        companyCode: d.companyCode,
        code: d.code,
        name: d.name,
        description: d.description || "",
        managerUid: d.managerUid || "",
        managerName: d.managerName || "",
        sortOrder: d.sortOrder || 0,
        isActive: d.isActive !== false,
        employeeCount: count,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
  }

  async create(companyCode: string, input: IDepartmentInput, branchId?: string): Promise<IDepartmentWithStats> {
    const scope = await departmentScope(companyCode, branchId);
    const code = String(input.code || "").trim().toUpperCase();
    const name = String(input.name || "").trim();

    if (!code) throw new Error("Mã phòng ban không được để trống.");
    if (!name) throw new Error("Tên phòng ban không được để trống.");

    const existing = await DepartmentModel.findOne({ ...scope, code }).lean();
    if (existing) {
      throw new Error(`Mã phòng ban "${code}" đã tồn tại trong doanh nghiệp.`);
    }

    const managerName = await managerNameFor(scope, input.managerUid || "");

    const doc = await DepartmentModel.create({
      companyCode,
      branchId,
      code,
      name,
      description: input.description || "",
      managerUid: input.managerUid || "",
      managerName,
      sortOrder: Number(input.sortOrder) || 0,
      isActive: input.isActive !== false,
    });

    return {
      _id: String(doc._id),
      companyCode: doc.companyCode,
      code: doc.code,
      name: doc.name,
      description: doc.description || "",
      managerUid: doc.managerUid || "",
      managerName: doc.managerName || "",
      sortOrder: doc.sortOrder,
      isActive: doc.isActive,
      employeeCount: 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async update(
    companyCode: string,
    id: string,
    input: Partial<IDepartmentInput>,
    isSuperAdmin = false,
    branchId?: string
  ): Promise<IDepartmentWithStats> {
    const scope = await departmentScope(companyCode, branchId);
    const filter = { _id: id, ...scope };
    const dept = await DepartmentModel.findOne(filter);
    if (!dept) {
      throw new Error("Không tìm thấy thông tin phòng ban.");
    }

    if (input.code && input.code.trim().toUpperCase() !== dept.code) {
      const newCode = input.code.trim().toUpperCase();
      const existing = await DepartmentModel.findOne({
        ...scope,
        code: newCode,
        _id: { $ne: id },
      }).lean();
      if (existing) {
        throw new Error(`Mã phòng ban "${newCode}" đã tồn tại.`);
      }
      dept.code = newCode;
    }

    if (input.name !== undefined) dept.name = input.name.trim();
    if (input.description !== undefined) dept.description = input.description.trim();
    if (input.sortOrder !== undefined) dept.sortOrder = Number(input.sortOrder) || 0;
    if (input.isActive !== undefined) dept.isActive = Boolean(input.isActive);

    if (input.managerUid !== undefined) {
      dept.managerUid = input.managerUid.trim();
      dept.managerName = await managerNameFor(scope, dept.managerUid);
    }

    await dept.save();

    // Lấy số lượng nhân sự
    const count = await UserModel.countDocuments({
      ...scope,
      department: dept.name,
    });

    return {
      _id: String(dept._id),
      companyCode: dept.companyCode,
      code: dept.code,
      name: dept.name,
      description: dept.description || "",
      managerUid: dept.managerUid || "",
      managerName: dept.managerName || "",
      sortOrder: dept.sortOrder,
      isActive: dept.isActive,
      employeeCount: count,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
    };
  }

  async delete(companyCode: string, id: string, isSuperAdmin = false, branchId?: string): Promise<void> {
    const scope = await departmentScope(companyCode, branchId);
    const filter = { _id: id, ...scope };
    const dept = await DepartmentModel.findOne(filter);
    if (!dept) {
      throw new Error("Không tìm thấy thông tin phòng ban để xóa.");
    }

    // Kiểm tra xem phòng ban có nhân sự hay không
    const userCount = await UserModel.countDocuments({
      ...scope,
      department: dept.name,
    });
    if (userCount > 0) {
      throw new Error(
        `Không thể xóa phòng ban "${dept.name}" vì hiện đang có ${userCount} nhân sự trực thuộc. Vui lòng chuyển nhân sự sang phòng ban khác trước.`
      );
    }

    await DepartmentModel.deleteOne({ _id: id });
  }
}

export const departmentService = new DepartmentService();
