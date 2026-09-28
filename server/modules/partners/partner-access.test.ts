import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { permissionRouteDiagnostics } from '../../config/permission-route-inventory';
vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.headers['x-test-user']) return res.status(401).json({error:'unauthenticated'});
    req.user = {id:req.headers['x-test-user'],companyCode:'ACME',role:'user'}; next();
  },
  requirePermission: (permissions: string | string[]) => (req: any,res: any,next: any) => {
    if (!(Array.isArray(permissions) ? permissions : [permissions]).includes(String(req.headers['x-test-permission']))) return res.status(403).json({error:'forbidden'});
    next();
  },
}));
vi.mock('./commission.service', () => ({startCommissionRecovery:vi.fn(),closePartnerMonths:vi.fn(),recordPartnerPayout:vi.fn()}));
import { partnerRouter } from './router';
import { PartnerModel, CommissionLedgerModel, CommissionPolicyModel } from './partner.models';
import { RetailOrderModel } from '../retail/models/retail-order.model';
import { RepairTicketModel } from '../repair/repair-ticket.model';
import { SupplierModel } from '../../model/supplier.model';
import { GoodsReceiptModel } from '../../model/goods-receipt.model';
import { FinanceDebtModel } from '../finance/models/financial-reporting.model';
import { UserModel } from '../../model/user.model';
let server: Server | undefined;
afterEach(async () => { vi.restoreAllMocks(); if (server) await new Promise<void>(resolve => server!.close(() => resolve())); });
async function request(path: string, headers: Record<string,string> = {}, init: RequestInit = {}) {
  const app = express(); app.use(express.json()); app.use('/partners',partnerRouter); app.use((error: any,_req: any,res: any,_next: any)=>res.status(error.status || 500).json({error:error.message}));
  server = app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server!.once('listening',resolve));
  return fetch(`http://127.0.0.1:${(server.address() as any).port}/partners${path}`,{headers, ...init});
}
describe('partner route isolation', () => {
  it.each(['collaborator', 'dealer'])('creates %s accounts as portal accounts without organizational fields', async role => {
    vi.spyOn(PartnerModel, 'findOne').mockReturnValue({ lean: async () => ({ _id: '507f1f77bcf86cd799439011', companyCode: 'ACME', name: 'Partner', email: 'partner@example.com', roles: [role], status: 'active' }) } as any);
    vi.spyOn(UserModel, 'exists').mockResolvedValue(null);
    const create = vi.spyOn(UserModel, 'create').mockResolvedValue({ _id: '507f1f77bcf86cd799439012' } as any);
    vi.spyOn(PartnerModel, 'findOneAndUpdate').mockReturnValue({ lean: async () => ({ userId: '507f1f77bcf86cd799439012' }) } as any);
    const response = await request('/507f1f77bcf86cd799439011/account', { 'x-test-user': 'admin', 'x-test-permission': 'partner:manage', 'Content-Type': 'application/json' }, { method: 'POST', body: JSON.stringify({ password: 'TestPassword123' }) });
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ accountType: 'partner', permissions: ['partner-self:read'] }));
    const input = create.mock.calls[0][0];
    expect(input).not.toHaveProperty('department');
    expect(input).not.toHaveProperty('division');
    expect(input).not.toHaveProperty('parentId');
  });
  it('allows inventory staff to pick only active, linked supplier partners', async () => {
    const partners = vi.spyOn(PartnerModel, 'find').mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [
      { _id: 'partner-1', code: 'DT-1', supplierId: 'supplier-1' },
      { _id: 'partner-2', code: 'DT-2', supplierId: 'inactive-supplier' },
    ] }) }) } as any);
    const suppliers = vi.spyOn(SupplierModel, 'find').mockReturnValue({ select: () => ({ lean: async () => [{ _id: 'supplier-1', name: 'NCC đối tác' }] }) } as any);
    const res = await request('/suppliers', { 'x-test-user': 'warehouse', 'x-test-permission': 'inventory:read' });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([{ _id: 'partner-1', code: 'DT-1', supplierId: 'supplier-1', name: 'NCC đối tác' }]);
    expect(partners).toHaveBeenCalledWith({ companyCode: 'ACME', roles: 'supplier', status: 'active', supplierId: { $type: 'string' } });
    expect(suppliers).toHaveBeenCalledWith({ companyCode: 'ACME', status: 'active', _id: { $in: ['supplier-1', 'inactive-supplier'] } });
  });
  it('denies the supplier picker to partner self-service accounts', async () => {
    const res = await request('/suppliers', { 'x-test-user': 'ctv', 'x-test-permission': 'partner-self:read' });
    expect(res.status).toBe(403);
  });
  it('returns complete inventory supplier fields in partner profiles', async () => {
    const supplierId = '507f1f77bcf86cd799439012';
    vi.spyOn(PartnerModel, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [{ supplierId, roles: ['supplier'], name: 'Old name' }] }) }) } as any);
    const find = vi.spyOn(SupplierModel, 'find').mockReturnValue({ lean: async () => [{ _id: supplierId, code: 'NCC-1', name: 'Updated supplier', taxCode: '0312345678', paymentTerms: '30 days', notes: 'Morning delivery', status: 'inactive' }] } as any);
    const res = await request('/', { 'x-test-user': 'admin', 'x-test-permission': 'partner:read' });
    expect(res.status).toBe(200);
    expect((await res.json()).data[0]).toMatchObject({ supplierCode: 'NCC-1', name: 'Updated supplier', taxCode: '0312345678', paymentTerms: '30 days', notes: 'Morning delivery', status: 'inactive' });
    expect(find).toHaveBeenCalledWith({ companyCode: 'ACME', _id: { $in: [supplierId] } });
  });
  it('preserves suppliers with receipt history when deleting a partner', async () => {
    vi.spyOn(PartnerModel, 'findOne').mockResolvedValue({ _id: '507f1f77bcf86cd799439011', supplierId: '507f1f77bcf86cd799439012', balance: 0 } as any);
    vi.spyOn(CommissionLedgerModel, 'exists').mockResolvedValue(null);
    vi.spyOn(RetailOrderModel, 'exists').mockResolvedValue(null);
    vi.spyOn(RepairTicketModel, 'exists').mockResolvedValue(null);
    vi.spyOn(GoodsReceiptModel, 'exists').mockResolvedValue({ _id: 'receipt' } as any);
    vi.spyOn(FinanceDebtModel, 'exists').mockResolvedValue(null);
    const remove = vi.spyOn(SupplierModel, 'deleteOne');
    const res = await request('/507f1f77bcf86cd799439011', { 'x-test-user': 'admin', 'x-test-permission': 'partner:manage' }, { method: 'DELETE' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/phiếu nhập hoặc công nợ/);
    expect(remove).not.toHaveBeenCalled();
  });
  it('registers authentication and canonical permission guards on every new mutation', () => {
    const diagnostics = permissionRouteDiagnostics(process.cwd()).filter(d => d.sourceFile === 'server/modules/partners/router.ts' || (d.sourceFile === 'server/modules/repair/router.ts' && d.path === '/tickets/:id/refunds'));
    expect(diagnostics).toEqual([]);
  });
  it('requires authentication',async()=>{expect((await request('/')).status).toBe(401);});
  it('does not grant a CTV access to the management statement endpoint',async()=>{expect((await request('/507f1f77bcf86cd799439011/statement',{'x-test-user':'me','x-test-permission':'partner-self:read'})).status).toBe(403);});
  it('rejects cross-company access before reading the database',async()=>{
    const spy=vi.spyOn(PartnerModel,'findOne');
    expect((await request('/me/statement?companyCode=OTHER',{'x-test-user':'me','x-test-permission':'partner-self:read'})).status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });
  it('derives the CTV from the logged in user, ignoring a supplied partnerId',async()=>{
    const find=vi.spyOn(PartnerModel,'findOne').mockReturnValueOnce({select:()=>({lean:async()=>({_id:'507f1f77bcf86cd799439011'})})} as any).mockReturnValueOnce({lean:async()=>({_id:'507f1f77bcf86cd799439011',name:'Me',balance:0})} as any);
    vi.spyOn(CommissionLedgerModel,'find').mockReturnValue({sort:()=>({skip:()=>({limit:()=>({lean:async()=>[]})})})} as any);
    vi.spyOn(CommissionLedgerModel,'countDocuments').mockResolvedValue(0);
    vi.spyOn(CommissionLedgerModel,'aggregate').mockResolvedValue([]);
    vi.spyOn(RetailOrderModel,'find').mockReturnValue({select:()=>({limit:()=>({lean:async()=>[]})})} as any);
    vi.spyOn(RepairTicketModel,'find').mockReturnValue({select:()=>({limit:()=>({lean:async()=>[]})})} as any);
    expect((await request('/me/statement?partnerId=someone-else',{'x-test-user':'me','x-test-permission':'partner-self:read'})).status).toBe(200);
    expect(find.mock.calls[0][0]).toEqual({companyCode:'ACME',userId:'me',roles:'collaborator'});
  });
  it('requires partner:manage permission to delete a partner', async () => {
    const res = await request('/507f1f77bcf86cd799439011', { 'x-test-user': 'me', 'x-test-permission': 'partner:read' }, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
  it('rejects deleting partner if balance is non-zero', async () => {
    vi.spyOn(PartnerModel, 'findOne').mockResolvedValue({ _id: '507f1f77bcf86cd799439011', balance: 50000 } as any);
    const res = await request('/507f1f77bcf86cd799439011', { 'x-test-user': 'admin', 'x-test-permission': 'partner:manage' }, { method: 'DELETE' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/vẫn còn số dư hoa hồng/);
  });
  it('deletes partner successfully when there are no constraints', async () => {
    vi.spyOn(PartnerModel, 'findOne').mockResolvedValue({ _id: '507f1f77bcf86cd799439011', balance: 0 } as any);
    vi.spyOn(CommissionLedgerModel, 'exists').mockResolvedValue(null);
    vi.spyOn(RetailOrderModel, 'exists').mockResolvedValue(null);
    vi.spyOn(RepairTicketModel, 'exists').mockResolvedValue(null);
    vi.spyOn(CommissionPolicyModel, 'deleteMany').mockResolvedValue({ deletedCount: 0 } as any);
    const deleteSpy = vi.spyOn(PartnerModel, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);
    const res = await request('/507f1f77bcf86cd799439011', { 'x-test-user': 'admin', 'x-test-permission': 'partner:manage' }, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith({ companyCode: 'ACME', _id: '507f1f77bcf86cd799439011' });
  });
});

