import React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Loader2, ScanBarcode, Search, ShoppingCart, X } from "lucide-react";
import { inventorySerialService, type InventorySerialUnit } from "../../../../services/inventorySerialService";
import type { RetailProduct } from "../../types";

export default function AddSerialToCartDialog({ product, excluded, onClose, onConfirm }: {
  product: RetailProduct;
  excluded: string[];
  onClose: () => void;
  onConfirm: (serial: string) => void;
}) {
  const [items, setItems] = React.useState<InventorySerialUnit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState("");
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setSelected("");
    setItems([]);
    setError("");
    const load = async () => {
      const units: InventorySerialUnit[] = [];
      let page = 1;
      while (active) {
        const result = await inventorySerialService.list({ productId: product.productId || product._id, variantId: product.variantId, forSale: true, status: "in_stock", page, limit: 100 });
        units.push(...result.items);
        if (!result.items.length || units.length >= result.total) break;
        page += 1;
      }
      if (active) setItems(units);
    };
    void load().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không thể tải IMEI / Serial.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [product._id, product.productId, product.variantId]);
  const available = items.filter((item) => item.normalizedSerialNumber && !excluded.includes(item.normalizedSerialNumber));
  const filtered = available.filter((item) => `${item.serialNumber} ${item.internalBarcode}`.toLowerCase().includes(query.trim().toLowerCase()));
  const canConfirm = !loading && !error && available.some((item) => item.normalizedSerialNumber === selected);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") onClose();
    }}>
      <div role="dialog" aria-modal="true" aria-label="Chọn IMEI / Serial để thêm vào giỏ" className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-xl bg-cyan-50 p-2 text-cyan-700"><ScanBarcode className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800">Chọn IMEI / Serial</h3>
              <p className="mt-0.5 text-xs text-slate-500">Chọn một máy để thêm vào giỏ hàng</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5 sm:p-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="break-words text-sm font-semibold text-slate-900">{product.name}</p>
            <p className="mt-1 break-all text-xs text-slate-500">SKU: {product.sku}</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input autoFocus aria-label="Tìm IMEI / Serial" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm IMEI, serial hoặc mã vạch..." className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          </div>
          {!loading && !error && <div className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{filtered.length} máy khả dụng</span><span className="rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-700">Đã chọn {canConfirm ? 1 : 0}/1</span></div>}
          {loading && <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-cyan-600" aria-hidden="true" />Đang tải IMEI / Serial...</div>}
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words">{error}</span></div>}
          <div className="space-y-2">
            {filtered.map((item) => {
              const checked = selected === item.normalizedSerialNumber;
              return <label key={item._id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-cyan-200 ${checked ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"}`}>
                <input type="radio" name="add-cart-serial" aria-label={item.serialNumber} checked={checked} onChange={() => setSelected(item.normalizedSerialNumber)} className="h-4 w-4 shrink-0 accent-cyan-600" />
                <span className="min-w-0 flex-1">
                  <span className="block break-all font-mono text-sm font-semibold text-slate-800">{item.serialNumber}</span>
                  {item.internalBarcode && <span className="mt-0.5 block break-all text-xs text-slate-500">Mã vạch: {item.internalBarcode}</span>}
                </span>
                {checked && <Check className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />}
              </label>;
            })}
          </div>
          {!loading && !error && !filtered.length && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"><ScanBarcode className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden="true" /><p className="text-sm text-slate-500">Không có IMEI / Serial khả dụng phù hợp.</p></div>}
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Hủy</button>
          <button type="button" disabled={!canConfirm} onClick={() => { if (canConfirm) onConfirm(selected); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"><ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />Thêm vào giỏ</button>
        </div>
      </div>
    </div>, document.body,
  );
}
