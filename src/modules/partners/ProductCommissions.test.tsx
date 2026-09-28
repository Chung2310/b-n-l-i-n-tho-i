// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductCommissions } from './ProductCommissions';
import { partnerRequest } from './partnerApi';
import { toast } from '../../pages/Toast';

vi.mock('./partnerApi', () => ({ partnerRequest: vi.fn() }));
vi.mock('../../pages/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockData = {
  products: [
    { _id: 'p', name: 'iPhone 13', categoryCode: 'PHONE' },
    { _id: 'acc1', name: 'Củ sạc', categoryCode: 'ACC' },
  ],
  categories: [
    { code: 'PHONE', name: 'Điện thoại' },
    { code: 'ACC', name: 'Phụ kiện' },
  ],
  variants: [
    { _id: 'v1', productId: 'p', sku: 'IP13-128', displayName: 'iPhone 13 128GB' },
    { _id: 'v2', productId: 'p', sku: 'IP13-256', displayName: 'iPhone 13 256GB' },
    { _id: 'v3', productId: 'acc1', sku: 'CHG-20W', displayName: 'Củ sạc nhanh 20W' },
  ],
  configurations: [
    { sku: 'IP13-128', rule: { kind: 'phone' as const, amount: 250000 } },
  ],
  legacyRules: [],
};

it('selects all variants from a category and saves a standalone bulk rate', async () => {
  vi.mocked(partnerRequest).mockResolvedValue(mockData);
  render(<ProductCommissions />);

  fireEvent.click(await screen.findByLabelText('Chọn Điện thoại'));
  fireEvent.click(screen.getByRole('button', { name: 'Cấu hình đã chọn (2)' }));
  fireEvent.change(screen.getByLabelText('Mức riêng'), { target: { value: '300000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

  await waitFor(() =>
    expect(partnerRequest).toHaveBeenCalledWith('/product-commissions', 'PUT', {
      skus: ['IP13-128', 'IP13-256'],
      rule: { kind: 'phone', amount: 300000 },
    })
  );
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã lưu cấu hình hoa hồng sản phẩm.'));
});

it('resets a customized SKU back to general policy using "Dùng chính sách"', async () => {
  vi.mocked(partnerRequest).mockResolvedValue(mockData);
  render(<ProductCommissions />);

  // Click single variant's "Cấu hình"
  const configButtons = await screen.findAllByRole('button', { name: 'Cấu hình' });
  fireEvent.click(configButtons[0]);

  // Click "Dùng chính sách"
  fireEvent.click(screen.getByRole('button', { name: 'Dùng chính sách' }));

  await waitFor(() =>
    expect(partnerRequest).toHaveBeenCalledWith('/product-commissions', 'PUT', {
      skus: ['IP13-128'],
      rule: null,
    })
  );
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã khôi phục về chính sách chung.'));
});

it('configures accessory commission as percentage', async () => {
  vi.mocked(partnerRequest).mockResolvedValue(mockData);
  render(<ProductCommissions />);

  fireEvent.click(await screen.findByLabelText('Chọn Phụ kiện'));
  fireEvent.click(screen.getByRole('button', { name: 'Cấu hình đã chọn (1)' }));

  // Switch to accessory kind
  fireEvent.click(screen.getByText('Phụ kiện / Doanh thu'));
  fireEvent.change(screen.getByLabelText('Mức riêng'), { target: { value: '12.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

  await waitFor(() =>
    expect(partnerRequest).toHaveBeenCalledWith('/product-commissions', 'PUT', {
      skus: ['CHG-20W'],
      rule: { kind: 'accessory', rateBps: 1250 },
    })
  );
});

it('filters by status: Có mức riêng vs Chính sách chung', async () => {
  vi.mocked(partnerRequest).mockResolvedValue(mockData);
  render(<ProductCommissions />);

  expect(await screen.findByText('iPhone 13 128GB')).not.toBeNull();
  expect(screen.getByText('Củ sạc nhanh 20W')).not.toBeNull();

  // Click filter "Có mức riêng"
  fireEvent.click(screen.getByRole('button', { name: 'Có mức riêng' }));
  expect(screen.getByText('iPhone 13 128GB')).not.toBeNull();
  expect(screen.queryByText('Củ sạc nhanh 20W')).toBeNull();

  // Click filter "Chính sách chung"
  fireEvent.click(screen.getByRole('button', { name: 'Chính sách chung' }));
  expect(screen.queryByText('iPhone 13 128GB')).toBeNull();
  expect(screen.getByText('Củ sạc nhanh 20W')).not.toBeNull();
});

it.each(['1', '500000'])('saves a positive product amount outside the former bounds: %s', async value => {
  vi.mocked(partnerRequest).mockResolvedValue(mockData);
  render(<ProductCommissions />);
  fireEvent.click(await screen.findByLabelText('Chọn Điện thoại'));
  fireEvent.click(screen.getByRole('button', { name: 'Cấu hình đã chọn (2)' }));
  const input = screen.getByLabelText('Mức riêng');
  expect(input.getAttribute('min')).toBeNull();
  expect(input.getAttribute('max')).toBeNull();
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
  await waitFor(() => expect(partnerRequest).toHaveBeenCalledWith('/product-commissions', 'PUT', { skus: ['IP13-128', 'IP13-256'], rule: { kind: 'phone', amount: Number(value) } }));
});

it.each(['0', '-1'])('rejects nonpositive product rates: %s', async value => {
  vi.mocked(partnerRequest).mockResolvedValue(mockData);
  render(<ProductCommissions />);
  fireEvent.click(await screen.findByLabelText('Chọn Điện thoại'));
  fireEvent.click(screen.getByRole('button', { name: 'Cấu hình đã chọn (2)' }));
  fireEvent.change(screen.getByLabelText('Mức riêng'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
  expect(toast.error).toHaveBeenCalledWith('Mức hoa hồng riêng phải lớn hơn 0.');
  expect(vi.mocked(partnerRequest).mock.calls.some(call => call[1] === 'PUT')).toBe(false);
});
