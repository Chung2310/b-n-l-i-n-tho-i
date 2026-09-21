import { DepartmentModel } from "../model/department.model";
import { UserModel } from "../model/user.model";
import { IDepartmentInput, IDepartmentWithStats } from "../interface/department.interface";

export class DepartmentService {
  async list(companyCode: string): Promise<IDepartmentWithStats[]> {
    const filter = companyCode && companyCode !== "SYSTEM" ? { companyCode } : {};
    const departments = await DepartmentModel.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();

    // Thống kê số lượng nhân sự theo phòng ban trong công ty
    const userMatch = companyCode && companyCode !== "SYSTEM" ? { companyCode } : {};
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

  async create(companyCode: string, input: IDepartmentInput): Promise<IDepartmentWithStats> {
    const code = String(input.code || "").trim().toUpperCase();
    const name = String(input.name || "").trim();

    if (!code) throw new Error("Mã phòng ban không được để trống.");
    if (!name) throw new Error("Tên phòng ban không được để trống.");

    const existing = await DepartmentModel.findOne({ companyCode, code }).lean();
    if (existing) {
      throw new Error(`Mã phòng ban "${code}" đã tồn tại trong doanh nghiệp.`);
    }

    let managerName = input.managerName || "";
    if (input.managerUid && !managerName) {
      const managerUser = await UserModel.findOne({
        $or: [{ uid: input.managerUid }, { _id: input.managerUid }],
      }).lean();
      if (managerUser) {
        managerName = managerUser.displayName || "";
      }
    }

    const doc = await DepartmentModel.create({
      companyCode,
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
    isSuperAdmin = false
  ): Promise<IDepartmentWithStats> {
    const filter = isSuperAdmin ? { _id: id } : { _id: id, companyCode };
    const dept = await DepartmentModel.findOne(filter);
    if (!dept) {
      throw new Error("Không tìm thấy thông tin phòng ban.");
    }

    if (input.code && input.code.trim().toUpperCase() !== dept.code) {
      const newCode = input.code.trim().toUpperCase();
      const existing = await DepartmentModel.findOne({
        companyCode: dept.companyCode,
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
      if (dept.managerUid) {
        if (input.managerName) {
          dept.managerName = input.managerName;
        } else {
          const managerUser = await UserModel.findOne({
            $or: [{ uid: dept.managerUid }, { _id: dept.managerUid }],
          }).lean();
          dept.managerName = managerUser?.displayName || "";
        }
      } else {
        dept.managerName = "";
      }
    }

    await dept.save();

    // Lấy số lượng nhân sự
    const count = await UserModel.countDocuments({
      companyCode: dept.companyCode,
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

  async delete(companyCode: string, id: string, isSuperAdmin = false): Promise<void> {
    const filter = isSuperAdmin ? { _id: id } : { _id: id, companyCode };
    const dept = await DepartmentModel.findOne(filter);
    if (!dept) {
      throw new Error("Không tìm thấy thông tin phòng ban để xóa.");
    }

    // Kiểm tra xem phòng ban có nhân sự hay không
    const userCount = await UserModel.countDocuments({
      companyCode: dept.companyCode,
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
