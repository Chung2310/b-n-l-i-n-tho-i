import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailInvoiceController } from "../controllers/retail-invoice.controller";
import { RETAIL_MANAGER_PERMISSION } from "../permissions";
export const retailInvoiceRoutes = Router(); const read = requirePermission(["retail:read", RETAIL_MANAGER_PERMISSION]) as any;
retailInvoiceRoutes.get("/", read, retailInvoiceController.list as any);
retailInvoiceRoutes.get("/:id/pdf", read, retailInvoiceController.pdf as any);
retailInvoiceRoutes.get("/:id", read, retailInvoiceController.detail as any);
