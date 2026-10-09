import { beforeEach, expect, it, vi } from "vitest";
import { retailOrderController } from "../retail/controllers/retail-order.controller";
import { RetailOrderService } from "../retail/services/retail-order.service";
import { hasEffectiveRetailCapability } from "../retail/permissions";

vi.mock("../retail/permissions", () => ({ hasEffectiveRetailCapability: vi.fn() }));
vi.mock("../retail/services/retail-order.service", async importOriginal => {
  const actual = await importOriginal<typeof import("../retail/services/retail-order.service")>();
  return { ...actual, RetailOrderService: { reconcileCollection: vi.fn(), reconcileCancellation: vi.fn() } };
});
beforeEach(() => vi.resetAllMocks());
it.each([false, true])("serializes reconciled order using effective cost permission (%s)", async manager => {
  vi.mocked(hasEffectiveRetailCapability).mockResolvedValue(manager);
  const order: any = { _id: "o1", totalCost: 70, items: [{ sku: "SKU", unitCost: 70 }], paidAmount: 100 };
  vi.mocked(RetailOrderService.reconcileCollection).mockResolvedValue({ status: "completed", message: "verified", order });
  const req: any = { user: { id: "u1", companyCode: "A", branchId: "B" }, query: { companyCode: "A", branchId: "B" }, params: { id: "o1" }, body: { idempotencyKey: "k" } };
  const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await retailOrderController.reconcileCollection(req, res);
  expect(res.status).not.toHaveBeenCalled();
  const returned = res.json.mock.calls[0][0].data.order;
  expect(returned.totalCost).toBe(manager ? 70 : undefined);
  expect(returned.items[0].unitCost).toBe(manager ? 70 : undefined);
  expect(order.totalCost).toBe(70);
  expect(RetailOrderService.reconcileCollection).toHaveBeenCalledWith({ companyCode: "A", branchId: "B" }, "o1", req.body, req.user, undefined);
});
it("rejects a requested branch outside the actor scope before reconciliation", async () => {
  vi.mocked(hasEffectiveRetailCapability).mockResolvedValue(false);
  const req: any = { user: { id: "u1", companyCode: "A", branchId: "B" }, query: { branchId: "OTHER" }, params: { id: "o1" }, body: {} };
  const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await retailOrderController.reconcileCollection(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(RetailOrderService.reconcileCollection).not.toHaveBeenCalled();
});

it.each([false, true])('filters cancellation snapshot costs using current permission (%s)', async manager => {
  vi.mocked(hasEffectiveRetailCapability).mockResolvedValue(manager);
  vi.mocked(RetailOrderService.reconcileCancellation).mockResolvedValue({ status: 'completed', message: 'verified', order: { _id: 'o1', totalCost: 70, items: [{ unitCost: 70 }] } });
  const req: any = { user: { id: 'u1', companyCode: 'A', branchId: 'B' }, query: {}, params: { id: 'o1' }, body: {} };
  const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await retailOrderController.reconcileCancellation(req, res);
  expect(res.status).not.toHaveBeenCalled();
  const result = res.json.mock.calls[0][0].data.order;
  expect(result.totalCost).toBe(manager ? 70 : undefined);
  expect(result.items[0].unitCost).toBe(manager ? 70 : undefined);
  expect(RetailOrderService.reconcileCancellation).toHaveBeenCalledWith({ companyCode: 'A', branchId: 'B' }, 'o1', req.body, req.user, manager, undefined);
});
