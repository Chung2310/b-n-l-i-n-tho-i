import type { NextFunction, Request, Response } from "express";
import { CustomerError } from "../customer-errors";
import { CustomerPointService } from "../services/customer-point.service";

function getCompanyCode(req: Request): string {
  const user = (req as any).user || {};
  const rawCompanyCode = user.role === "superadmin" ? req.query.companyCode : user.companyCode;
  const companyCode = String(rawCompanyCode || "").trim().toUpperCase();
  if (!companyCode) {
    throw new CustomerError("CUSTOMER_COMPANY_REQUIRED", "Phạm vi công ty là bắt buộc.", 400);
  }
  return companyCode;
}

const handle = (action: (req: Request, res: Response) => Promise<Response>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    return await action(req, res);
  } catch (error) {
    if (error instanceof CustomerError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    const statusCode = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || "Đã xảy ra lỗi.";
    return res.status(statusCode).json({ success: false, message });
  }
};

export const customerPointController = {
  getLedger: handle(async (req, res) => {
    const companyCode = getCompanyCode(req);
    const customerId = String(req.params.id || "").trim();
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const type = req.query.type ? String(req.query.type) : undefined;

    const result = await CustomerPointService.getPointLedger(companyCode, customerId, {
      page,
      limit,
      type,
    });
    return res.json({ success: true, data: result });
  }),

  adjust: handle(async (req, res) => {
    const companyCode = getCompanyCode(req);
    const customerId = String(req.params.id || "").trim();
    const user = (req as any).user || {};

    const points = Number(req.body.points);
    const reasonCategory = req.body.reasonCategory || "correction";
    const reason = String(req.body.reason || "").trim();

    const actor = {
      id: String(user.id || user._id || "system"),
      name: String(user.displayName || user.name || user.email || "Quản lý"),
    };

    const ledger = await CustomerPointService.grantManualPoints({
      companyCode,
      branchId: user.branchId,
      customerId,
      points,
      reasonCategory,
      reason,
      actor,
    });

    return res.json({ success: true, data: ledger });
  }),
};
