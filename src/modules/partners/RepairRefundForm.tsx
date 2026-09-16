import React from "react";
import { apiFetch } from "../shared/lib/apiFetch";
export default function RepairRefundForm({ ticket, onChanged }: { ticket: any; onChanged: () => void }) {
  const [amount, setAmount] = React.useState(''), [laborAmount, setLaborAmount] = React.useState(''), [reason, setReason] = React.useState(''), [reference, setReference] = React.useState('');
  const [error, setError] = React.useState(''), [busy, setBusy] = React.useState(false);
  const key = React.useRef(crypto.randomUUID());
  const submit = async () => {
    if (!window.confirm('Xác nhận đã hoàn tiền cho khách theo chứng từ này? Hoa hồng CTV sẽ được điều chỉnh tương ứng.')) return;
    setBusy(true); setError('');
    try { await apiFetch(`/repair/tickets/${ticket._id}/refunds`, { method: 'POST', body: JSON.stringify({ amount: Number(amount), laborAmount: Number(laborAmount), reason, reference, idempotencyKey: key.current }) }); key.current = crypto.randomUUID(); onChanged(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className="mt-4 space-y-2 rounded-lg border p-3"><h3 className="font-semibold">Hoàn tiền sửa chữa</h3><p className="text-xs text-slate-500">Nhập tổng tiền đã hoàn và phần tiền công trong khoản hoàn để thu hồi đúng hoa hồng.</p><div className="grid gap-2 sm:grid-cols-2">{[['Tổng tiền hoàn',amount,setAmount],['Trong đó tiền công',laborAmount,setLaborAmount],['Lý do',reason,setReason],['Chứng từ hoàn tiền',reference,setReference]].map(([label,value,setter], i) => <label key={String(label)} className="text-sm">{String(label)}<input className="w-full rounded border p-2" type={i < 2 ? 'number' : 'text'} min="0" value={String(value)} onChange={e => { (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value); key.current = crypto.randomUUID(); }} /></label>)}</div>{error && <p role="alert" className="text-red-600">{error}</p>}<button type="button" disabled={busy || !amount || laborAmount === '' || !reason.trim() || !reference.trim()} onClick={() => void submit()} className="rounded bg-rose-700 px-3 py-2 text-sm text-white disabled:opacity-50">Ghi nhận đã hoàn tiền</button>{(ticket.commissionRefunds || []).map((r: any) => <p key={r.key} className="text-xs">{new Date(r.at).toLocaleDateString('vi-VN')} · {r.amount.toLocaleString('vi-VN')}đ · {r.reason} · {r.reference}</p>)}</section>;
}
