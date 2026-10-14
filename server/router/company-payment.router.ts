import { Router } from "express";
import Joi from "joi";
import { requireAuth, requirePermission } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { encryptSecret } from "../security/crypto";

export const companyPaymentRouter = Router();
companyPaymentRouter.use(requireAuth as any);

const companyCode = (req: any) => String(req.user?.companyCode || "").toUpperCase();

const vietqrSchema = Joi.object({
  bankId: Joi.string().trim().allow("").max(20).required(),
  accountNo: Joi.string().trim().allow("").max(50).required(),
  accountName: Joi.string().trim().allow("").max(100).required(),
  sepayApiKey: Joi.string().trim().allow("").max(500).optional(),
  clearSePayApiKey: Joi.boolean().default(false),
});

// Payment screens need the receiving account. The secret itself is never returned.
companyPaymentRouter.get("/vietqr", async (req: any, res) => {
  try {
    const company: any = await CompanyModel.findOne({ code: companyCode(req) })
      .select("vietqrConfig.bankId vietqrConfig.accountNo vietqrConfig.accountName +vietqrConfig.sepayApiKeyEncrypted")
      .lean();
    const config = company?.vietqrConfig || {};
    return res.json({ data: {
      bankId: config.bankId || "",
      accountNo: config.accountNo || "",
      accountName: config.accountName || "",
      sepayApiKeyConfigured: Boolean(config.sepayApiKeyEncrypted),
    } });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
});

companyPaymentRouter.put("/vietqr", requirePermission("settings:manage") as any, async (req: any, res) => {
  const { error, value } = vietqrSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const set: Record<string, unknown> = {
      "vietqrConfig.bankId": value.bankId,
      "vietqrConfig.accountNo": value.accountNo,
      "vietqrConfig.accountName": value.accountName,
    };
    const unset: Record<string, ""> = {};
    if (value.clearSePayApiKey) unset["vietqrConfig.sepayApiKeyEncrypted"] = "";
    else if (value.sepayApiKey) set["vietqrConfig.sepayApiKeyEncrypted"] = encryptSecret(value.sepayApiKey);

    await CompanyModel.updateOne({ code: companyCode(req) }, {
      $set: set,
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    });
    const saved = await CompanyModel.findOne({ code: companyCode(req) })
      .select("+vietqrConfig.sepayApiKeyEncrypted")
      .lean() as any;
    return res.json({ data: {
      bankId: value.bankId,
      accountNo: value.accountNo,
      accountName: value.accountName,
      sepayApiKeyConfigured: Boolean(saved?.vietqrConfig?.sepayApiKeyEncrypted),
    }, message: "Đã cập nhật cấu hình thanh toán SePay." });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
});
