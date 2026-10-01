import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailAfterSaleController } from "../controllers/retail-after-sale.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";
export const retailAfterSaleRoutes = Router(); const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
retailAfterSaleRoutes.get("/:id", operate, retailAfterSaleController.detail as any);
retailAfterSaleRoutes.get("/", operate, retailAfterSaleController.list as any);
retailAfterSaleRoutes.post("/", operate, retailAfterSaleController.create as any);

retailAfterSaleRoutes.post("/reconcile", operate, retailAfterSaleController.reconcile as any);

retailAfterSaleRoutes.post("/revoke", operate, retailAfterSaleController.revoke as any);
