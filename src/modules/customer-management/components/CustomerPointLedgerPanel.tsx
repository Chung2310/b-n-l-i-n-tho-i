import React, { useEffect, useState } from "react";
import { Coins, Plus, Minus, RotateCw, Filter } from "lucide-react";
import { customerApi } from "../customerApi";
import type { CustomerPointLedgerItem } from "../types";
import { TablePagination } from "../../../components/common/TablePagination";
import { Dropdown } from "../../../components/common/Dropdown";

const TYPE_CONFIG: Record<string, { label: string; badge: string; isPositive: boolean }> = {
  EARN_ORDER: { label: "Tích điểm mua hàng", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", isPositive: true },
  EARN_REPAIR: { label: "Tích điểm sửa chữa", badge: "bg-teal-50 text-teal-700 border-teal-200", isPositive: true },
  REDEEM_ORDER: { label: "Tiêu điểm đơn hàng", badge: "bg-amber-50 text-amber-700 border-amber-200", isPositive: false },
  REDEEM_REPAIR: { label: "Tiêu điểm sửa chữa", badge: "bg-orange-50 text-orange-700 border-orange-200", isPositive: false },
  MANUAL_GRANT: { label: "Quản lý cấp điểm", badge: "bg-blue-50 text-blue-700 border-blue-200", isPositive: true },
  MANUAL_DEDUCT: { label: "Quản lý trừ điểm", badge: "bg-rose-50 text-rose-700 border-rose-200", isPositive: false },
  REFUND_REVERT: { label: "Thu hồi điểm trả hàng", badge: "bg-purple-50 text-purple-700 border-purple-200", isPositive: false },
};

const formatDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function CustomerPointLedgerPanel({
  customerId,
  companyCode,
  refreshTrigger = 0,
}: {
  customerId: string;
  companyCode: string;
  refreshTrigger?: number;
}) {
  const [items, setItems] = useState<CustomerPointLedgerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await customerApi.getPointLedger(customerId, {
        page,
        limit: pageSize,
        type: typeFilter || undefined,
        companyCode,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sổ cái điểm.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, companyCode, page, pageSize, typeFilter, refreshTrigger]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 p-4 bg-slate-50/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Sổ cái Lịch sử Điểm thưởng
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ghi vết kiểm toán bất biến tất cả các lần tích, tiêu và cấp điểm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dropdown<string>
            aria-label="Lọc theo loại biến động"
            value={typeFilter}
            onChange={(val) => {
              setTypeFilter(val);
              setPage(1);
            }}
            options={[
              { value: "", label: "Tất cả loại giao dịch" },
              { value: "EARN_ORDER", label: "Tích điểm mua hàng" },
              { value: "EARN_REPAIR", label: "Tích điểm sửa chữa" },
              { value: "REDEEM_ORDER", label: "Tiêu điểm đơn hàng" },
              { value: "REDEEM_REPAIR", label: "Tiêu điểm sửa chữa" },
              { value: "MANUAL_GRANT", label: "Quản lý cấp điểm" },
              { value: "MANUAL_DEDUCT", label: "Quản lý trừ điểm" },
              { value: "REFUND_REVERT", label: "Thu hồi điểm trả hàng" },
            ]}
            size="sm"
            variant="filter"
            triggerClassName="text-xs"
          />

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Tải lại"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 transition cursor-pointer"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 text-xs text-rose-600 bg-rose-50 border-b border-rose-100">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-xs border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-3.5 whitespace-nowrap">Thời gian</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Loại giao dịch</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">Biến động</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">Số dư sau</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Chứng từ</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Người làm</th>
              <th className="py-3 px-3.5">Lý do giải trình</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {items.map((row) => {
              const cfg = TYPE_CONFIG[row.type] || {
                label: row.type,
                badge: "bg-slate-50 text-slate-700 border-slate-200",
                isPositive: row.points > 0,
              };

              return (
                <tr key={row._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-0.5 font-bold ${
                        row.points > 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {row.points > 0 ? `+${row.points}` : row.points} điểm
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                    {row.balanceAfter.toLocaleString("vi-VN")} đ
                  </td>
                  <td className="py-3 px-3.5 font-mono text-[11px] text-cyan-700 font-bold whitespace-nowrap">
                    {row.sourceCode || row.transactionCode}
                  </td>
                  <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                    {row.actorName || "—"}
                  </td>
                  <td className="py-3 px-3.5 text-slate-700 min-w-[180px] leading-relaxed" title={row.reason}>
                    {row.reason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && items.length === 0 && (
          <div className="py-8 text-center text-slate-400">
            <Coins className="h-6 w-6 mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs">Chưa có lịch sử biến động điểm nào.</p>
          </div>
        )}
      </div>

      {total > 0 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="giao dịch"
          className="rounded-b-2xl"
        />
      )}
    </div>
  );
}
