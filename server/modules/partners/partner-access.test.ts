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
let server: Server | undefined;
afterEach(async () => { vi.restoreAllMocks(); if (server) await new Promise<void>(resolve => server!.close(() => resolve())); });
async function request(path: string, headers: Record<string,string> = {}, init: RequestInit = {}) {
  const app = express(); app.use('/partners',partnerRouter); app.use((error: any,_req: any,res: any,_next: any)=>res.status(error.status || 500).json({error:error.message}));
  server = app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server!.once('listening',resolve));
  return fetch(`http://127.0.0.1:${(server.address() as any).port}/partners${path}`,{headers, ...init});
}
describe('partner route isolation', () => {
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

