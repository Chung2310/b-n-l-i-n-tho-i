// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PartnersPage from './PartnersPage';
import { partnerRequest } from './partnerApi';
const auth = vi.hoisted(() => ({ permissions: ['partner-self:read'] }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => auth.permissions.includes(p) }) }));
vi.mock('./partnerApi', () => ({ partnerRequest: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); auth.permissions = ['partner-self:read']; });
const statement = { partner: {name:'CTV An', balance:-200000}, entries:[], sums:[], total:0, kpi:{machines:19,bonus:1000000,provisional:false,nextThreshold:20} };
it('CTV sees only their own statement and a transparent negative balance', async () => {
  vi.mocked(partnerRequest).mockResolvedValue(statement);
  render(<PartnersPage />);
  await screen.findByText(/Sao kê hoa hồng CTV An/);
  expect(vi.mocked(partnerRequest).mock.calls[0][0]).toBe('/me/statement');
  expect(screen.queryByText('Thêm đối tác')).toBeNull();
  expect(screen.getByText(/Số âm được bù trừ/)).toBeTruthy();
  expect(screen.getByText('19 máy')).toBeTruthy();
});
it('filters the three partner groups without exposing payout controls to read-only staff', async () => {
  auth.permissions = ['partner:read'];
  vi.mocked(partnerRequest).mockResolvedValue([
    {_id:'1',code:'C1',name:'CTV An',roles:['collaborator'],status:'active',balance:100},
    {_id:'2',code:'D1',name:'Đại lý Bình',roles:['dealer'],status:'active',balance:0},
    {_id:'3',code:'N1',name:'NCC Minh',roles:['supplier'],status:'active',balance:0},
  ]);
  render(<PartnersPage />); await screen.findByText('CTV An');
  await userEvent.selectOptions(screen.getByLabelText('Nhóm đối tác'),'dealer');
  expect(screen.getByText('Đại lý Bình')).toBeTruthy();
  expect(screen.queryByText('CTV An')).toBeNull();
  expect(screen.queryByText('Xác nhận đã chi')).toBeNull();
});
it('clears old statement data when a new month cannot be loaded', async () => {
  vi.mocked(partnerRequest).mockResolvedValueOnce(statement).mockRejectedValueOnce(new Error('Không tải được sao kê'));
  render(<PartnersPage />); await screen.findByText('19 máy');
  const input = screen.getByLabelText('Tháng sao kê');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(input,{target:{value:'2025-01'}});
  await screen.findByRole('alert');
  await waitFor(() => expect(screen.queryByText('19 máy')).toBeNull());
});
