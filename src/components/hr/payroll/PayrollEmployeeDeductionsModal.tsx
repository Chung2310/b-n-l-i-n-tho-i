import { useState } from "react";

type Values = { advances: number; otherDeductions: number };
type Props = {
  employeeName: string;
  values: Values;
  gross: number;
  deductionTotal: number;
  onApply: (values: Values) => void;
  onCancel: () => void;
};
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

export function PayrollEmployeeDeductionsModal({ employeeName, values, gross, deductionTotal, onApply, onCancel }: Props) {
  const [advances, setAdvances] = useState(String(values.advances));
  const [otherDeductions, setOtherDeductions] = useState(String(values.otherDeductions));
  const next = { advances: Number(advances), otherDeductions: Number(otherDeductions) };
  const valid = Object.values(next).every(value => Number.isSafeInteger(value) && value >= 0);
  const nextTotal = deductionTotal - values.advances - values.otherDeductions + next.advances + next.otherDeductions;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
    <form role="dialog" aria-modal="true" aria-labelledby="employee-deductions-title" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl" onSubmit={event => { event.preventDefault(); if (valid) onApply(next); }}>
      <h3 id="employee-deductions-title" className="font-bold">Tạm ứng và khấu trừ — {employeeName}</h3>
      <p className="text-sm text-slate-500">Nhập tổng số tiền của nhân viên trong kỳ này. Các khoản này được trừ vào tiền thực nhận.</p>
      <label className="block text-sm">Tạm ứng lương (đ)
        <input autoFocus type="number" min={0} step={1} value={advances} onChange={event => setAdvances(event.target.value)} className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm">Khấu trừ khác (đ)
        <input type="number" min={0} step={1} value={otherDeductions} onChange={event => setOtherDeductions(event.target.value)} className="mt-1 w-full rounded border p-2" />
      </label>
      {!valid && <p role="alert" className="text-sm text-rose-600">Số tiền phải là số nguyên không âm.</p>}
      {valid && <div className="space-y-2 rounded bg-slate-50 p-3 text-sm">
        <p>Tổng khấu trừ: <b>{money(nextTotal)}</b></p>
        <p>Thực nhận dự kiến: <b>{money(Math.max(0, gross - nextTotal))}</b></p>
        {nextTotal > gross && <p className="text-amber-700">Khấu trừ vượt thu nhập {money(nextTotal - gross)}.</p>}
      </div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded border px-3 py-2">Hủy</button>
        <button type="submit" disabled={!valid} className="rounded bg-cyan-600 px-3 py-2 text-white disabled:opacity-50">Tiếp tục lưu</button>
      </div>
    </form>
  </div>;
}
