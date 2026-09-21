import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { departmentService } from "../service/department.service";

export class DepartmentController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      let companyCode = req.user?.companyCode || "";
      if (req.user?.role === "superadmin" && req.query.companyCode) {
        companyCode = String(req.query.companyCode);
      }

      const departments = await departmentService.list(companyCode);
      return res.status(200).json({
        status: "success",
        data: departments,
      });
    } catch (error: any) {
      console.error("[DepartmentController.list] Lỗi:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể tải danh sách phòng ban.",
      });
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      let companyCode = req.user?.companyCode || "";
      if (req.user?.role === "superadmin" && req.body.companyCode) {
        companyCode = String(req.body.companyCode);
      }

      if (!companyCode) {
        return res.status(400).json({
          status: "error",
          message: "Thiếu mã công ty (companyCode).",
        });
      }

      const department = await departmentService.create(companyCode, req.body);
      return res.status(201).json({
        status: "success",
        data: department,
        message: "Tạo phòng ban thành công.",
      });
    } catch (error: any) {
      console.error("[DepartmentController.create] Lỗi:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể tạo phòng ban.",
      });
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const isSuperAdmin = req.user?.role === "superadmin";
      let companyCode = req.user?.companyCode || "";

      if (isSuperAdmin && req.body.companyCode) {
        companyCode = String(req.body.companyCode);
      }

      const department = await departmentService.update(
        companyCode,
        id,
        req.body,
        isSuperAdmin
      );

      return res.status(200).json({
        status: "success",
        data: department,
        message: "Cập nhật thông tin phòng ban thành công.",
      });
    } catch (error: any) {
      console.error("[DepartmentController.update] Lỗi:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể cập nhật phòng ban.",
      });
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const isSuperAdmin = req.user?.role === "superadmin";
      const companyCode = req.user?.companyCode || "";

      await departmentService.delete(companyCode, id, isSuperAdmin);

      return res.status(200).json({
        status: "success",
        message: "Xóa phòng ban thành công.",
      });
    } catch (error: any) {
      console.error("[DepartmentController.delete] Lỗi:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể xóa phòng ban.",
      });
    }
  }
}

export const departmentController = new DepartmentController();
