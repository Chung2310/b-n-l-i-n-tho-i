import { Schema, model, Document, Types } from "mongoose";

export interface ICskhConversation extends Document {
  companyCode: string;
  branchId?: string;
  branchName?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  ticketId?: string;
  ticketCode?: string;
  channel: "zalo" | "sms" | "direct" | "web";
  status: "open" | "resolved";
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  assignedStaffId?: string;
  assignedStaffName?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CskhConversationSchema = new Schema<ICskhConversation>(
  {
    companyCode: { type: String, required: true, uppercase: true, index: true },
    branchId: { type: String, index: true },
    branchName: { type: String, trim: true },
    customerId: { type: String, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true, index: true },
    ticketId: { type: String, index: true },
    ticketCode: { type: String, trim: true },
    channel: { type: String, enum: ["zalo", "sms", "direct", "web"], default: "zalo" },
    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unreadCount: { type: Number, default: 0 },
    assignedStaffId: { type: String },
    assignedStaffName: { type: String },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

CskhConversationSchema.index({ companyCode: 1, customerPhone: 1, ticketId: 1 });
CskhConversationSchema.index({ companyCode: 1, branchId: 1, lastMessageAt: -1 });
CskhConversationSchema.index({ companyCode: 1, lastMessageAt: -1 });

export const CskhConversationModel = model<ICskhConversation>(
  "CskhConversation",
  CskhConversationSchema
);
