import crypto from "crypto";
import { CskhZaloConfigModel } from "../models/cskh-zalo-config.model";
import { CskhConversationModel } from "../models/cskh-conversation.model";
import { CskhMessageModel } from "../models/cskh-message.model";
import { BranchModel } from "../../../model/branch.model";

export function generatePkce() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function renderOAuthResultHtml(options: {
  success: boolean;
  title: string;
  message: string;
  payload?: any;
}) {
  const statusColor = options.success ? "#059669" : "#e11d48";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${options.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); max-width: 440px; text-align: center; border: 1px solid #e2e8f0; }
    h2 { color: ${statusColor}; margin-top: 0; font-size: 20px; }
    p { font-size: 14px; line-height: 1.6; color: #475569; }
    .btn { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #0284c7; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; cursor: pointer; border: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${options.title}</h2>
    <p>${options.message}</p>
    <p style="font-size: 12px; color: #94a3b8;">Cửa sổ này sẽ tự động đóng lại...</p>
    <button class="btn" onclick="window.close()">Đóng cửa sổ</button>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(${JSON.stringify({
          type: "ZALO_AUTH_RESULT",
          success: options.success,
          ...options.payload,
        })}, "*");
      }
    } catch (e) {}
    setTimeout(function() {
      window.close();
    }, 2000);
  </script>
</body>
</html>`;
}

/**
 * Tạo URL ủy quyền đăng nhập Zalo OA (OAuth 2.0 PKCE)
 */
export async function getZaloOAuthUrl(companyCode: string, branchId: string, origin: string) {
  const code = companyCode.toUpperCase();
  const bid = String(branchId || "ALL").trim();

  let config = await CskhZaloConfigModel.findOne({ companyCode: code, branchId: bid });
  if (!config?.appId || !config?.secretKey) {
    const fallbackAll = await CskhZaloConfigModel.findOne({ companyCode: code, branchId: "ALL" });
    if (fallbackAll?.appId && fallbackAll?.secretKey) {
      if (!config) {
        config = await CskhZaloConfigModel.create({
          companyCode: code,
          branchId: bid,
          appId: fallbackAll.appId,
          secretKey: fallbackAll.secretKey,
        });
      } else {
        config.appId = fallbackAll.appId;
        config.secretKey = fallbackAll.secretKey;
      }
    }
  }

  const appId = process.env.ZALO_APP_ID || config?.appId;
  const secretKey = process.env.ZALO_SECRET_KEY || config?.secretKey;

  if (!appId || !secretKey) {
    throw Object.assign(
      new Error(
        "Hệ thống máy chủ chưa cấu hình Zalo App (ZALO_APP_ID & ZALO_SECRET_KEY). Vui lòng cấu hình 1 lần trong file .env."
      ),
      { statusCode: 400 }
    );
  }

  const { codeVerifier, codeChallenge } = generatePkce();
  const state = `${code}:${bid}:${crypto.randomBytes(6).toString("hex")}`;

  if (config) {
    config.oauthCodeVerifier = codeVerifier;
    config.oauthState = state;
    await config.save();
  } else {
    await CskhZaloConfigModel.create({
      companyCode: code,
      branchId: bid,
      appId,
      secretKey,
      oauthCodeVerifier: codeVerifier,
      oauthState: state,
    });
  }

  const redirectUri = `${origin}/api/v1/webhook/zalo/oauth/callback`;
  const authUrl = `https://oauth.zalo.me/v4/oa/permission?app_id=${encodeURIComponent(
    appId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&state=${encodeURIComponent(
    state
  )}`;

  return { authUrl, redirectUri, appId };
}

/**
 * Xử lý Callback khi người dùng đăng nhập & cấp quyền Zalo OA thành công
 */
export async function handleZaloOAuthCallback(
  params: { code?: string; oa_id?: string; state?: string; error?: string; error_description?: string },
  origin: string
) {
  const { code, oa_id, state, error, error_description } = params;

  if (error || !code || !state) {
    const errorMsg = error_description || error || "Người dùng đã huỷ hoặc không cấp quyền cho ứng dụng Zalo OA.";
    return {
      success: false,
      message: errorMsg,
      html: renderOAuthResultHtml({
        success: false,
        title: "Kết nối Zalo OA không thành công",
        message: errorMsg,
      }),
    };
  }

  const parts = state.split(":");
  const companyCode = (parts[0] || "").toUpperCase();
  const branchId = parts[1] || "ALL";

  const config = await CskhZaloConfigModel.findOne({ companyCode, branchId });
  if (!config) {
    const msg = `Không tìm thấy cấu hình phiên chờ cho doanh nghiệp ${companyCode} - chi nhánh ${branchId}.`;
    return {
      success: false,
      message: msg,
      html: renderOAuthResultHtml({ success: false, title: "Lỗi kết nối", message: msg }),
    };
  }

  const appId = process.env.ZALO_APP_ID || config.appId;
  const secretKey = process.env.ZALO_SECRET_KEY || config.secretKey;

  try {
    const tokenRes = await fetch("https://oauth.zalo.me/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: secretKey,
      },
      body: new URLSearchParams({
        code,
        app_id: appId,
        grant_type: "authorization_code",
        code_verifier: config.oauthCodeVerifier || "",
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      const msg = `Zalo báo lỗi (${tokenData.error}): ${tokenData.message}`;
      return {
        success: false,
        message: msg,
        html: renderOAuthResultHtml({ success: false, title: "Lỗi xác thực Zalo", message: msg }),
      };
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = Number(tokenData.expires_in) || 86400;

    config.accessToken = accessToken;
    if (refreshToken) config.refreshToken = refreshToken;
    config.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    config.isConnected = true;
    config.lastTestedAt = new Date();
    config.lastTestStatus = "success";
    config.oauthCodeVerifier = "";
    config.oauthState = "";

    // Lấy tên và avatar của Official Account
    let oaName = config.oaName;
    let oaAvatar = config.oaAvatar;
    let finalOaId = oa_id || config.oaId;

    try {
      const oaRes = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
        headers: { access_token: accessToken },
      });
      const oaData = await oaRes.json();
      if (oaData.error === 0 && oaData.data) {
        oaName = oaData.data.name || oaName;
        oaAvatar = oaData.data.avatar || oaAvatar;
        if (oaData.data.oa_id) finalOaId = String(oaData.data.oa_id);
      }
    } catch {
      // Bỏ qua lỗi phụ nếu mạng chập chờn
    }

    if (finalOaId) config.oaId = finalOaId;
    if (oaName) config.oaName = oaName;
    if (oaAvatar) config.oaAvatar = oaAvatar;
    config.lastTestMessage = `Đã liên kết OAuth thành công với Official Account: ${oaName || finalOaId}`;
    await config.save();

    return {
      success: true,
      data: { oaId: config.oaId, oaName: config.oaName, branchId: config.branchId },
      html: renderOAuthResultHtml({
        success: true,
        title: "🎉 Kết nối Zalo OA thành công!",
        message: `Đã liên kết tài khoản <b>${config.oaName || config.oaId}</b> với ${config.branchName || "hệ thống"}.`,
        payload: { oaId: config.oaId, oaName: config.oaName, branchId: config.branchId },
      }),
    };
  } catch (err: any) {
    const msg = `Lỗi mạng khi xác thực với Zalo: ${err?.message || err}`;
    return {
      success: false,
      message: msg,
      html: renderOAuthResultHtml({ success: false, title: "Lỗi kết nối", message: msg }),
    };
  }
}

/**
 * Tự động làm mới Access Token khi hết hạn qua Refresh Token
 */
export async function refreshZaloAccessToken(companyCode: string, branchId: string) {
  const code = companyCode.toUpperCase();
  const bid = String(branchId || "ALL").trim();
  const config = await CskhZaloConfigModel.findOne({ companyCode: code, branchId: bid });
  const appId = process.env.ZALO_APP_ID || config?.appId;
  const secretKey = process.env.ZALO_SECRET_KEY || config?.secretKey;

  if (!config || !config.refreshToken || !appId || !secretKey) return null;

  try {
    const res = await fetch("https://oauth.zalo.me/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: secretKey,
      },
      body: new URLSearchParams({
        refresh_token: config.refreshToken,
        app_id: appId,
        grant_type: "refresh_token",
      }).toString(),
    });
    const data = await res.json();
    if (data.error === 0 && data.access_token) {
      config.accessToken = data.access_token;
      if (data.refresh_token) config.refreshToken = data.refresh_token;
      config.tokenExpiresAt = new Date(Date.now() + (Number(data.expires_in) || 86400) * 1000);
      config.isConnected = true;
      await config.save();
      return config.accessToken;
    }
  } catch {
    // Không làm gián đoạn
  }
  return null;
}

export async function getZaloConfigs(companyCode: string) {
  const configs = await CskhZaloConfigModel.find({
    companyCode: companyCode.toUpperCase(),
  }).lean();

  const branches = await BranchModel.find({
    companyCode: companyCode.toUpperCase(),
    isActive: { $ne: false },
  })
    .select("_id code name")
    .lean();

  const hasMasterApp = !!(
    process.env.ZALO_APP_ID ||
    configs.some((c) => c.appId && c.secretKey)
  );

  return { configs, branches, hasMasterApp };
}

export async function saveZaloConfig(
  companyCode: string,
  branchId: string,
  data: {
    branchName?: string;
    oaId?: string;
    oaName?: string;
    appId?: string;
    secretKey?: string;
    accessToken?: string;
    refreshToken?: string;
    webhookSecret?: string;
    isActive?: boolean;
  }
) {
  const code = companyCode.toUpperCase();
  const bid = String(branchId || "ALL").trim();

  let branchName = data.branchName;
  if (!branchName && bid !== "ALL") {
    const branch = await BranchModel.findOne({ companyCode: code, _id: bid }).select("name").lean();
    if (branch) branchName = branch.name;
  }

  const update: any = {
    ...data,
    branchName: branchName || (bid === "ALL" ? "Toàn bộ trung tâm" : "Chi nhánh"),
  };

  const config = await CskhZaloConfigModel.findOneAndUpdate(
    { companyCode: code, branchId: bid },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return config;
}

export async function disconnectZaloConfig(companyCode: string, branchId: string) {
  const code = companyCode.toUpperCase();
  const bid = String(branchId || "ALL").trim();

  const config = await CskhZaloConfigModel.findOne({ companyCode: code, branchId: bid });
  if (!config) throw Object.assign(new Error("Chưa có cấu hình Zalo cho trung tâm này."), { statusCode: 404 });

  config.isConnected = false;
  config.accessToken = "";
  config.refreshToken = "";
  config.oaId = "";
  config.oaName = "";
  config.oaAvatar = "";
  config.tokenExpiresAt = undefined;
  config.lastTestedAt = new Date();
  config.lastTestStatus = undefined;
  config.lastTestMessage = "Đã ngắt kết nối";
  await config.save();

  return config.toObject();
}

export async function testZaloConnection(companyCode: string, branchId: string) {
  const code = companyCode.toUpperCase();
  const bid = String(branchId || "ALL").trim();

  const config = await CskhZaloConfigModel.findOne({ companyCode: code, branchId: bid });
  if (!config) throw Object.assign(new Error("Chưa có cấu hình Zalo cho trung tâm này."), { statusCode: 404 });

  if (!config.oaId || !config.accessToken) {
    config.isConnected = false;
    config.lastTestedAt = new Date();
    config.lastTestStatus = "failed";
    config.lastTestMessage = "Thiếu Zalo OA ID hoặc Access Token.";
    await config.save();
    return {
      connected: false,
      message: config.lastTestMessage,
    };
  }

  try {
    // Gọi Zalo OpenAPI lấy thông tin OA để kiểm tra token
    const res = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
      headers: {
        access_token: config.accessToken,
      },
    });

    const data = await res.json();
    if (data.error === 0) {
      config.isConnected = true;
      config.lastTestedAt = new Date();
      config.lastTestStatus = "success";
      config.lastTestMessage = `Kết nối thành công tới Zalo OA: ${data.data?.name || config.oaName || config.oaId}`;
      if (data.data?.name) config.oaName = data.data.name;
      await config.save();
      return { connected: true, message: config.lastTestMessage, oaInfo: data.data };
    } else {
      config.isConnected = false;
      config.lastTestedAt = new Date();
      config.lastTestStatus = "failed";
      config.lastTestMessage = `Zalo API báo lỗi (${data.error}): ${data.message}`;
      await config.save();
      return { connected: false, message: config.lastTestMessage };
    }
  } catch (err: any) {
    config.isConnected = false;
    config.lastTestedAt = new Date();
    config.lastTestStatus = "failed";
    config.lastTestMessage = `Không thể kết nối máy chủ Zalo: ${err?.message || err}`;
    await config.save();
    return { connected: false, message: config.lastTestMessage };
  }
}

/**
 * Xử lý Webhook gửi từ Zalo OA khi khách hàng nhắn tin hoặc tương tác
 */
export async function handleZaloWebhook(payload: any, query: Record<string, any>) {
  if (!payload) return { status: "ignored", reason: "EMPTY_PAYLOAD" };

  const eventName = payload.event_name;
  const oaId = String(payload.oa_id || query.oaId || "");
  const senderId = payload.sender?.id || payload.user_id_by_app;
  const messageText = payload.message?.text || "";

  // Tìm cấu hình Zalo OA của trung tâm/chi nhánh tương ứng
  // Ưu tiên 1: Theo branchId từ URL riêng của từng chi nhánh (?branchId=...)
  // Ưu tiên 2: Theo oaId từ Zalo payload (tự động phân loại nếu dùng chung 1 URL)
  // Ưu tiên 3: Theo cấu hình mặc định ALL của công ty
  let config: any = null;
  const companyCodeUpper = String(query.companyCode || "").toUpperCase();

  if (query.branchId && query.branchId !== "ALL") {
    config = await CskhZaloConfigModel.findOne({
      ...(companyCodeUpper ? { companyCode: companyCodeUpper } : {}),
      branchId: String(query.branchId),
    }).lean();
  }

  if (!config && oaId) {
    config = await CskhZaloConfigModel.findOne({
      ...(companyCodeUpper ? { companyCode: companyCodeUpper } : {}),
      oaId,
    }).lean();
  }

  if (!config && companyCodeUpper) {
    config = await CskhZaloConfigModel.findOne({
      companyCode: companyCodeUpper,
      branchId: "ALL",
    }).lean();
  }

  const companyCode = config?.companyCode || companyCodeUpper || "ANHKHOA";
  const branchId = config?.branchId && config.branchId !== "ALL" ? config.branchId : undefined;
  const branchName = config?.branchName || undefined;

  if (eventName === "user_send_text" || eventName === "user_send_image" || messageText) {
    const customerPhone = payload.sender?.phone || query.phone || `zalo_${senderId}`;
    const customerName = payload.sender?.name || `Khách Zalo (${senderId?.slice?.(-4) || "mới"})`;

    let conversation = await CskhConversationModel.findOne({
      companyCode,
      $or: [{ customerPhone }, { tags: `zalo_uid:${senderId}` }],
    });

    if (!conversation) {
      conversation = await CskhConversationModel.create({
        companyCode,
        branchId,
        branchName,
        customerName,
        customerPhone,
        channel: "zalo",
        status: "open",
        lastMessage: messageText || "Đã gửi tệp/ảnh",
        lastMessageAt: new Date(),
        unreadCount: 1,
        tags: ["Sửa chữa", `zalo_uid:${senderId}`, ...(oaId ? [`oa:${oaId}`] : [])],
      });
    } else {
      conversation.lastMessage = messageText || "Đã gửi tệp/ảnh";
      conversation.lastMessageAt = new Date();
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
      conversation.status = "open";
      if (!conversation.branchId && branchId) {
        conversation.branchId = branchId;
        conversation.branchName = branchName;
      }
      await conversation.save();
    }

    await CskhMessageModel.create({
      companyCode,
      conversationId: conversation._id,
      senderType: "customer",
      senderName: customerName,
      content: messageText || "Khách hàng đã gửi một hình ảnh.",
      createdAt: new Date(),
    });

    return { status: "processed", conversationId: conversation._id, branchId, branchName };
  }

  return { status: "ignored", reason: `UNHANDLED_EVENT_${eventName}` };
}
