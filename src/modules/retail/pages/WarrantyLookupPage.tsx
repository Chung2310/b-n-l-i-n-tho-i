import { FormEvent, useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Smartphone,
  Barcode,
  ShoppingBag,
  User,
  Loader2,
  ShieldAlert,
  Clock,
  Filter,
} from "lucide-react";
import {
  retailWarrantyService,
  type WarrantyLookupResult,
} from "../../../services/retailWarrantyService";
import { toast } from "../../../pages/Toast";

const date = (value?: string) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

const statusLabel: Record<string, string> = {
  in_stock: "Còn tồn",
  sold: "Đã bán",
  reserved: "Đã giữ hàng",
  scrapped: "Đã loại bỏ",
};

const statusBadgeColor: Record<string, string> = {
  in_stock: "bg-blue-50 text-blue-700 border-blue-200",
  sold: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reserved: "bg-amber-50 text-amber-700 border-amber-200",
  scrapped: "bg-rose-50 text-rose-700 border-rose-200",
};

const costBearerBadgeColor: Record<string, string> = {
  customer: "bg-amber-50 text-amber-700 border-amber-200",
  shop: "bg-emerald-50 text-emerald-700 border-emerald-200",
  supplier: "bg-sky-50 text-sky-700 border-sky-200",
};

function Coverage({
  label,
  value,
  color,
}: {
  label: string;
  value?: WarrantyLookupResult["customerWarranty"];
  color: "emerald" | "blue";
}) {
  const days = value?.daysLeft ?? 0;
  const isCovered = Boolean(value?.covered);
  const percent = Math.max(0, Math.min(100, days / 3.65));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${
              color === "emerald"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-blue-50 text-blue-600"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            {label}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border ${
            isCovered
              ? color === "emerald"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isCovered
                ? color === "emerald"
                  ? "bg-emerald-500"
                  : "bg-blue-500"
                : "bg-rose-500"
            }`}
          />
          {isCovered ? `Còn ${days} ngày` : "Đã hết hạn"}
        </span>
      </div>

      <div className="mt-4">
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCovered
                ? color === "emerald"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : "bg-gradient-to-r from-blue-500 to-cyan-500"
                : "bg-slate-300"
            }`}
            style={{ width: `${isCovered ? percent : 0}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>Bắt đầu: <strong className="font-medium text-slate-700">{date(value?.startAt)}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span>Hết hạn: <strong className="font-medium text-slate-700">{date(value?.endAt)}</strong></span>
        </div>
      </div>
    </div>
  );
}

function RepairLink({ result }: { result: WarrantyLookupResult }) {
  if (!result.found) return null;
  const open = () =>
    window.dispatchEvent(
      new CustomEvent("inventory:open-repair", {
        detail: {
          productId: result.product?.productId,
          serialNumber: result.serialNumber,
          productName: result.product?.name || "Sản phẩm",
          customerId: result.sold?.customerId,
          customerName: result.sold?.customerName,
          customerPhone: result.sold?.customerPhone,
          coverage: {
            customer: result.customerWarranty || { covered: false },
            supplier: result.supplierWarranty || { covered: false },
            costBearer: result.costBearer || "customer",
            checkedAt: new Date().toISOString(),
          },
        },
      })
    );

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-cyan-600/20 active:scale-95 transition-all cursor-pointer"
    >
      <Wrench className="h-4 w-4" />
      <span>Tạo phiếu sửa chữa/bảo hành</span>
    </button>
  );
}

function WarrantyLookupPageContent() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<WarrantyLookupResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      setResult(await retailWarrantyService.lookup(code.trim()));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Không thể tra cứu bảo hành"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Search Input Card */}
      <form
        onSubmit={submit}
        className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs"
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="IMEI / Serial / mã vạch nội bộ"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:bg-white focus:ring-2 focus:ring-cyan-100"
          />
        </div>
        <button
          disabled={busy}
          className="h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 px-6 font-bold text-xs sm:text-sm text-white shadow-sm shadow-cyan-600/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span>{busy ? "Đang tra..." : "Tra cứu"}</span>
        </button>
      </form>

      {/* Result: Not found */}
      {result && !result.found && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <span className="text-xs sm:text-sm font-medium">
            Không tìm thấy thiết bị trong hệ thống. Vui lòng kiểm tra lại số IMEI / Serial.
          </span>
        </div>
      )}

      {/* Result: Found */}
      {result?.found && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {result.product?.name || "Sản phẩm"}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500 font-mono">
                      SKU: {result.product?.sku || "—"}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                        statusBadgeColor[result.status || ""] || "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {statusLabel[result.status || ""] || result.status || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
                  costBearerBadgeColor[result.costBearer || ""] || "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                Bên chịu phí: {result.costBearer || "—"}
              </span>
            </div>

            <div className="mt-4 grid gap-4 text-xs sm:text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  IMEI / Serial
                </p>
                <p className="font-mono font-bold text-slate-800 text-xs sm:text-sm mt-1">
                  {result.serialNumber || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Mã vạch nội bộ
                </p>
                <p className="font-mono font-bold text-slate-800 text-xs sm:text-sm mt-1">
                  {result.internalBarcode || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Ngày bán
                </p>
                <p className="font-bold text-slate-800 text-xs sm:text-sm mt-1">
                  {date(result.sold?.at)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Mã đơn hàng
                </p>
                <p className="font-mono font-bold text-cyan-700 text-xs sm:text-sm mt-1">
                  {result.sold?.orderCode || "—"}
                </p>
              </div>
            </div>

            {/* Customer Details if sold */}
            {result.sold?.customerName && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-600">
                <User className="h-4 w-4 text-slate-400" />
                <span>
                  Khách hàng: <strong className="text-slate-800">{result.sold.customerName}</strong>
                  {result.sold.customerPhone ? ` · ${result.sold.customerPhone}` : ""}
                </span>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100">
              <RepairLink result={result} />
            </div>
          </div>

          {/* 2 Coverage Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Coverage
              label="Bảo hành khách hàng"
              value={result.customerWarranty}
              color="emerald"
            />
            <Coverage
              label={`Bảo hành nhà cung cấp${
                result.supplierWarranty?.supplierName
                  ? ` · ${result.supplierWarranty.supplierName}`
                  : ""
              }`}
              value={result.supplierWarranty}
              color="blue"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function WarrantyReportPanel() {
  const [kind, setKind] = useState<"supplier" | "customer">("customer");
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("");
  const [bearer, setBearer] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WarrantyLookupResult[]>([]);
  const [gap, setGap] = useState<WarrantyLookupResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await retailWarrantyService.expiring(kind, days));
      setGap(await retailWarrantyService.gapRisk());
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () =>
      items.filter(
        (item: any) =>
          (!status || item.status === status) &&
          (!bearer || item.costBearer === bearer) &&
          (!query ||
            [
              item.serialNumber,
              item.internalBarcode,
              item.sku,
              item.productName,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query.toLowerCase())
            ))
      ),
    [items, status, bearer, query]
  );

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base text-slate-900">
              Danh sách sắp hết hạn
            </h2>
            <p className="text-xs text-slate-500">
              Cảnh báo thiết bị cận ngày hết bảo hành hoặc có rủi ro khe hở bảo hành.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 transition-all"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>{loading ? "Đang tải..." : "Tải báo cáo"}</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm IMEI, SKU, sản phẩm"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 md:col-span-2"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
        >
          <option value="customer">BH khách hàng</option>
          <option value="supplier">BH nhà cung cấp</option>
        </select>
        <input
          type="number"
          min="1"
          max="1200"
          value={days}
          onChange={(e) => setDays(Number(e.target.value) || 30)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          aria-label="Số ngày sắp hết hạn"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
        >
          <option value="">Mọi trạng thái</option>
          <option value="in_stock">Còn tồn</option>
          <option value="sold">Đã bán</option>
          <option value="reserved">Đã giữ hàng</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-1">
        <span>
          <strong className="font-bold text-slate-800">{filtered.length}</strong> thiết bị phù hợp ·{" "}
          <strong className="font-bold text-amber-600">{gap.length}</strong> thiết bị có khe hở bảo hành
        </span>
      </div>

      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">Sản phẩm / SKU</th>
                <th className="p-3">IMEI / Serial</th>
                <th className="p-3">Mã nội bộ</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Hết hạn</th>
                <th className="p-3">Bên chịu phí</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item: any) => (
                <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3">
                    <p className="font-bold text-slate-800">
                      {item.productName || "—"}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {item.sku || "—"}
                    </p>
                  </td>
                  <td className="p-3 font-mono font-medium text-slate-700">
                    {item.serialNumber || "—"}
                  </td>
                  <td className="p-3 font-mono text-slate-600">
                    {item.internalBarcode || "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        statusBadgeColor[item.status] || "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {statusLabel[item.status] || item.status || "—"}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-slate-700">
                    {date(
                      kind === "supplier"
                        ? item.supplierWarranty?.endAt
                        : item.customerWarranty?.endAt
                    )}
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-slate-600">
                      {item.costBearer || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function WarrantyLookupPage() {
  return (
    <div className="space-y-5">
      <WarrantyLookupPageContent />
      <WarrantyReportPanel />
    </div>
  );
}
