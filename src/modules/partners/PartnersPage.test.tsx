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

it('only permits selecting a single partner group in the add partner form', async () => {
  auth.permissions = ['partner:manage'];
  vi.mocked(partnerRequest).mockResolvedValue([]);
  render(<PartnersPage />);
  const addBtn = await screen.findByRole('button', { name: /Thêm đối tác/i });
  await userEvent.click(addBtn);

  const ctvRadio = screen.getByRole('radio', { name: 'CTV' });
  const dealerRadio = screen.getByRole('radio', { name: 'Đại lý' });
  const supplierRadio = screen.getByRole('radio', { name: 'Nhà cung cấp' });

  // Initially CTV is default selected
  expect((ctvRadio as HTMLInputElement).checked).toBe(true);
  expect((dealerRadio as HTMLInputElement).checked).toBe(false);
  expect((supplierRadio as HTMLInputElement).checked).toBe(false);

  // Clicking Dealer unchecks CTV and selects only Dealer
  await userEvent.click(dealerRadio);
  expect((ctvRadio as HTMLInputElement).checked).toBe(false);
  expect((dealerRadio as HTMLInputElement).checked).toBe(true);
  expect((supplierRadio as HTMLInputElement).checked).toBe(false);

  // Clicking Supplier unchecks Dealer and selects only Supplier
  await userEvent.click(supplierRadio);
  expect((ctvRadio as HTMLInputElement).checked).toBe(false);
  expect((dealerRadio as HTMLInputElement).checked).toBe(false);
  expect((supplierRadio as HTMLInputElement).checked).toBe(true);
});

it('submits a password to provision the partner account when adding a partner', async () => {
  auth.permissions = ['partner:manage'];
  vi.mocked(partnerRequest).mockResolvedValueOnce([]).mockResolvedValueOnce({});
  render(<PartnersPage />);
  await userEvent.click(await screen.findByRole('button', { name: /Thêm đối tác/i }));
  await userEvent.type(screen.getByLabelText(/Mã đối tác/i), 'CTV-002');
  await userEvent.type(screen.getByLabelText(/Tên đối tác/i), 'CTV Bình');
  await userEvent.type(screen.getByLabelText(/^Email$/i), 'binh@example.com');
  await userEvent.type(screen.getByLabelText(/Mật khẩu tài khoản/i), 'secret123');
  await userEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }));
  await waitFor(() => expect(vi.mocked(partnerRequest).mock.calls[1]).toEqual([
    '/',
    'POST',
    expect.objectContaining({ email: 'binh@example.com', accountPassword: 'secret123' }),
  ]));
});
