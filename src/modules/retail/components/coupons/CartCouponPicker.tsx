import { useEffect, useState } from "react";
import { retailCouponsApi, type RetailCoupon } from "../../api/retailCoupons.api";
import type { RetailScope } from "../../types";

export default function CartCouponPicker({ scope, customerId, value, onChange }: {
  scope: RetailScope;
  customerId?: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const [result, setResult] = useState<{ key: string; items: RetailCoupon[]; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${scope.companyCode}:${scope.branchId}`;
  useEffect(() => {
    let current = true;
    setResult(null);
    const load = async () => {
      try {
        const items: RetailCoupon[] = [];
        let page = 1;
        while (current) {
          const data = await retailCouponsApi.list(scope, page++);
          if (!current) return;
          items.push(...data.items);
          if (!data.items.length || items.length >= data.total) break;
        }
        if (current) setResult({ key, items });
      } catch {
        if (current) setResult({ key, items: [], error: "Không tải được danh sách mã. Bạn vẫn có thể nhập mã bên dưới." });
      }
    };
    void load();
    return () => { current = false; };
  }, [key, revision]);
  const loading = result?.key !== key;
  const now = Date.now();
  const coupons = loading ? [] : result.items.filter(item => item.active
    && new Date(item.startsAt).getTime() <= now && new Date(item.endsAt).getTime() > now
    && (item.usageLimit == null || item.usedCount < item.usageLimit)
    && (!item.customerId || item.customerId === customerId));
  const selected = coupons.some(item => item.code === value) ? value : "";
  return (
    <div className="mt-2 space-y-1.5">
      <select
        aria-label="Chọn mã ưu đãi đã tạo"
        value={selected}
        disabled={loading || Boolean(result?.error)}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 disabled:opacity-60"
      >
        <option value="">{loading ? "Đang tải mã ưu đãi..." : "Chọn mã đã tạo hoặc nhập mã bên dưới"}</option>
        {coupons.map(item => <option key={item._id} value={item.code}>
          {item.code} — {item.name} · Giảm {item.discountType === "percent" ? `${item.value}%` : `${item.value.toLocaleString("vi-VN")} ₫`}
        </option>)}
      </select>
      {result?.key === key && result.error && <p role="status" className="text-xs text-amber-700">{result.error} <button type="button" onClick={() => setRevision(value => value + 1)} className="font-semibold underline">Thử lại</button></p>}
      {!loading && !result.error && !coupons.length && <p className="text-xs text-slate-500">Chưa có mã còn hiệu lực phù hợp với khách đã chọn.</p>}
      {coupons.filter(item => item.code === selected).map(item => <p key={item._id} className="text-[11px] text-slate-500">
        Đơn từ {item.minSubtotal.toLocaleString("vi-VN")} ₫{item.maxDiscount != null ? ` · Giảm tối đa ${item.maxDiscount.toLocaleString("vi-VN")} ₫` : ""}
        {item.customerTierCodes?.length ? " · Có điều kiện hạng khách hàng" : ""}
      </p>)}
    </div>
  );
}
