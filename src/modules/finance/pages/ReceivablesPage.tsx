import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Landmark, Search } from "lucide-react";
import { Pagination } from "../../../components/common/Pagination";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import {
  financeReceivablesApi,
  type AgingBucket,
  type FinanceReceivable,
  type ReceivableStatus,
} from "../api/financeReceivables.api";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const validAging = new Set(["0-30", "31-60", "61-90", "over90"]);

export default function ReceivablesPage({
  permissions: _permissions,
  onOpen,
}: {
  permissions: readonly string[];
  onOpen?: (id: string) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const agingParam = params.get("aging");
  const customerId = params.get("customerId") || undefined;
  const agingBucket = validAging.has(String(agingParam))
    ? (agingParam as AgingBucket)
    : undefined;
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<ReceivableStatus | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    items: FinanceReceivable[];
    total: number;
  }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(
        await financeReceivablesApi.list({
          page,
          limit: 20,
          status: status || undefined,
          customerId,
          agingBucket,
        }),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tải được công nợ.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, status, customerId, agingBucket, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = debounced
    ? result.items.filter((item) =>
        `${item.receivableCode} ${item.customerName}`
          .toLocaleLowerCase("vi")
          .includes(debounced.toLocaleLowerCase("vi")),
      )
    : result.items;

  // KPI calculations based on current items
  const kpis = useMemo(() => {
    const totalBalance = result.items.reduce((sum, item) => sum + (item.balance || 0), 0);
    const overdueCount = result.items.filter((item) => item.daysOverdue > 0).length;
    const settledCount = result.items.filter((item) => item.status === "settled").length;
    return {
      totalCount: result.total,
      totalBalance,
      overdueCount,
      settledCount,
    };
  }, [result]);

  return (
    <section className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Công nợ phải thu</h1>
              <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                {result.total} khoản
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Theo dõi số dư, hạn trả và lịch sử từng khoản công nợ khách hàng.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Tổng số khoản</span>
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-slate-900">{kpis.totalCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Khoản công nợ trong hệ thống</p>
        </div>

        <div className="group rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all hover:border-cyan-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-700">Dư nợ trên trang</span>
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-cyan-700">{money.format(kpis.totalBalance)}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Tổng số dư còn phải thu</p>
        </div>

        <div className="group rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all hover:border-red-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-red-600">Khoản quá hạn</span>
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-red-600">{kpis.overdueCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Cần ưu tiên nhắc nợ</p>
        </div>

        <div className="group rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all hover:border-emerald-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600">Đã tất toán</span>
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-emerald-600">{kpis.settledCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Hoàn thành thu nợ</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm công nợ"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm theo mã công nợ hoặc tên khách hàng..."
          />
        </label>
        <select
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ReceivableStatus | "");
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 sm:w-56"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="open">Đang mở</option>
          <option value="partially_paid">Đã thu một phần</option>
          <option value="settled">Đã tất toán</option>
          <option value="written_off">Đã xóa nợ</option>
        </select>
      </div>

      {agingBucket && (
        <div className="flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm font-semibold text-cyan-800">
          <span>Đang lọc nhóm tuổi nợ: {agingBucket}</span>
          <button
            type="button"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("aging");
              window.history.replaceState(null, "", url);
              window.location.reload();
            }}
            className="text-xs underline hover:text-cyan-950"
          >
            Xóa bộ lọc tuổi nợ
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-12 shadow-xs">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
          <p className="mt-3 text-sm font-medium text-slate-500">Đang tải công nợ...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Mã công nợ</th>
                  <th className="px-5 py-3.5">Khách hàng</th>
                  <th className="px-5 py-3.5">Hạn thanh toán</th>
                  <th className="px-5 py-3.5">Tình trạng</th>
                  <th className="px-5 py-3.5 text-right">Số dư còn nợ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isOverdue = item.daysOverdue > 0;
                  return (
                    <tr
                      key={item._id}
                      className="group cursor-pointer transition-colors hover:bg-cyan-50/40"
                      onClick={() => onOpen?.(item._id)}
                    >
                      <td className="px-5 py-4 font-bold text-cyan-700 group-hover:text-cyan-800">
                        {item.receivableCode}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {item.customerName}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {new Date(item.dueDate).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-5 py-4">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 border border-red-200/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Quá hạn {item.daysOverdue} ngày
                          </span>
                        ) : item.status === "settled" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Đã tất toán
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Đang mở
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-slate-900">
                        {money.format(item.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!items.length && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Landmark className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có khoản công nợ phù hợp.</p>
                <p className="mt-1 text-xs text-slate-400">Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(result.total / 20))}
        onPageChange={setPage}
      />
    </section>
  );
}
