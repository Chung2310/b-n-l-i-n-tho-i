import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { hasEffectiveRetailCapability } from "../permissions";
import { RetailOrderService, serializeRetailOrder } from "../services/retail-order.service";
import { RetailProductService } from "../services/retail-product.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
export const retailOrderController = {
  reconcileDraftRequest: async (req: Request, res: Response) => {
    try { const actor = (req as any).user || {}; res.json({ success: true, data: await RetailOrderService.reconcileDraftRequest(scope(req), req.body || {}, actor, await hasEffectiveRetailCapability(actor, "manager")) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  revokeDraftRequest: async (req: Request, res: Response) => {
    try { const actor = (req as any).user || {}; res.json({ success: true, data: await RetailOrderService.revokeDraftRequest(scope(req), req.body || {}, actor, await hasEffectiveRetailCapability(actor, "manager")) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  reconcileCheckout: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {}, manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.reconcileCheckout(scope(req), req.body || {}, actor, manager);
      res.json({ success: true, data: result.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  revokeCheckout: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {}, manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.revokeCheckout(scope(req), req.body || {}, actor, manager);
      res.json({ success: true, data: result.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  quote: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailOrderService.quote(scope(req), req.body || {}) });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  products: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailProductService.search(scope(req), req.query) });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  idempotency: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailOrderService.idempotency(scope(req), req.params.key) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  list: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const canSeeCost = await hasEffectiveRetailCapability(actor, "manager");
      const query = { ...req.query } as any;
      if ((query.heldOnly === "true" || query.heldOnly === true) && !canSeeCost) query.ownerId = String(actor.id || actor.uid || "");
      const data = await RetailOrderService.list(scope(req), query);
      res.json({ success: true, data: { ...data, items: data.items.map((order) => serializeRetailOrder(order, canSeeCost)) } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  detail: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      res.json({ success: true, data: serializeRetailOrder(await RetailOrderService.detail(scope(req), req.params.id, actor, manager), manager) });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  create: async (req: Request, res: Response) => {
    try {
      res.status(201).json({ success: true, data: await RetailOrderService.createDraft(scope(req), req.body || {}, (req as any).user) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  update: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailOrderService.updateDraft(scope(req), req.params.id, req.body || {}, (req as any).user, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  confirm: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      res.json({ success: true, data: await RetailOrderService.confirm(scope(req), req.params.id, req.body || {}, actor, undefined, await hasEffectiveRetailCapability(actor, "manager")) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  revokeCollection: async (req: Request, res: Response) => {
    try { res.json({ success: true, data: await RetailOrderService.revokeCollection(scope(req), req.params.id, req.body || {}, (req as any).user) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  reconcileCollection: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.reconcileCollection(scope(req), req.params.id, req.body || {}, actor);
      res.json({ success: true, data: result?.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  collect: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailOrderService.collect(scope(req), req.params.id, req.body || {}, (req as any).user, undefined) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  revokeCancellation: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      res.json({ success: true, data: await RetailOrderService.revokeCancellation(scope(req), req.params.id, req.body || {}, actor, await hasEffectiveRetailCapability(actor, "manager")) });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  reconcileCancellation: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.reconcileCancellation(scope(req), req.params.id, req.body || {}, actor, manager);
      res.json({ success: true, data: result?.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  cancel: async (req: Request, res: Response) => {
    try {
      const retailScope = scope(req);
      res.json({ success: true, data: await RetailOrderService.cancel(retailScope, req.params.id, req.body || {}, (req as any).user, undefined, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, ...(error.code ? { code: error.code } : {}) });
    }
  },
  deleteCancelled: async (req: Request, res: Response) => {
    try { res.json({ success: true, data: await RetailOrderService.deleteCancelled(scope(req), req.params.id) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
  },
};
