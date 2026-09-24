import { Schema, model, Document, Types } from "mongoose";

export interface ICskhAttachment {
  url: string;
  filename: string;
  fileType: string;
  size?: number;
}

export interface ICskhMessage extends Document {
  companyCode: string;
  conversationId: Types.ObjectId;
  senderType: "staff" | "customer" | "ai";
  senderId?: string;
  senderName: string;
  content: string;
  attachments: ICskhAttachment[];
  isRead: boolean;
  createdAt: Date;
}

const CskhAttachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, default: "" },
    fileType: { type: String, default: "image" },
    size: { type: Number },
  },
  { _id: false }
);

const CskhMessageSchema = new Schema<ICskhMessage>(
  {
    companyCode: { type: String, required: true, uppercase: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "CskhConversation", required: true, index: true },
    senderType: { type: String, enum: ["staff", "customer", "ai"], required: true },
    senderId: { type: String },
    senderName: { type: String, default: "" },
    content: { type: String, required: true, trim: true },
    attachments: { type: [CskhAttachmentSchema], default: [] },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

CskhMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const CskhMessageModel = model<ICskhMessage>("CskhMessage", CskhMessageSchema);
