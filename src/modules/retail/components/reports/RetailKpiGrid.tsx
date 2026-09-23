import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CircleDollarSign,
  HandCoins,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Scale,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { RetailReport } from "../../types";

type RetailKpiGridProps = { report: RetailReport };

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN");
const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

type Kpi = {
  label: string;
  value: string;
  sublabel: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  isPrimary?: boolean;
};

export default function RetailKpiGrid({ report }: RetailKpiGridProps) {
  const { summary } = report;
  const kpis: Kpi[] = [
    {
      label: "Doanh thu thuần",
      value: moneyFormatter.format(summary.netSales),
      sublabel: "Đã trừ hoàn trả",
      icon: TrendingUp,
      iconBg: "bg-cyan-500/10 text-cyan-700",
      iconColor: "text-cyan-600",
      isPrimary: true,
    },
    {
      label: "Số đơn",
      value: numberFormatter.format(summary.orderCount),
      sublabel: "Đơn hoàn tất",
      icon: ShoppingBag,
      iconBg: "bg-blue-500/10 text-blue-700",
      iconColor: "text-blue-600",
    },
    {
      label: "Giá trị đơn trung bình",
      value: moneyFormatter.format(summary.averageOrderValue),
      sublabel: "AOV / đơn",
      icon: ReceiptText,
      iconBg: "bg-violet-500/10 text-violet-700",
      iconColor: "text-violet-600",
    },
    {
      label: "Đã thu",
      value: moneyFormatter.format(summary.collectedAmount),
      sublabel: "Dòng tiền thực thu",
      icon: CircleDollarSign,
      iconBg: "bg-emerald-500/10 text-emerald-700",
      iconColor: "text-emerald-600",
    },
    {
      label: "Còn phải thu",
      value: moneyFormatter.format(summary.dueAmount),
      sublabel: "Công nợ khách",
      icon: HandCoins,
      iconBg: "bg-amber-500/10 text-amber-700",
      iconColor: "text-amber-600",
    },
    {
      label: "Hoàn tiền",
      value: moneyFormatter.format(summary.refunds),
      sublabel: "Trả hàng & đổi trả",
      icon: RotateCcw,
      iconBg: "bg-rose-500/10 text-rose-700",
      iconColor: "text-rose-600",
    },
  ];

  if (typeof summary.totalCost === "number") {
    kpis.push({
      label: "Giá vốn",
      value: moneyFormatter.format(summary.totalCost),
      sublabel: "Chi phí hàng bán",
      icon: PackageCheck,
      iconBg: "bg-slate-500/10 text-slate-700",
      iconColor: "text-slate-600",
    });
  }
  if (typeof summary.grossProfit === "number") {
    kpis.push({
      label: "Lợi nhuận gộp",
      value: moneyFormatter.format(summary.grossProfit),
      sublabel: "Doanh thu - Giá vốn",
      icon: Banknote,
      iconBg: "bg-teal-500/10 text-teal-700",
      iconColor: "text-teal-600",
    });
  }
  if (typeof summary.grossMarginPercent === "number") {
    kpis.push({
      label: "Tỷ suất lợi nhuận",
      value: `${percentFormatter.format(summary.grossMarginPercent)}%`,
      sublabel: "Biên lợi nhuận",
      icon: Scale,
      iconBg: "bg-indigo-500/10 text-indigo-700",
      iconColor: "text-indigo-600",
    });
  }

  return (
    <section aria-label="Chỉ số tổng quan" className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map(({ label, value, sublabel, icon: Icon, iconBg, iconColor, isPrimary }) => (
        <article
          key={label}
          className={`relative overflow-hidden rounded-3xl border p-4.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            isPrimary
              ? "border-cyan-300 bg-gradient-to-br from-cyan-50/80 via-white to-sky-50/50 shadow-xs"
              : "border-slate-200/80 bg-white shadow-xs hover:border-slate-300"
          }`}
        >
          {isPrimary && (
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-cyan-400/15 blur-lg pointer-events-none" />
          )}
          <div className="flex items-center justify-between mb-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconBg}`}>
              <Icon aria-hidden="true" className={`h-5 w-5 ${iconColor}`} />
            </div>
            {isPrimary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100/80 px-2 py-0.5 text-[10px] font-bold text-cyan-800">
                <Sparkles className="h-3 w-3" />
                Chủ đạo
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-400">{sublabel}</span>
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 break-words text-xl font-black text-slate-900 tracking-tight">{value}</p>
        </article>
      ))}
    </section>
  );
}
