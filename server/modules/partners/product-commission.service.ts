import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { ProductCatalogCategoryModel } from "../../model/product-catalog-resource.model";
import { CommissionPolicyModel, ProductCommissionModel } from "./partner.models";
import { defaultPolicy, invalid, validatePolicy } from "./commission-calculation";
import { runInTransaction } from "../../config/database";

export async function listProductCommissions(companyCode: string) {
  const [products, variants, categories, configurations, policies] = await Promise.all([
    ProductCatalogModel.find({ companyCode }).select("name categoryCode").lean(),
    ProductVariantModel.find({ companyCode }).select("productId sku displayName status").sort({ sku: 1 }).lean(),
    ProductCatalogCategoryModel.find({ companyCode }).select("code name parentCode").lean(),
    ProductCommissionModel.find({ companyCode }).lean(),
    CommissionPolicyModel.find({ companyCode, "config.rules.sku": { $exists: true } }).select("partnerId effectiveAt config.rules").lean(),
  ]);
  return { products, variants, categories, configurations, legacyRules: policies.flatMap(p => (p.config.rules || []).filter((r: any) => r.sku).map((rule: any) => ({ policyId: String(p._id), partnerId: p.partnerId, effectiveAt: p.effectiveAt, rule }))) };
}

export async function saveProductCommissions(companyCode: string, input: any, actorId: string) {
  if (!Array.isArray(input?.skus) || !input.skus.length || input.skus.length > 500 || input.skus.some((s: unknown) => typeof s !== "string" || !s.trim())) throw invalid("Chọn từ 1 đến 500 SKU.");
  const skus = [...new Set<string>(input.skus)];
  const count = await ProductVariantModel.countDocuments({ companyCode, sku: { $in: skus } });
  if (count !== skus.length) throw invalid("Sản phẩm không thuộc danh mục công ty.");
  const rules = input.rule === null ? null : validatePolicy({ ...defaultPolicy, rules: skus.map(sku => ({ ...input.rule, sku, category: undefined })) }).rules;
  await runInTransaction(async session => {
    await ProductCommissionModel.bulkWrite(skus.map((sku, index) => ({ updateOne: {
      filter: { companyCode, sku }, update: { $set: { rule: rules?.[index] ?? null, updatedBy: actorId } }, upsert: true,
    } })), session ? { session } : {});
  });
  return { updated: skus.length };
}
