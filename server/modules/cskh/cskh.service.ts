import { Types } from "mongoose";
import { CskhConversationModel } from "./models/cskh-conversation.model";
import { CskhMessageModel, type ICskhAttachment } from "./models/cskh-message.model";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { openrouterChat } from "../../service/openrouter.service";

export type CskhScope = { companyCode: string };
export type CskhActor = { id: string; name: string };

const toObjectId = (id: string | Types.ObjectId) =>
  Types.ObjectId.isValid(String(id)) ? new Types.ObjectId(String(id)) : id;

export async function listCskhConversations(
  scope: CskhScope,
  filter: { status?: "open" | "resolved"; q?: string; page?: number; limit?: number } = {}
) {
  const query: any = { companyCode: scope.companyCode.toUpperCase() };
  if (filter.status) query.status = filter.status;
  if (filter.q) {
    const regex = new RegExp(String(filter.q).trim(), "i");
    query.$or = [{ customerName: regex }, { customerPhone: regex }, { ticketCode: regex }];
  }

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 30));

  const [items, total] = await Promise.all([
    CskhConversationModel.find(query)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CskhConversationModel.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

export async function getCskhConversation(scope: CskhScope, conversationId: string) {
  const conversation = await CskhConversationModel.findOne({
    _id: conversationId,
    companyCode: scope.companyCode.toUpperCase(),
  }).lean();
  if (!conversation) throw Object.assign(new Error("Không tìm thấy hội thoại CSKH."), { statusCode: 404 });

  let ticket = null;
  if (conversation.ticketId) {
    ticket = await RepairTicketModel.findOne({
      _id: conversation.ticketId,
      companyCode: scope.companyCode.toUpperCase(),
    }).lean();
  }

  return { conversation, ticket };
}

export async function findOrCreateConversationByTicket(
  scope: CskhScope,
  input: {
    ticketId: string;
    ticketCode?: string;
    customerName: string;
    customerPhone: string;
    channel?: "zalo" | "sms" | "direct" | "web";
  },
  actor: CskhActor
) {
  const companyCode = scope.companyCode.toUpperCase();
  const phone = String(input.customerPhone || "").trim();
  const name = String(input.customerName || "").trim() || phone;
  const ticketId = String(input.ticketId || "").trim();

  let conversation = await CskhConversationModel.findOne({
    companyCode,
    ticketId,
  });

  if (!conversation) {
    conversation = await CskhConversationModel.findOne({
      companyCode,
      customerPhone: phone,
    });
  }

  if (!conversation) {
    conversation = await CskhConversationModel.create({
      companyCode,
      customerName: name,
      customerPhone: phone,
      ticketId: ticketId || undefined,
      ticketCode: input.ticketCode || undefined,
      channel: input.channel || "zalo",
      status: "open",
      assignedStaffId: actor.id,
      assignedStaffName: actor.name,
      tags: ["Sửa chữa"],
      lastMessage: "Bắt đầu cuộc trò chuyện CSKH",
      lastMessageAt: new Date(),
    });

    // Tạo tin nhắn chào mừng mặc định
    await CskhMessageModel.create({
      companyCode,
      conversationId: conversation._id,
      senderType: "staff",
      senderId: actor.id,
      senderName: actor.name,
      content: `Xin chào ${name}, Anh Khoa Mobile rất hân hạnh được hỗ trợ quý khách về phiếu sửa chữa ${input.ticketCode || ""}.`,
      createdAt: new Date(),
    });
  } else if (ticketId && conversation.ticketId !== ticketId) {
    conversation.ticketId = ticketId;
    if (input.ticketCode) conversation.ticketCode = input.ticketCode;
    await conversation.save();
  }

  return conversation.toObject();
}

export async function listCskhMessages(
  scope: CskhScope,
  conversationId: string,
  pagination: { limit?: number; before?: string } = {}
) {
  const companyCode = scope.companyCode.toUpperCase();
  const query: any = {
    companyCode,
    conversationId: toObjectId(conversationId),
  };
  if (pagination.before) {
    query.createdAt = { $lt: new Date(pagination.before) };
  }

  const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 50));
  const messages = await CskhMessageModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse();
}

export async function sendCskhMessage(
  scope: CskhScope,
  conversationId: string,
  input: {
    content: string;
    senderType?: "staff" | "customer" | "ai";
    attachments?: ICskhAttachment[];
  },
  actor: CskhActor
) {
  const companyCode = scope.companyCode.toUpperCase();
  const content = String(input.content || "").trim();
  if (!content) throw Object.assign(new Error("Nội dung tin nhắn không được để trống."), { statusCode: 400 });

  const conversation = await CskhConversationModel.findOne({
    _id: conversationId,
    companyCode,
  });
  if (!conversation) throw Object.assign(new Error("Không tìm thấy hội thoại CSKH."), { statusCode: 404 });

  const senderType = input.senderType || "staff";
  const message = await CskhMessageModel.create({
    companyCode,
    conversationId: conversation._id,
    senderType,
    senderId: senderType === "staff" ? actor.id : undefined,
    senderName: senderType === "staff" ? actor.name : senderType === "ai" ? "Trợ lý AI" : conversation.customerName,
    content,
    attachments: input.attachments || [],
    createdAt: new Date(),
  });

  conversation.lastMessage = content;
  conversation.lastMessageAt = new Date();
  if (senderType === "customer") {
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    conversation.status = "open";
  }
  await conversation.save();

  return message.toObject();
}

export async function markConversationRead(scope: CskhScope, conversationId: string) {
  const companyCode = scope.companyCode.toUpperCase();
  await CskhConversationModel.updateOne(
    { _id: conversationId, companyCode },
    { $set: { unreadCount: 0 } }
  );
  await CskhMessageModel.updateMany(
    { conversationId: toObjectId(conversationId), companyCode, isRead: false },
    { $set: { isRead: true } }
  );
  return { success: true };
}

export async function updateCskhStatus(
  scope: CskhScope,
  conversationId: string,
  status: "open" | "resolved"
) {
  const companyCode = scope.companyCode.toUpperCase();
  const conversation = await CskhConversationModel.findOneAndUpdate(
    { _id: conversationId, companyCode },
    { $set: { status } },
    { new: true }
  ).lean();
  if (!conversation) throw Object.assign(new Error("Không tìm thấy hội thoại CSKH."), { statusCode: 404 });
  return conversation;
}

export async function generateCskhAiSuggestion(
  scope: CskhScope,
  conversationId: string,
  customInstruction?: string
) {
  const companyCode = scope.companyCode.toUpperCase();
  const conversation = await CskhConversationModel.findOne({
    _id: conversationId,
    companyCode,
  }).lean();
  if (!conversation) throw Object.assign(new Error("Không tìm thấy hội thoại CSKH."), { statusCode: 404 });

  let ticketInfo = "Chưa gắn phiếu sửa chữa cụ thể.";
  if (conversation.ticketId) {
    const ticket: any = await RepairTicketModel.findOne({
      _id: conversation.ticketId,
      companyCode,
    }).lean();
    if (ticket) {
      ticketInfo = `
- Mã phiếu: ${ticket.ticketCode}
- Thiết bị: ${ticket.device?.name || "Không rõ"} (IMEI/Serial: ${ticket.device?.serialNumber || "—"})
- Triệu chứng lỗi báo: ${ticket.symptom || "—"}
- Trạng thái hiện tại: ${ticket.status}
- Kỹ thuật viên phụ trách: ${ticket.technicianName || "Chưa giao"}
- Tổng chi phí / Báo giá: ${Number(ticket.totalAmount || ticket.quotedAmount || 0).toLocaleString("vi-VN")} đ
- Đã thanh toán: ${Number(ticket.paidAmount || 0).toLocaleString("vi-VN")} đ
- Còn nợ: ${Number(ticket.dueAmount || 0).toLocaleString("vi-VN")} đ
      `.trim();
    }
  }

  const recentMessages = await CskhMessageModel.find({
    conversationId: toObjectId(conversationId),
    companyCode,
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const conversationHistory = recentMessages
    .reverse()
    .map((m) => `${m.senderName} (${m.senderType}): ${m.content}`)
    .join("\n");

  const systemPrompt = `Bạn là Trợ lý AI Marketing & CSKH chuyên nghiệp của thương hiệu "Anh Khoa Mobile".
Nhiệm vụ của bạn là soạn tin nhắn phản hồi cho nhân viên CSKH gửi tới khách hàng.
Yêu cầu:
- Xưng hô lịch sự, lễ phép, thân thiện: "Anh Khoa Mobile xin chào...", "Dạ...", "Cảm ơn quý khách...".
- Ngắn gọn, đúng thông tin kỹ thuật và tiến độ máy, không bịa đặt số liệu.
- Phù hợp với văn hóa chăm sóc khách hàng bán lẻ / sửa chữa điện thoại tại Việt Nam.
- Trả về thuần văn bản (plain text), KHÔNG dùng các ký tự markdown như #, **, __.

Thông tin khách hàng:
- Tên khách: ${conversation.customerName}
- Số điện thoại: ${conversation.customerPhone}

Thông tin phiếu sửa chữa:
${ticketInfo}

Lịch sử trao đổi gần nhất:
${conversationHistory || "Chưa có tin nhắn nào trước đó."}

${customInstruction ? `Yêu cầu bổ sung từ nhân viên: ${customInstruction}` : "Hãy soạn 1 tin nhắn trả lời phù hợp nhất với ngữ cảnh hiện tại."}`;

  const model = process.env.CHATBOT_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";
  const { text } = await openrouterChat({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Hãy soạn nội dung tin nhắn gợi ý." },
    ],
  });

  return { suggestion: text.trim() };
}
