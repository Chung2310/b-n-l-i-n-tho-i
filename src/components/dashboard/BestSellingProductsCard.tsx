import { useEffect, useState } from "react";
import { Loader2, PieChart } from "lucide-react";
import { dashboardService } from "../../services/dashboardService";
import { useRetailScope } from "../../modules/retail/hooks/useRetailScope";
import type { RetailProductReportRow } from "../../modules/retail/types";
import { ApiClientError } from "../../services/apiClientError";
import { DonutCard } from "./DashboardWidgets";

export function buildProductSegments(products: RetailProductReportRow[]) {
  const ranked = products.filter(p => Number.isFinite(p.netSales) && p.netSales > 0)
    .sort((a, b) => b.netSales - a.netSales);
  const total = ranked.reduce((sum, p) => sum + p.netSales, 0);
  const rows = ranked.slice(0, 5).map(p => ({ label: p.productName + " (" + p.sku + ")", amount: p.netSales }));
  if (ranked.length > 5) rows.push({ label: "Khác", amount: ranked.slice(5).reduce((sum, p) => sum + p.netSales, 0) });
  const colors = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#94a3b8"];
  return rows.map((p, index) => ({
    label: p.label, value: p.amount / total * 100, color: colors[index],
    display: p.amount.toLocaleString("vi-VN") + " VND · " + (p.amount / total * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%",
  }));
}

export function BestSellingProductsCard({ filter }: { filter: "month" | "quarter" | "year" }) {
  const { scope } = useRetailScope();
  const companyCode = scope?.companyCode;
  const branchId = scope?.branchId;
  const key = JSON.stringify([companyCode, branchId, filter]);
  const [result, setResult] = useState<{ key: string; segments: ReturnType<typeof buildProductSegments>; error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setResult(null);
    if (!companyCode || !branchId) return;
    let cancelled = false;
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - (filter === "month" ? 30 : filter === "quarter" ? 90 : 365));
    dashboardService.getBestSellingProducts({ companyCode, branchId }, { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) })
      .then(report => { if (!cancelled) setResult({ key, segments: buildProductSegments(report.products || []), error: "" }); })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key, segments: [], error: error instanceof ApiClientError
          ? `Lỗi ${error.status}: ${error.message}`
          : "Không tải được báo cáo sản phẩm. Vui lòng thử lại." });
      });
    return () => { cancelled = true; };
  }, [companyCode, branchId, filter, key, retry]);
  const current = result?.key === key ? result : null;
  return <div className="rounded-3xl border border-[#d1d5db] bg-white p-6 shadow-sm flex flex-col">
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
        <PieChart className="h-4 w-4 text-indigo-500" />Sản phẩm bán chạy
      </h3>
      <p className="text-xs text-slate-600 mt-1">Tỷ trọng doanh thu · Top 5 sản phẩm và nhóm khác</p>
    </div>
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      {!scope ? <p className="text-sm text-slate-600">Chọn chi nhánh để xem sản phẩm bán chạy.</p>
        : !current ? <div role="status" aria-label="Đang tải sản phẩm bán chạy"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        : current.error ? <div className="space-y-3"><p role="alert" className="text-sm text-red-600">{current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-sky-700">Thử lại</button></div>
        : !current.segments.length ? <p className="text-sm text-slate-600">Chưa có doanh thu sản phẩm trong kỳ này.</p>
        : <DonutCard compact title="Sản phẩm bán chạy" centerLabel="Tỷ trọng" centerValue="100%" segments={current.segments} />}
    </div>
  </div>;
}
