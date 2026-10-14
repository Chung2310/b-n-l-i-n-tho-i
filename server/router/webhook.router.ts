import { Router } from 'express';
import { createHash } from 'node:crypto';
import { retailSePayController } from '../modules/retail/controllers/retail-sepay.controller';
import { TikTokShopConnectionModel } from '../integrations/tiktok-shop/tiktok-shop-connection.model';
import { getTikTokShopWebhookConfig, verifyTikTokShopWebhookSignature } from '../integrations/tiktok-shop/tiktok-shop.client';
import { publishDomainEvent } from '../integrations/shared/event-bus';

export const webhookRouter = Router();

// Keep the legacy SePay URL working while using the same company-aware

webhookRouter.post('/sepay/retail-payment', retailSePayController.webhook);

webhookRouter.post('/tiktok-shop/order-status', async (req, res, next) => {
  try {
    const rawBody = Buffer.from(String((req as any).rawBody || ''), 'utf8');
    const config = getTikTokShopWebhookConfig();
    if (!rawBody.length || !verifyTikTokShopWebhookSignature(rawBody, String(req.get('authorization') || ''), config.appKey, config.appSecret)) {
      return res.sendStatus(401);
    }

    const body: any = req.body || {};
    const data: any = body.data || {};
    const sellerOpenId = String(body.seller_open_id || body.open_id || '').trim();
    const shopId = String(body.shop_id || data.shop_id || '').trim();
    const orderId = String(data.order_id || data.orderId || '').trim();
    const orderStatus = String(data.order_status || data.orderStatus || '').trim().toUpperCase();
    if (!sellerOpenId || !shopId || !orderId || !orderStatus) return res.sendStatus(200);

    const candidates: any[] = await TikTokShopConnectionModel.find({ openId: sellerOpenId }).select('companyCode openId shops').lean();
    const matches = candidates.flatMap((connection: any) => (connection.shops || [])
      .filter((shop: any) => String(shop.id || '') === shopId)
      .map((shop: any) => ({ connection, shop })));
    if (!matches.length) return res.sendStatus(200);
    if (matches.length > 1) {
      console.error('[tiktok-shop-webhook] ambiguous seller/shop mapping', { sellerOpenId, shopId, matchCount: matches.length });
      return res.status(409).send('Ambiguous TikTok shop mapping');
    }

    const { connection, shop } = matches[0];
    if (!String(shop.retailBranchId || '').trim()) return res.status(503).send('TikTok shop has no retail branch configured');
    const eventTimestamp = Number(body.timestamp || data.update_time || Math.floor(Date.now() / 1000));
    const notificationId = String(body.tts_notification_id || createHash('sha256').update(rawBody).digest('hex'));
    try {
      await publishDomainEvent({
        eventId: `tiktok-shop:${notificationId}`,
        eventType: 'tiktok.order.status.changed',
        companyCode: String(connection.companyCode),
        branchId: String(shop.retailBranchId || '') || undefined,
        aggregateType: 'TikTokShopOrder',
        aggregateId: `${String(shop.cipher)}:${orderId}`,
        occurredAt: new Date(eventTimestamp * 1000),
        actorId: 'tiktok-shop', actorName: 'TikTok Shop',
        payload: {
          notificationId, sellerOpenId, shopId, shopCipher: String(shop.cipher), orderId, orderStatus, eventTimestamp,
        },
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

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
