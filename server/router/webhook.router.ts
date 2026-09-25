import { Router } from 'express';
import { retailSePayController } from '../modules/retail/controllers/retail-sepay.controller';

export const webhookRouter = Router();

// Keep the legacy SePay URL working while using the same company-aware

webhookRouter.post('/sepay/retail-payment', retailSePayController.webhook);

// Webhook nhận sự kiện và tin nhắn từ Zalo OA
webhookRouter.get('/zalo', (req, res) => {
  // Trả về challenge khi Zalo Developer xác thực webhook URL
  if (req.query.challenge) return res.send(String(req.query.challenge));
  return res.json({ status: "ok", service: "zalo-webhook" });
});

// OAuth Callback tiếp nhận redirect sau khi người dùng đồng ý cấp quyền Zalo OA
webhookRouter.get('/zalo/oauth/callback', async (req, res, next) => {
  try {
    const { handleZaloOAuthCallback } = await import('../modules/cskh/services/cskh-zalo.service');
    const origin = `${req.protocol}://${req.get('host')}`;
    const result = await handleZaloOAuthCallback(req.query as any, origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(result.html);
  } catch (error) {
    next(error);
  }
});

webhookRouter.post('/zalo', async (req, res, next) => {
  try {
    const { handleZaloWebhook } = await import('../modules/cskh/services/cskh-zalo.service');
    const result = await handleZaloWebhook(req.body, req.query);
    return res.json({ error: 0, message: "Success", result });
  } catch (error) {
    next(error);
  }
});
