import Joi from "joi";

const tierSchema = Joi.object({
  code: Joi.string().lowercase().regex(/^[a-z0-9-]{1,30}$/).required().messages({
    "any.required": "Mã hạng 'code' là bắt buộc.",
    "string.empty": "Mã hạng không được để trống.",
    "string.pattern.base": "Mã hạng chỉ được phép chứa chữ thường không dấu, số và dấu gạch ngang (tối đa 30 ký tự).",
  }),
  name: Joi.string().trim().max(50).required().messages({
    "any.required": "Tên hạng 'name' là bắt buộc.",
    "string.empty": "Tên hạng không được để trống.",
    "string.max": "Tên hạng tối đa 50 ký tự.",
  }),
  minGrossProfit: Joi.number().integer().min(0).default(0).messages({
    "number.base": "Mức lợi nhuận gộp tối thiểu phải là một số.",
    "number.integer": "Mức lợi nhuận gộp tối thiểu phải là số nguyên.",
    "number.min": "Mức lợi nhuận gộp tối thiểu phải lớn hơn hoặc bằng 0.",
  }),
  minSpend: Joi.number().integer().min(0).optional().messages({
    "number.base": "Mức chi tiêu tối thiểu phải là một số.",
    "number.integer": "Mức chi tiêu tối thiểu phải là số nguyên.",
    "number.min": "Mức chi tiêu tối thiểu phải lớn hơn hoặc bằng 0.",
  }),
  pointMultiplier: Joi.number().min(1).max(10).default(1).optional(),
  discountPercent: Joi.number().min(0).max(100).default(0).optional(),
  color: Joi.string().trim().max(20).allow("").optional(),
});

const pointsPolicySchema = Joi.object({
  enabled: Joi.boolean().required(),
  grossProfitPerPoint: Joi.number().integer().min(100).required().messages({
    "number.min": "Tỷ lệ lãi gộp tích điểm tối thiểu 100đ.",
  }),
  pointRedeemValue: Joi.number().integer().min(1).required().messages({
    "number.min": "Giá trị quy đổi điểm tối thiểu 1đ.",
  }),
  maxRedeemPercent: Joi.number().min(1).max(100).required().messages({
    "number.min": "Giới hạn trần tiêu điểm tối thiểu 1%.",
    "number.max": "Giới hạn trần tiêu điểm tối đa 100%.",
  }),
  minOrderTotalForRedeem: Joi.number().integer().min(0).required(),
  allowRepairRedeem: Joi.boolean().default(true),
  allowRetailRedeem: Joi.boolean().default(true),
});

export const updateCustomerSettingsSchema = {
  body: Joi.object({
    tierEvaluationMetric: Joi.string().valid("gross_profit", "sales").optional(),
    evaluationWindow: Joi.string().valid("rolling12Months", "allTime").optional(),
    customerTiers: Joi.array().min(1).max(10).items(tierSchema).required().messages({
      "any.required": "Danh sách phân hạng 'customerTiers' là bắt buộc.",
      "array.base": "Danh sách phân hạng phải là một mảng.",
      "array.min": "Phải có ít nhất 1 phân hạng khách hàng.",
      "array.max": "Tối đa chỉ cho phép 10 phân hạng khách hàng.",
    }),
    pointsPolicy: pointsPolicySchema.optional(),
  }).unknown(false),
};
