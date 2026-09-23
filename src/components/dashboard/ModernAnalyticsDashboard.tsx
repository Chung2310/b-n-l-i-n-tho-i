import { revenueComparisonRange } from "./revenueComparison";
import { useBranchOptional } from "../../context/BranchContext";
import React, { useState, useEffect } from "react";
import {
  BarChart3,
  ShoppingCart,
  Boxes,
  Users,
  CreditCard,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  FileClock,
  ClipboardList,
  Calendar,
  Sparkles,
  Sun,
  Moon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { DashboardSummary, DashboardActionItems } from "../../types/dashboard";
import { analyticsService } from "../../services/analyticsService";
import { inventoryReceivingService } from "../../services/inventoryReceivingService";
import { BestSellingProductsCard } from "./BestSellingProductsCard";
import { getEnthusiasticGreeting } from "./energyGreeting";

/** Parse chuỗi tiền tệ (vd: "17.000.000 đ", "0 đ") thành số nguyên */
export function parseVnCurrency(str?: string | number): number {
  if (typeof str === "number") return str;
  if (!str) return 0;
  const digits = str.replace(/[^\d]/g, "");
  const val = parseInt(digits, 10);
  return Number.isFinite(val) ? val : 0;
}

/**
 * Định dạng rút gọn theo chuẩn tiếng Việt:
 * 1000000 => 1 triệu, 1200000 => 1,2 triệu (làm tròn 1 chữ số thập phân)
 */
export function formatVietnameseCompactAmount(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1e9) {
    const val = abs / 1e9;
    const rounded = Math.round(val * 10) / 10;
    const formatted = rounded.toLocaleString("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `${formatted} tỷ`;
  }
  if (abs >= 1e6) {
    const val = abs / 1e6;
    const rounded = Math.round(val * 10) / 10;
    const formatted = rounded.toLocaleString("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `${formatted} triệu`;
  }
  if (abs >= 1e3) {
    const val = abs / 1e3;
    const rounded = Math.round(val * 10) / 10;
    const formatted = rounded.toLocaleString("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `${formatted} nghìn`;
  }
  return `${abs.toLocaleString("vi-VN")} ₫`;
}

/** Hook đếm số tăng nhanh mượt mà khi mount / mở trang */
function useCountUp(target: number, durationMs = 800): number {
  const isTest = typeof process !== "undefined" && process.env?.NODE_ENV === "test";
  const [current, setCurrent] = useState(isTest ? target : 0);
  const prevTargetRef = React.useRef(0);

  useEffect(() => {
    if (isTest) {
      return;
    }

    const startVal = prevTargetRef.current;
    prevTargetRef.current = target;

    if (target === 0 && startVal === 0) {
      return;
    }

    let startTimestamp: number | null = null;
    let animFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / durationMs, 1);
      // Fast exponential ease-out
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = Math.round(startVal + (target - startVal) * easeOut);
      setCurrent(val);

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    animFrame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [target, durationMs, isTest]);

  return isTest ? target : current;
}

interface ModernAnalyticsDashboardProps {
  summary: DashboardSummary | null;
  actionItems: DashboardActionItems | null;
  userDisplayName?: string;
  onNavigate: (tab: string, subTab?: string) => void;
  onOpenContract?: (employeeName: string) => void;
}

export function ModernAnalyticsDashboard({
  summary,
  actionItems,
  userDisplayName = "Admin",
  onNavigate,
  onOpenContract,
}: ModernAnalyticsDashboardProps) {
  const [timeFilter, setTimeFilter] = useState<"month" | "quarter" | "year">("month");
  const [revenueData, setRevenueData] = useState<{ bucket: string; amount: number }[]>([]);
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [previousRevenueTotal, setPreviousRevenueTotal] = useState(0);
  const branch = useBranchOptional();
  const [revenueError, setRevenueError] = useState(false);
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(true);
  const [totalStock, setTotalStock] = useState<number | null>(null);
  const [activePoint, setActivePoint] = useState<{ bucket: string; amount: number; x: number; y: number } | null>(null);
  const [hoveredDeltaCard, setHoveredDeltaCard] = useState<"today" | "month" | null>(null);

  // Fetch real inventory stock balance
  useEffect(() => {
    let cancelled = false;
    inventoryReceivingService
      .listBalances()
      .then((balances) => {
        if (!cancelled && Array.isArray(balances)) {
          const sum = balances.reduce(
            (acc, item) => acc + Math.max(0, Number(item.quantity) || 0),
            0
          );
          setTotalStock(sum);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải số lượng tồn kho:", err);
        if (!cancelled) setTotalStock((prev) => prev ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTimeFilterChange = (filter: "month" | "quarter" | "year") => {
    setTimeFilter(filter);
    setIsLoadingRevenue(true);
  };

  // Fetch real revenue data matching the selected filter
  useEffect(() => {
    let cancelled = false;

    setIsLoadingRevenue(true);
    setRevenueError(false);
    setRevenueData([]);
    setRevenueTotal(0);
    setPreviousRevenueTotal(0);
    const period = revenueComparisonRange(timeFilter);
    Promise.all([
      analyticsService.getRevenue({ from: period.from, to: period.to, granularity: period.granularity, branchId: branch?.activeBranchId || undefined }),
      analyticsService.getRevenue({ from: period.previousFrom, to: period.previousTo, granularity: period.granularity, branchId: branch?.activeBranchId || undefined }),
    ])
      .then(([res, previous]) => {
        if (!cancelled) {
          setRevenueData(res.series || []);
          setRevenueTotal(res.total || 0);
          setPreviousRevenueTotal(previous.total);

          setIsLoadingRevenue(false);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải doanh thu:", err);
        if (!cancelled) { setIsLoadingRevenue(false); setRevenueError(true); }
      });

    return () => {
      cancelled = true;
    };
  }, [timeFilter, branch?.activeBranchId]);

  // Extract real metrics from bulletin cards or summary
  const bulletinCards = actionItems?.bulletin?.cards || [];
  const todaySalesCard = bulletinCards.find((c) => c.title.includes("hôm nay") && c.title.includes("Doanh"));
  const yesterdaySalesCard = bulletinCards.find((c) => c.title.includes("hôm qua"));
  const workforceCard = bulletinCards.find((c) => c.title.includes("Nhân sự"));

  const todaySales = todaySalesCard?.value || "0 đ";
  const yesterdaySales = yesterdaySalesCard?.value || "0 đ";
  const workforceRaw = workforceCard?.value || `${summary?.timekeeping?.checkedInToday ?? 0} / ${summary?.timekeeping?.totalEmployees ?? 0}`;
  const workforceToday = workforceRaw.replace(/\s*đã vào ca\s*/gi, "").trim();

  // Animated KPI numbers (count-up effect)
  const todayVal = parseVnCurrency(todaySales);
  const yesterdayVal = parseVnCurrency(yesterdaySales);
  const animatedToday = useCountUp(todayVal);
  const animatedYesterday = useCountUp(yesterdayVal);
  const animatedStock = useCountUp(totalStock ?? 0);
  const animatedRevenue = useCountUp(revenueTotal);

  const displayTodaySales = todayVal > 0 ? `${animatedToday.toLocaleString("vi-VN")} đ` : todaySales;
  const displayYesterdaySales = yesterdayVal > 0 ? `${animatedYesterday.toLocaleString("vi-VN")} đ` : yesterdaySales;
  const stockDisplay = animatedStock.toLocaleString("vi-VN");

  const wfMatch = workforceToday.match(/^(\d+)\s*\/\s*(\d+)$/);
  const checkedInTarget = wfMatch ? parseInt(wfMatch[1], 10) : (summary?.timekeeping?.checkedInToday ?? 0);
  const totalEmployeesTarget = wfMatch ? parseInt(wfMatch[2], 10) : (summary?.timekeeping?.totalEmployees ?? 0);
  const animatedCheckedIn = useCountUp(checkedInTarget);
  const workforceDisplay = wfMatch
    ? `${animatedCheckedIn} / ${totalEmployeesTarget}`
    : workforceToday;

  const revenueLabel = animatedRevenue >= 1e9
    ? `${(animatedRevenue / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} Tỷ ₫`
    : animatedRevenue >= 1e6
    ? `${(animatedRevenue / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} Tr ₫`
    : `${animatedRevenue.toLocaleString("vi-VN")} ₫`;

  // Tính toán so sánh Doanh số hôm nay vs hôm qua
  const todayDiff = todayVal - yesterdayVal;
  const todayPct = yesterdayVal > 0
    ? Math.round((todayDiff / yesterdayVal) * 100)
    : todayVal > 0
    ? 100
    : 0;
  const todayDiffFormatted = formatVietnameseCompactAmount(Math.abs(todayDiff));
  const todayDeltaText = todayDiff > 0
    ? `+${todayPct}% tăng ${todayDiffFormatted}`
    : todayDiff < 0
    ? `-${Math.abs(todayPct)}% giảm ${todayDiffFormatted}`
    : "0% so với hôm qua";

  // Tính toán so sánh Doanh thu tháng vs tháng trước
  const monthVal = revenueTotal;
  const prevMonthVal = previousRevenueTotal;
  const monthDiff = monthVal - prevMonthVal;
  const monthPct = prevMonthVal > 0 ? Math.round((monthDiff / prevMonthVal) * 100) : null;
  const previousLabel = timeFilter === "month" ? "tháng trước" : timeFilter === "quarter" ? "quý trước" : "năm trước";
  const comparisonRange = revenueComparisonRange(timeFilter);
  const monthDiffFormatted = formatVietnameseCompactAmount(Math.abs(monthDiff));
  const monthDeltaText = isLoadingRevenue ? "Đang tải so sánh…" : revenueError ? "Không tải được dữ liệu so sánh" : monthPct === null ? "Chưa có cơ sở so sánh" : monthDiff > 0
    ? `+${monthPct}% tăng ${monthDiffFormatted}`
    : monthDiff < 0
    ? `-${Math.abs(monthPct)}% giảm ${monthDiffFormatted}`
    : `0% so với ${previousLabel}`;

  // Real Alerts from actionItems
  const overdueTasks = actionItems?.overdueTasks || [];
  const contractAlerts = actionItems?.contractExpiryAlerts || [];
  const pendingApprovals = actionItems?.pendingApprovals || [];
  const lowStockAlerts = actionItems?.lowStockAlerts || [];

  // SVG Chart calculation for Sales Overview
  const plotWidth = 600;
  const plotHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const innerWidth = plotWidth - paddingX * 2;
  const innerHeight = plotHeight - paddingY * 2;

  const maxVal = Math.max(...revenueData.map((d) => d.amount), 1000);
  const points = revenueData.map((d, index) => {
    const x = paddingX + (index / Math.max(revenueData.length - 1, 1)) * innerWidth;
    const y = paddingY + innerHeight - (d.amount / maxVal) * innerHeight;
    return { ...d, x, y };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "")
    : "";

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${plotHeight - paddingY} L ${points[0].x} ${plotHeight - paddingY} Z`
    : "";

  const todayFormatted = new Date().toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const currentHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date())
  );
  const greetingData = getEnthusiasticGreeting(currentHour, userDisplayName);

  return (
    <div className="space-y-6 text-slate-800">
      {/* ========================================================================= */}
      {/* HEADER SECTION (Without duplicate branch badge)                           */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Tổng quan</h1>
          <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-600">
            {greetingData.isNight ? (
              <Moon className="h-4 w-4 shrink-0 text-indigo-500" />
            ) : (
              <Sun className="h-4 w-4 shrink-0 text-amber-500" />
            )}
            <span>{greetingData.greeting}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector Badge */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span>{todayFormatted}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </div>

          {/* Customize / Action Button */}
          <button
            type="button"
            onClick={() => onNavigate("NHÂN SỰ", "lich")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Tùy chỉnh</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 1: TOP 5 KPI CARDS (Formula: Content/Số/KPI -> Title, Tiếng Việt)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Doanh số hôm nay */}
        <div
          onClick={() => onNavigate("BÁN LẺ")}
          className="relative rounded-2xl border border-slate-200/80 bg-white p-3 lg:p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          style={{ animation: "kpiCardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 40ms both" }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {/* KPI / Số / Content trước */}
            <p className="text-base lg:text-lg font-black text-slate-900 truncate tracking-tight" title={todaySales}>
              {displayTodaySales}
            </p>
            {/* Title sau */}
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              Doanh số hôm nay
            </p>
            {/* Dòng nhỏ so sánh đặt ở DƯỚI */}
            <div
              className="mt-0.5 flex items-center cursor-pointer"
              onMouseEnter={() => setHoveredDeltaCard("today")}
              onMouseLeave={() => setHoveredDeltaCard(null)}
            >
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                  todayDiff >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {todayDiff >= 0 ? (
                  <TrendingUp className="h-3 w-3 shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate whitespace-nowrap">{todayDeltaText}</span>
              </span>
            </div>

            {/* Hover Tooltip chi tiết */}
            {hoveredDeltaCard === "today" && (
              <div
                className="pointer-events-none select-none absolute z-30 bottom-full left-0 mb-2 w-64 rounded-xl bg-slate-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-xs transition-opacity duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60 mb-2">
                  <span className="font-semibold text-slate-300 text-[11px]">So sánh hôm nay & hôm qua</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    todayDiff >= 0 ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"
                  }`}>
                    {todayDiff >= 0 ? `+${todayPct}%` : `-${Math.abs(todayPct)}%`}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Hôm nay:</span>
                    <span className="font-bold text-white">{todayVal.toLocaleString("vi-VN")} ₫</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Hôm qua:</span>
                    <span className="font-bold text-white">{yesterdayVal.toLocaleString("vi-VN")} ₫</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-700/60 mt-1">
                    <span className="text-slate-400">Chênh lệch:</span>
                    <span className={`font-extrabold ${todayDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {todayDiff >= 0 ? "+" : ""}{todayDiff.toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Doanh số hôm qua */}
        <div
          onClick={() => onNavigate("BÁN LẺ")}
          className="rounded-2xl border border-slate-200/80 bg-white p-3 lg:p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          style={{ animation: "kpiCardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 90ms both" }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {/* KPI / Số / Content trước */}
            <p className="text-base lg:text-lg font-black text-slate-900 truncate tracking-tight" title={yesterdaySales}>
              {displayYesterdaySales}
            </p>
            {/* Title sau */}
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              Doanh số hôm qua
            </p>
          </div>
        </div>

        {/* Card 3: Sản phẩm tồn kho */}
        <div
          onClick={() => onNavigate("KHO & SẢN PHẨM", "san-pham")}
          className="rounded-2xl border border-slate-200/80 bg-white p-3 lg:p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          style={{ animation: "kpiCardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 140ms both" }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {/* KPI / Số / Content trước */}
            <p className="text-base lg:text-lg font-black text-slate-900 truncate tracking-tight" title={`${stockDisplay} sản phẩm`}>
              {stockDisplay}
            </p>
            {/* Title sau */}
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              Sản phẩm tồn kho
            </p>
          </div>
        </div>

        {/* Card 4: Nhân sự hôm nay */}
        <div
          onClick={() => onNavigate("NHÂN SỰ", "lich")}
          className="rounded-2xl border border-slate-200/80 bg-white p-3 lg:p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          style={{ animation: "kpiCardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 190ms both" }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {/* KPI / Số / Content trước */}
            <p className="text-base lg:text-lg font-black text-slate-900 truncate tracking-tight" title={workforceToday}>
              {workforceDisplay}
            </p>
            {/* Title sau */}
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              Nhân sự hôm nay
            </p>
          </div>
        </div>

        {/* Card 5: Doanh thu tháng */}
        <div
          onClick={() => onNavigate("BÁN LẺ")}
          className="relative rounded-2xl border border-slate-200/80 bg-white p-3 lg:p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
          style={{ animation: "kpiCardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) 240ms both" }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {/* KPI / Số / Content trước */}
            <p className="text-base lg:text-lg font-black text-slate-900 truncate tracking-tight" title={revenueLabel}>
              {revenueLabel}
            </p>
            {/* Title sau */}
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              Doanh thu tháng
            </p>
            {/* Dòng nhỏ so sánh đặt ở DƯỚI */}
            <div
              className="mt-0.5 flex items-center cursor-pointer"
              onMouseEnter={() => setHoveredDeltaCard("month")}
              onMouseLeave={() => setHoveredDeltaCard(null)}
            >
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                  monthDiff >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {monthDiff >= 0 ? (
                  <TrendingUp className="h-3 w-3 shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate whitespace-nowrap">{monthDeltaText}</span>
              </span>
            </div>

            {/* Hover Tooltip chi tiết */}
            {hoveredDeltaCard === "month" && (
              <div
                className="pointer-events-none select-none absolute z-30 bottom-full right-0 mb-2 w-64 rounded-xl bg-slate-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-xs transition-opacity duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60 mb-2">
                  <span className="font-semibold text-slate-300 text-[11px]">So sánh kỳ này & {previousLabel}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    monthDiff >= 0 ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"
                  }`}>
                    {isLoadingRevenue || revenueError || monthPct === null ? "—" : monthDiff >= 0 ? `+${monthPct}%` : `-${Math.abs(monthPct)}%`}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Kỳ này ({comparisonRange.from} → {comparisonRange.to}):</span>
                    <span className="font-bold text-white">{monthVal.toLocaleString("vi-VN")} ₫</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Kỳ trước ({comparisonRange.previousFrom} → {comparisonRange.previousTo}):</span>
                    <span className="font-bold text-white">{prevMonthVal.toLocaleString("vi-VN")} ₫</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-700/60 mt-1">
                    <span className="text-slate-400">Chênh lệch:</span>
                    <span className={`font-extrabold ${monthDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {monthDiff >= 0 ? "+" : ""}{monthDiff.toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: MIDDLE SECTION (3 Columns: Sales Overview, Top Selling, Alerts)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* ========================================================================= */}
        {/* Col 1: Sales Overview (Purple Line Curve Chart) - 5 cols                  */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tổng quan doanh thu</h3>
              <p className="text-xs text-slate-500">
                Xu hướng doanh thu theo thời gian
              </p>
            </div>

            {/* Time Filter Button Dropdown */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleTimeFilterChange("month")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  timeFilter === "month" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-500"
                }`}
              >
                Tháng
              </button>
              <button
                type="button"
                onClick={() => handleTimeFilterChange("quarter")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  timeFilter === "quarter" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-500"
                }`}
              >
                Quý
              </button>
              <button
                type="button"
                onClick={() => handleTimeFilterChange("year")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  timeFilter === "year" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-500"
                }`}
              >
                Năm
              </button>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="relative flex-1 min-h-[220px] flex items-center justify-center">
            {isLoadingRevenue ? (
              <p className="text-xs text-slate-400">Đang tải biểu đồ...</p>
            ) : revenueData.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có doanh thu trong kỳ này.</p>
            ) : (
              <div className="relative w-full h-full">
                <svg
                  key={`revenue-chart-${timeFilter}-${revenueData.length}`}
                  viewBox={`0 0 ${plotWidth} ${plotHeight}`}
                  className="h-full w-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>
                    <style>{`
                      @keyframes chartLineDraw {
                        0% { stroke-dashoffset: 100; opacity: 0.2; }
                        100% { stroke-dashoffset: 0; opacity: 1; }
                      }
                      @keyframes chartAreaRise {
                        0% { opacity: 0; transform: translateY(10px) scaleY(0.7); }
                        100% { opacity: 1; transform: translateY(0) scaleY(1); }
                      }
                      @keyframes chartDotPop {
                        0% { transform: scale(0); opacity: 0; }
                        65% { transform: scale(1.3); opacity: 1; }
                        100% { transform: scale(1); opacity: 1; }
                      }
                    `}</style>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = paddingY + innerHeight * (1 - ratio);
                    return (
                      <line
                        key={ratio}
                        x1={paddingX}
                        y1={y}
                        x2={plotWidth - paddingX}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* Area fill - Animate once on entry */}
                  <path
                    d={areaD}
                    fill="url(#purpleGrad)"
                    style={{
                      transformOrigin: "bottom",
                      animation: "chartAreaRise 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    }}
                  />

                  {/* Smooth line - Draw-in animation once on entry */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={100}
                    style={{
                      strokeDasharray: 100,
                      strokeDashoffset: 0,
                      animation: "chartLineDraw 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    }}
                  />

                  {/* Points on curve - Staggered pop-in animation once on entry */}
                  {points.map((p, idx) => {
                    const isSelected = activePoint?.bucket === p.bucket;
                    return (
                      <g
                        key={p.bucket || idx}
                        className="cursor-pointer"
                        style={{
                          transformOrigin: `${p.x}px ${p.y}px`,
                          animation: `chartDotPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${350 + Math.min(idx * 35, 500)}ms both`,
                        }}
                      >
                        {/* Invisible hit target for smooth, jitter-free hover */}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="18"
                          fill="transparent"
                          onMouseEnter={() => setActivePoint(p)}
                          onMouseLeave={() => {
                            setActivePoint((curr) => (curr?.bucket === p.bucket ? null : curr));
                          }}
                        />
                        {/* Subtle glow halo when active */}
                        {isSelected && (
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="10"
                            fill="#6366f1"
                            fillOpacity="0.2"
                            className="pointer-events-none transition-all duration-150"
                          />
                        )}
                        {/* Visual dot */}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isSelected ? "6" : "4.5"}
                          fill="#ffffff"
                          stroke="#6366f1"
                          strokeWidth={isSelected ? "3" : "2.5"}
                          className="pointer-events-none transition-all duration-150"
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip */}
                {activePoint && (
                  <div
                    className={`pointer-events-none select-none absolute z-20 -translate-x-1/2 rounded-xl bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur-xs transition-opacity duration-150 ${
                      activePoint.y / plotHeight < 0.25
                        ? "translate-y-3"
                        : "-translate-y-full -mt-2.5"
                    }`}
                    style={{
                      left: `${(activePoint.x / plotWidth) * 100}%`,
                      top: `${(activePoint.y / plotHeight) * 100}%`,
                    }}
                  >
                    <p className="font-semibold text-slate-300 text-[11px]">{activePoint.bucket}</p>
                    <p className="font-extrabold text-white text-[13px] leading-tight">
                      {activePoint.amount.toLocaleString("vi-VN")} ₫
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* X Axis Date labels */}
          <div className="mt-2 flex justify-between px-2 text-[10px] font-semibold text-slate-400">
            {revenueData.length > 0 ? (
              <>
                <span>{revenueData[0]?.bucket}</span>
                {revenueData.length > 2 && (
                  <span>{revenueData[Math.floor(revenueData.length / 2)]?.bucket}</span>
                )}
                <span>{revenueData[revenueData.length - 1]?.bucket}</span>
              </>
            ) : (
              <span>Thời gian</span>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Col 2: Top Selling Products (Real Donut Card) - 4 cols                    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <BestSellingProductsCard filter={timeFilter} embedded compact />
        </div>

        {/* ========================================================================= */}
        {/* Col 3: Alerts & Notifications (Soft pastel list matching image) - 3 cols   */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Cảnh báo & Nhắc việc</h3>
            <span
              onClick={() => onNavigate("NHÂN SỰ", "kanban")}
              className="text-xs font-bold text-indigo-600 cursor-pointer hover:underline"
            >
              Xem tất cả
            </span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* 1. Red Alert: Overdue Tasks */}
            <div
              onClick={() => onNavigate("NHÂN SỰ", "kanban")}
              className="flex items-center justify-between rounded-2xl bg-rose-50/70 p-3.5 border border-rose-100/60 hover:bg-rose-50 transition cursor-pointer"
              style={{ animation: "alertItemSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 100ms both" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-rose-900 truncate">
                    {overdueTasks.length > 0 ? `${overdueTasks.length} việc quá hạn` : "Không có việc quá hạn"}
                  </p>
                  <p className="text-[11px] text-rose-700/80 truncate">
                    {overdueTasks.length > 0 ? overdueTasks[0].title : "Đúng tiến độ"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-rose-400 shrink-0" />
            </div>

            {/* 2. Orange Alert: Contracts Expiring */}
            <div
              onClick={() => {
                if (contractAlerts.length > 0 && onOpenContract) {
                  onOpenContract(contractAlerts[0].employeeName);
                } else {
                  onNavigate("NHÂN SỰ", "hop-dong");
                }
              }}
              className="flex items-center justify-between rounded-2xl bg-amber-50/70 p-3.5 border border-amber-100/60 hover:bg-amber-50 transition cursor-pointer"
              style={{ animation: "alertItemSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 220ms both" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <FileClock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-900 truncate">
                    {contractAlerts.length > 0
                      ? `${contractAlerts.length} hợp đồng sắp hết hạn`
                      : "Không có HĐ sắp hết hạn"}
                  </p>
                  <p className="text-[11px] text-amber-700/80 truncate">
                    {contractAlerts.length > 0 ? contractAlerts[0].employeeName : "Đầy đủ hiệu lực"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-400 shrink-0" />
            </div>

            {/* 3. Blue Alert: Pending Approvals */}
            <div
              onClick={() => onNavigate("NHÂN SỰ", "lich&view=requests")}
              className="flex items-center justify-between rounded-2xl bg-sky-50/70 p-3.5 border border-sky-100/60 hover:bg-sky-50 transition cursor-pointer"
              style={{ animation: "alertItemSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 340ms both" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-sky-900 truncate">
                    {pendingApprovals.length > 0
                      ? `${pendingApprovals.length} phiếu chờ duyệt`
                      : "Không có phiếu chờ"}
                  </p>
                  <p className="text-[11px] text-sky-700/80 truncate">
                    {pendingApprovals.length > 0 ? pendingApprovals[0].employeeName : "Đã duyệt hết"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sky-400 shrink-0" />
            </div>

            {/* 4. Purple Alert: Low Stock */}
            <div
              onClick={() => onNavigate("KHO & SẢN PHẨM", "nhap-hang")}
              className="flex items-center justify-between rounded-2xl bg-purple-50/70 p-3.5 border border-purple-100/60 hover:bg-purple-50 transition cursor-pointer"
              style={{ animation: "alertItemSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 460ms both" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <Boxes className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-purple-900 truncate">
                    {lowStockAlerts.length > 0
                      ? `${lowStockAlerts.length} mã chạm đáy`
                      : "Tồn kho trong ngưỡng"}
                  </p>
                  <p className="text-[11px] text-purple-700/80 truncate">
                    {lowStockAlerts.length > 0 ? lowStockAlerts[0].name : "An toàn kho"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-purple-400 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 3: BOTTOM SECTION (3 Data Tables / Status Lists)                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Table 1: Expiring Products / Contracts (Col 1 - 4 cols) */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3
              onClick={() => onNavigate("NHÂN SỰ", "hop-dong")}
              className="text-sm font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition"
            >
              Hợp đồng & Cảnh báo đến hạn
            </h3>
            <span
              onClick={() => onNavigate("NHÂN SỰ", "hop-dong")}
              className="text-xs font-bold text-indigo-600 cursor-pointer hover:underline"
            >
              Xem tất cả
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="pb-2.5 font-medium">Nhân sự / Mã</th>
                  <th className="pb-2.5 font-medium">Hạn</th>
                  <th className="pb-2.5 text-right font-medium">Ngày còn lại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contractAlerts.length > 0 ? (
                  contractAlerts.slice(0, 5).map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (onOpenContract) {
                          onOpenContract(item.employeeName);
                        } else {
                          onNavigate("NHÂN SỰ", "hop-dong");
                        }
                      }}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      <td className="py-2.5 font-semibold text-slate-800 truncate max-w-[140px]">
                        {item.employeeName}
                      </td>
                      <td className="py-2.5 text-slate-500">{item.endDate?.slice(0, 10)}</td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                            item.daysRemaining <= 3
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {item.daysRemaining} ngày
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr
                    onClick={() => onNavigate("NHÂN SỰ", "hop-dong")}
                    className="hover:bg-slate-50/50 cursor-pointer"
                  >
                    <td colSpan={3} className="py-6 text-center text-slate-400">
                      Không có hợp đồng sắp hết hạn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Task Production Status (Col 2 - 4 cols) */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Tiến độ công việc</h3>
            <span
              onClick={() => onNavigate("NHÂN SỰ", "kanban")}
              className="text-xs font-bold text-indigo-600 cursor-pointer hover:underline"
            >
              Xem tất cả
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {summary?.projects?.tasks ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Đã hoàn thành</span>
                  <span className="font-bold text-emerald-600">{summary.projects.tasks.done} việc</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${summary.projects.tasks.total > 0 ? (summary.projects.tasks.done / summary.projects.tasks.total) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-semibold text-slate-700">Đang thực hiện</span>
                  <span className="font-bold text-indigo-600">{summary.projects.tasks.doing} việc</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{
                      width: `${summary.projects.tasks.total > 0 ? (summary.projects.tasks.doing / summary.projects.tasks.total) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-semibold text-slate-700">Cần làm</span>
                  <span className="font-bold text-slate-500">{summary.projects.tasks.todo} việc</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full"
                    style={{
                      width: `${summary.projects.tasks.total > 0 ? (summary.projects.tasks.todo / summary.projects.tasks.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">Chưa có dữ liệu tiến độ.</p>
            )}
          </div>
        </div>

        {/* Table 3: Attendance Summary (Col 3 - 4 cols) */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Tổng hợp chấm công</h3>
            <span
              onClick={() => onNavigate("NHÂN SỰ", "lich")}
              className="text-xs font-bold text-indigo-600 cursor-pointer hover:underline"
            >
              Xem tất cả
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Có mặt</span>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {summary?.timekeeping?.checkedInToday ?? 0}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Đã vào ca</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Đi muộn</span>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {summary?.timekeeping?.lateToday ?? 0}
              </p>
              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Vào ca trễ</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Nghỉ phép</span>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {summary?.timekeeping?.onApprovedLeaveToday ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Có duyệt đơn</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Chưa vào ca</span>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {summary?.timekeeping?.absentWithoutLeave ??
                  Math.max(
                    0,
                    (summary?.timekeeping?.totalEmployees || 0) -
                      (summary?.timekeeping?.checkedInToday || 0)
                  )}
              </p>
              <p className="text-[10px] text-rose-600 font-semibold mt-0.5">Chưa điểm danh</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
