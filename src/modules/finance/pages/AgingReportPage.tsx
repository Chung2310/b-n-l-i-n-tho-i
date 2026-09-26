import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, CalendarClock, ChartNoAxesColumnIncreasing, Clock, ShieldAlert } from "lucide-react";
import {
  financeReceivablesApi,
  type AgingBucket,
} from "../api/financeReceivables.api";
import { AgingDistributionBar } from "../components/FinanceOverviewCharts";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const buckets: Array<{
  key: AgingBucket;
  label: string;
  sub: string;
  theme: {
    border: string;
    bg: string;
    badge: string;
    text: string;
    iconBg: string;
  };
}> = [
  {
    key: "0-30",
    label: "0–30 ngày",
    sub: "Trong hạn hoặc mới quá hạn nhẹ",
    theme: {
      border: "border-emerald-200/80 hover:border-emerald-400",
      bg: "bg-gradient-to-b from-white to-emerald-50/20",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      text: "text-emerald-700",
      iconBg: "bg-emerald-100 text-emerald-700",
    },
  },
  {
    key: "31-60",
    label: "31–60 ngày",
    sub: "Cần gửi thông báo nhắc nợ",
    theme: {
      border: "border-cyan-200/80 hover:border-cyan-400",
      bg: "bg-gradient-to-b from-white to-cyan-50/20",
      badge: "bg-cyan-50 text-cyan-700 border-cyan-200/60",
      text: "text-cyan-700",
      iconBg: "bg-cyan-100 text-cyan-700",
    },
  },
  {
    key: "61-90",
    label: "61–90 ngày",
    sub: "Rủi ro chậm thanh toán trung bình",
    theme: {
      border: "border-amber-200/80 hover:border-amber-400",
      bg: "bg-gradient-to-b from-white to-amber-50/20",
      badge: "bg-amber-50 text-amber-700 border-amber-200/60",
      text: "text-amber-700",
      iconBg: "bg-amber-100 text-amber-700",
    },
  },
  {
    key: "over90",
    label: "Trên 90 ngày",
    sub: "Nợ khó đòi - Cần biện pháp thu hồi mạnh",
    theme: {
      border: "border-rose-200/80 hover:border-rose-400",
      bg: "bg-gradient-to-b from-white to-rose-50/20",
      badge: "bg-rose-50 text-rose-700 border-rose-200/60",
      text: "text-rose-700",
      iconBg: "bg-rose-100 text-rose-700",
    },
  },
];

export default function AgingReportPage({
  onDrillDown,
}: {
  onDrillDown: (bucket: AgingBucket) => void;
}) {
  const [data, setData] = useState<
    Record<string, { count: number; balance: number }>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    financeReceivablesApi
      .aging()
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Không tải được tuổi nợ.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const totalReceivables = Object.values(data).reduce(
    (acc, item) => acc + (item.balance || 0),
    0,
  );
  const totalCount = Object.values(data).reduce(
    (acc, item) => acc + (item.count || 0),
    0,
  );

  return (
    <section className="space-y-6">
      {/* Header card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20">
            <ChartNoAxesColumnIncreasing className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Phân tích tuổi nợ</h1>
              <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                {totalCount} khoản · {money.format(totalReceivables)}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Nhấp chọn một nhóm tuổi nợ để xem danh sách chi tiết các khoản công nợ cần thu hồi.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Visual Debt Distribution Bar */}
      <AgingDistributionBar
        items={buckets.map(({ key, label }) => {
          const item = data[key] || { count: 0, balance: 0 };
          const percentage = totalReceivables > 0 ? Number(((item.balance / totalReceivables) * 100).toFixed(1)) : 0;
          return { label, balance: item.balance, percentage };
        })}
      />

      {/* 4 Interactive Aging Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map(({ key, label, sub, theme }) => {
          const item = data[key] || { count: 0, balance: 0 };
          const percentage = totalReceivables > 0 ? ((item.balance / totalReceivables) * 100).toFixed(1) : "0";

          return (
            <button
              key={key}
              type="button"
              aria-label={`Xem nhóm ${label}`}
              onClick={() => onDrillDown(key)}
              className={`group flex flex-col justify-between rounded-2xl border p-4 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.border} ${theme.bg}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                    {label}
                  </span>
                  <div className={`rounded-lg p-1.5 ${theme.iconBg}`}>
                    {key === "over90" ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : key === "61-90" ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <CalendarClock className="h-4 w-4" />
                    )}
                  </div>
                </div>

                <p className="mt-2 text-base sm:text-lg font-bold text-slate-900">
                  {money.format(item.balance)}
                </p>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  {sub}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${theme.badge}`}>
                  {item.count} khoản ({percentage}%)
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-cyan-600">
                  Chi tiết <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Advisory Insight Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-cyan-200/80 bg-cyan-50/50 p-4 text-xs text-cyan-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
        <div>
          <p className="font-bold">Khuyến nghị phân loại thu hồi nợ</p>
          <p className="mt-0.5 text-cyan-800">
            Các khoản nợ trên 60 ngày cần được ưu tiên liên hệ trực tiếp qua Zalo/Điện thoại hoặc cử nhân viên thu hồi.
            Hệ thống tự động kích hoạt tiến trình nhắc nợ định kỳ vào 08:15 hằng ngày đối với các khoản đến hạn.
          </p>
        </div>
      </div>
    </section>
  );
}
