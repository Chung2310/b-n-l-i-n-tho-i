import { Schema, model, Document } from "mongoose";

export interface ICskhZaloConfig extends Document {
  companyCode: string;
  branchId: string; // "ALL" hoặc ID chi nhánh cụ thể
  branchName?: string;
  oaId: string;
  oaName: string;
  oaAvatar?: string;
  appId: string;
  secretKey: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt?: Date;
  webhookSecret: string;
  oauthCodeVerifier?: string;
  oauthState?: string;
  isActive: boolean;
  isConnected: boolean;
  lastTestedAt?: Date;
  lastTestStatus?: "success" | "failed";
  lastTestMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CskhZaloConfigSchema = new Schema<ICskhZaloConfig>(
  {
    companyCode: { type: String, required: true, uppercase: true, index: true },
    branchId: { type: String, default: "ALL", index: true },
    branchName: { type: String, default: "Toàn bộ trung tâm" },
    oaId: { type: String, default: "", trim: true },
    oaName: { type: String, default: "", trim: true },
    oaAvatar: { type: String, default: "", trim: true },
    appId: { type: String, default: "", trim: true },
    secretKey: { type: String, default: "", trim: true },
    accessToken: { type: String, default: "", trim: true },
    refreshToken: { type: String, default: "", trim: true },
    tokenExpiresAt: { type: Date },
    webhookSecret: { type: String, default: "", trim: true },
    oauthCodeVerifier: { type: String, default: "" },
    oauthState: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    isConnected: { type: Boolean, default: false },
    lastTestedAt: { type: Date },
    lastTestStatus: { type: String, enum: ["success", "failed"] },
    lastTestMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

CskhZaloConfigSchema.index({ companyCode: 1, branchId: 1 }, { unique: true });

export const CskhZaloConfigModel = model<ICskhZaloConfig>(
  "CskhZaloConfig",
  CskhZaloConfigSchema
);
