// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

it('opens edit policy popup with existing data populated and submits update via PATCH', async () => {
  auth.permissions = ['partner:manage', 'commission-policy:manage'];
  const initialPolicies = {
    defaults: { phoneAmount: 200000, accessoryBps: 1000, repairBps: 1000, rules: [] },
    items: [
      {
        _id: 'pol-123',
        partnerId: 'ctv-1',
        effectiveAt: '2026-05-20T14:30:00.000Z',
        config: {
          phoneAmount: 250000,
          accessoryBps: 1200,
          repairBps: 1100,
          rules: [{ kind: 'phone', category: 'Flagship', amount: 280000 }],
        },
      },
    ],
  };

  vi.mocked(partnerRequest).mockImplementation(async (path, method) => {
    if (path === '/') return [{ _id: 'ctv-1', code: 'CTV1', name: 'CTV An', roles: ['collaborator'], status: 'active', balance: 0 }] as any;
    if (path === '/policies' && (!method || method === 'GET')) return initialPolicies as any;
    if (path === '/policies/pol-123' && method === 'PATCH') return { ok: true } as any;
    return {} as any;
  });

  render(<PartnersPage />);
  await screen.findByText('CTV An');

  const policyTabBtn = screen.getByRole('button', { name: /Chính sách/i });
  await userEvent.click(policyTabBtn);

  expect(await screen.findByRole('button', { name: /Sửa/i })).toBeTruthy();
  const editBtn = screen.getByRole('button', { name: /Sửa/i });
  await userEvent.click(editBtn);

  expect(screen.getByText('Sửa chính sách hoa hồng')).toBeTruthy();

  const phoneInput = screen.getByLabelText(/Điện thoại \/ máy \(VND\)/i) as HTMLInputElement;
  expect(phoneInput.value).toBe('250000');

  const accessoryInput = screen.getByLabelText(/Phụ kiện \(%\)/i) as HTMLInputElement;
  expect(accessoryInput.value).toBe('12');

  const repairInput = screen.getByLabelText(/Tiền công sửa chữa \(%\)/i) as HTMLInputElement;
  expect(repairInput.value).toBe('11');

  const effectiveAtInput = screen.getByLabelText(/Hiệu lực/i) as HTMLInputElement;
  expect(effectiveAtInput.value).not.toBe('');

  const ruleValueInput = screen.getByLabelText(/SKU hoặc nhóm hàng/i) as HTMLInputElement;
  expect(ruleValueInput.value).toBe('Flagship');

  const submitBtn = screen.getByRole('button', { name: /Cập nhật chính sách/i });
  await userEvent.click(submitBtn);

  await waitFor(() => {
    expect(vi.mocked(partnerRequest)).toHaveBeenCalledWith(
      '/policies/pol-123',
      'PATCH',
      expect.objectContaining({
        partnerId: 'ctv-1',
        config: expect.objectContaining({
          phoneAmount: 250000,
          accessoryBps: 1200,
          repairBps: 1100,
        }),
      })
    );
  });
});

it('does not require or submit password when adding a supplier partner', async () => {
  auth.permissions = ['partner:manage'];
  vi.mocked(partnerRequest).mockResolvedValueOnce([]).mockResolvedValueOnce({});
  render(<PartnersPage />);
  await userEvent.click(await screen.findByRole('button', { name: /Thêm đối tác/i }));
  await userEvent.type(screen.getByLabelText(/Mã đối tác/i), 'NCC-001');
  await userEvent.type(screen.getByLabelText(/Tên đối tác/i), 'Nhà cung cấp Apple');
  
  // Select Supplier role
  const supplierRadio = screen.getByRole('radio', { name: 'Nhà cung cấp' });
  await userEvent.click(supplierRadio);

  // Password input should not be in the document
  expect(screen.queryByLabelText(/Mật khẩu tài khoản/i)).toBeNull();
  expect(screen.getByText(/Hồ sơ Nhà cung cấp dùng để theo dõi nguồn hàng/i)).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }));
  await waitFor(() => expect(vi.mocked(partnerRequest).mock.calls[1]).toEqual([
    '/',
    'POST',
    expect.not.objectContaining({ accountPassword: expect.anything() }),
  ]));
});

it('prompts confirmation and deletes a partner from the table action', async () => {
  auth.permissions = ['partner:manage'];
  vi.mocked(partnerRequest)
    .mockResolvedValueOnce([{ _id: 'partner-99', code: 'CTV-99', name: 'CTV Thử Nghiệm', roles: ['collaborator'], status: 'active', balance: 0 }])
    .mockResolvedValueOnce({ id: 'partner-99', deleted: true })
    .mockResolvedValueOnce([]);

  render(<PartnersPage />);
  await screen.findByText('CTV Thử Nghiệm');

  const deleteBtn = screen.getByRole('button', { name: /Xóa CTV Thử Nghiệm/i });
  await userEvent.click(deleteBtn);

  // Confirmation dialog should appear
  expect(screen.getByText(/Bạn có chắc chắn muốn xóa đối tác "CTV Thử Nghiệm"/i)).toBeTruthy();

  const confirmBtn = screen.getByRole('button', { name: /^Xóa đối tác$/i });
  await userEvent.click(confirmBtn);

  await waitFor(() => {
    expect(vi.mocked(partnerRequest)).toHaveBeenCalledWith('/partner-99', 'DELETE');
  });
});

it('allows deleting partner directly from the edit modal', async () => {
  auth.permissions = ['partner:manage'];
  vi.mocked(partnerRequest)
    .mockResolvedValueOnce([{ _id: 'partner-88', code: 'CTV-88', name: 'Đại lý Cần Xóa', roles: ['dealer'], status: 'active', balance: 0 }])
    .mockResolvedValueOnce({ id: 'partner-88', deleted: true })
    .mockResolvedValueOnce([]);

  render(<PartnersPage />);
  await screen.findByText('Đại lý Cần Xóa');

  // Open edit modal
  const editBtn = screen.getByRole('button', { name: /^Sửa$/i });
  await userEvent.click(editBtn);

  expect(screen.getByText('Sửa thông tin đối tác')).toBeTruthy();

  // Click delete in edit modal
  const deleteModalBtn = screen.getByRole('button', { name: /Xóa đối tác/i });
  await userEvent.click(deleteModalBtn);

  // Confirmation dialog should appear
  expect(screen.getByText(/Bạn có chắc chắn muốn xóa đối tác "Đại lý Cần Xóa"/i)).toBeTruthy();

  const dialog = screen.getByRole('dialog');
  const confirmBtn = within(dialog).getByRole('button', { name: /^Xóa đối tác$/i });
  await userEvent.click(confirmBtn);

  await waitFor(() => {
    expect(vi.mocked(partnerRequest)).toHaveBeenCalledWith('/partner-88', 'DELETE');
  });
});

