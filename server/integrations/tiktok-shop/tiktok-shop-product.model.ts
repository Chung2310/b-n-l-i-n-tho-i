import { Schema, model } from "mongoose";

const TikTokSkuSchema = new Schema({
  skuId: { type: String, default: "", trim: true },
  sellerSku: { type: String, default: "", trim: true },
  priceAmount: { type: String, default: "", trim: true },
  currency: { type: String, default: "", trim: true },
  inventoryQuantity: { type: Number, default: 0 },
  localProductId: { type: String, default: "", trim: true },
  localVariantId: { type: String, default: "", trim: true },
}, { _id: false });

const TikTokShopProductSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  connectionId: { type: String, required: true, trim: true, index: true },
  shopCipher: { type: String, required: true, trim: true, index: true },
  shopName: { type: String, default: "", trim: true },
  tiktokProductId: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  status: { type: String, default: "", trim: true },
  imageUrl: { type: String, default: "", trim: true },
  skus: { type: [TikTokSkuSchema], default: [] },
  tiktokCreateTime: { type: Date, default: null },
  tiktokUpdateTime: { type: Date, default: null },
  lastSeenAt: { type: Date, required: true },
}, { timestamps: true });

TikTokShopProductSchema.index({ companyCode: 1, connectionId: 1, shopCipher: 1, tiktokProductId: 1 }, { unique: true });
TikTokShopProductSchema.index({ companyCode: 1, "skus.sellerSku": 1 });

export const TikTokShopProductModel = model("TikTokShopProduct", TikTokShopProductSchema);
