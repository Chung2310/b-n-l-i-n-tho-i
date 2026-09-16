import { Router } from 'express';
import { retailSePayController } from '../modules/retail/controllers/retail-sepay.controller';

export const webhookRouter = Router();

// Keep the legacy SePay URL working while using the same company-aware

webhookRouter.post('/sepay/retail-payment', retailSePayController.webhook);
