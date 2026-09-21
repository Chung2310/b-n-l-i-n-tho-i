import { Router } from "express";
import { departmentController } from "../controller/department.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";

export const departmentRouter = Router();

// Áp dụng middleware kiểm tra module HR
departmentRouter.use(requireAuth as any, requireModule("hr"));

departmentRouter.get(
  "/",
  requirePermission(["hr:read", "access:read", "hr:manage", "access:manage"]) as any,
  departmentController.list as any
);

departmentRouter.post(
  "/",
  requirePermission(["hr:manage", "access:manage"]) as any,
  departmentController.create as any
);

departmentRouter.put(
  "/:id",
  requirePermission(["hr:manage", "access:manage"]) as any,
  departmentController.update as any
);

departmentRouter.delete(
  "/:id",
  requirePermission(["hr:manage", "access:manage"]) as any,
  departmentController.delete as any
);
