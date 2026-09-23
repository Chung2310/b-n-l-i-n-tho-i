import { Router } from "express";
import Joi from "joi";
import { dashboardController } from "../controller/dashboard.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

import { retailReportController } from "../modules/retail/controllers/retail-report.controller";
import { RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION } from "../modules/retail/permissions";

export const dashboardRouter = Router();

const summarySchema = {
  query: Joi.object({
    filter: Joi.string().valid("day", "week", "year", "custom").optional().messages({
      "any.only": "Bộ lọc thời gian phải là day, week, year hoặc custom.",
    }),
    startDate: Joi.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        "string.pattern.base": "startDate phải đúng định dạng YYYY-MM-DD.",
      }),
    endDate: Joi.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        "string.pattern.base": "endDate phải đúng định dạng YYYY-MM-DD.",
      }),
  }),
};

// Tổng hợp số liệu tất cả module cho trang tổng quan
dashboardRouter.get(
  "/summary",
  requireAuth as any,
  requirePermission("dashboard:read") as any,
  validateRequest(summarySchema),
  dashboardController.getSummary as any
);

// Việc cần xử lý hôm nay
dashboardRouter.get(
  "/action-items",
  requireAuth as any,
  requirePermission("dashboard:read") as any,
  dashboardController.getActionItems as any
);

// Reuse retail reporting with authentication scoped to this dashboard endpoint.
dashboardRouter.get(
  "/best-selling-products",
  requireAuth as any,
  requirePermission("dashboard:read") as any,
  requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any,
  retailReportController.summary as any
);
