import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailOrderController } from "../controllers/retail-order.controller";
import { retailSePayController } from "../controllers/retail-sepay.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";
export const retailOrderRoutes = Router(); const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
retailOrderRoutes.post("/checkout/reconcile", operate, retailOrderController.reconcileCheckout as any);
retailOrderRoutes.post("/checkout/revoke", operate, retailOrderController.revokeCheckout as any);
retailOrderRoutes.post("/draft-requests/reconcile", operate, retailOrderController.reconcileDraftRequest as any);
retailOrderRoutes.post("/draft-requests/revoke", operate, retailOrderController.revokeDraftRequest as any);
retailOrderRoutes.post("/quote", operate, retailOrderController.quote as any);
retailOrderRoutes.get("/products", operate, retailOrderController.products as any);
retailOrderRoutes.get("/idempotency/:key", operate, retailOrderController.idempotency as any);
retailOrderRoutes.get("/", operate, retailOrderController.list as any);
retailOrderRoutes.post("/", operate, retailOrderController.create as any);
retailOrderRoutes.get("/:id", operate, retailOrderController.detail as any);
retailOrderRoutes.get("/:id/payment-qr", operate, retailSePayController.qr as any);
retailOrderRoutes.patch("/:id", operate, retailOrderController.update as any);
retailOrderRoutes.post("/:id/confirm", operate, retailOrderController.confirm as any);
retailOrderRoutes.post("/:id/payments", operate, retailOrderController.collect as any);
retailOrderRoutes.post("/:id/cancel", operate, retailOrderController.cancel as any);
retailOrderRoutes.delete("/:id", operate, retailOrderController.deleteCancelled as any);

retailOrderRoutes.post("/:id/payments/reconcile", operate, retailOrderController.reconcileCollection as any);

retailOrderRoutes.post("/:id/payments/revoke", operate, retailOrderController.revokeCollection as any);

retailOrderRoutes.post("/:id/cancel/reconcile", operate, retailOrderController.reconcileCancellation as any);

retailOrderRoutes.post("/:id/cancel/revoke", operate, retailOrderController.revokeCancellation as any);
