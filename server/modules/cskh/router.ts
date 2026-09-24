import { Router } from "express";
import {
  listCskhConversations,
  getCskhConversation,
  findOrCreateConversationByTicket,
  listCskhMessages,
  sendCskhMessage,
  markConversationRead,
  updateCskhStatus,
  generateCskhAiSuggestion,
} from "./cskh.service";
import {
  getZaloConfigs,
  saveZaloConfig,
  testZaloConnection,
  getZaloOAuthUrl,
  disconnectZaloConfig,
} from "./services/cskh-zalo.service";

export const cskhRouter = Router();

const scope = (req: any) => {
  const companyCode = req.query.companyCode || req.headers["x-company-code"] || req.user?.companyCode;
  if (!companyCode) throw Object.assign(new Error("Mã doanh nghiệp là bắt buộc."), { statusCode: 400 });
  return { companyCode: String(companyCode).toUpperCase() };
};

const actor = (req: any) => ({
  id: String(req.user?.id || req.user?.uid || ""),
  name: String(req.user?.displayName || req.user?.email || "Nhân viên"),
});

// Danh sách hội thoại
cskhRouter.get("/conversations", async (req, res, next) => {
  try {
    const data = await listCskhConversations(scope(req), {
      status: req.query.status as any,
      q: req.query.q as string,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Mở hoặc tạo phiên chat từ phiếu sửa chữa
cskhRouter.post("/conversations/open-by-ticket", async (req, res, next) => {
  try {
    const data = await findOrCreateConversationByTicket(
      scope(req),
      {
        ticketId: req.body.ticketId,
        ticketCode: req.body.ticketCode,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        channel: req.body.channel,
      },
      actor(req)
    );
    return res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Chi tiết hội thoại + thông tin phiếu
cskhRouter.get("/conversations/:id", async (req, res, next) => {
  try {
    const data = await getCskhConversation(scope(req), req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Danh sách tin nhắn trong hội thoại
cskhRouter.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const data = await listCskhMessages(scope(req), req.params.id, {
      limit: Number(req.query.limit),
      before: req.query.before as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Gửi tin nhắn mới
cskhRouter.post("/conversations/:id/messages", async (req, res, next) => {
  try {
    const data = await sendCskhMessage(
      scope(req),
      req.params.id,
      {
        content: req.body.content,
        senderType: req.body.senderType,
        attachments: req.body.attachments,
      },
      actor(req)
    );
    return res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Đánh dấu đã đọc
cskhRouter.post("/conversations/:id/read", async (req, res, next) => {
  try {
    const data = await markConversationRead(scope(req), req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Cập nhật trạng thái hội thoại
cskhRouter.patch("/conversations/:id/status", async (req, res, next) => {
  try {
    const data = await updateCskhStatus(scope(req), req.params.id, req.body.status);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// AI gợi ý câu trả lời CSKH theo ngữ cảnh máy
cskhRouter.post("/conversations/:id/ai-suggest", async (req, res, next) => {
  try {
    const data = await generateCskhAiSuggestion(
      scope(req),
      req.params.id,
      req.body.instruction
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Cấu hình Zalo OA đa trung tâm
cskhRouter.get("/zalo-config", async (req, res, next) => {
  try {
    const data = await getZaloConfigs(scope(req).companyCode);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

cskhRouter.put("/zalo-config", async (req, res, next) => {
  try {
    const data = await saveZaloConfig(scope(req).companyCode, req.body.branchId, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

cskhRouter.post("/zalo-config/test", async (req, res, next) => {
  try {
    const data = await testZaloConnection(scope(req).companyCode, req.body.branchId);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

cskhRouter.post("/zalo-config/disconnect", async (req, res, next) => {
  try {
    const data = await disconnectZaloConfig(scope(req).companyCode, req.body.branchId);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Lấy link đăng nhập Zalo OA OAuth 2.0
cskhRouter.get("/zalo-oauth/authorize", async (req, res, next) => {
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    const data = await getZaloOAuthUrl(
      scope(req).companyCode,
      String(req.query.branchId || "ALL"),
      origin
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
