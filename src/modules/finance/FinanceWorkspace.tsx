import FinancialManagementPage from "./pages/FinancialManagementPage";
import DebtManagementPanel from "./pages/DebtManagementPanel";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Boxes, ChartNoAxesColumnIncreasing, ClipboardCheck, Landmark, TrendingDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import type { AgingBucket } from "./api/financeReceivables.api";
import ReceivableDetailDrawer from "./components/ReceivableDetailDrawer";
import AgingReportPage from "./pages/AgingReportPage";
import AssetDepreciationPage from "./pages/AssetDepreciationPage";
import AssetInventoryPage from "./pages/AssetInventoryPage";
import FixedAssetsPage from "./pages/FixedAssetsPage";
import FinanceRemindersPage from "./pages/FinanceRemindersPage";
import ReceivablesPage from "./pages/ReceivablesPage";

type FinanceSubTab =
  | "TỔNG QUAN" | "THU CHI" | "LÃI LỖ" | "VAT" | "HÒA VỐN"
  | "CÔNG NỢ"
  | "TUỔI NỢ"
  | "NHẮC NỢ"
  | "TÀI SẢN"
  | "KHẤU HAO"
  | "KIỂM KÊ";
export const FINANCE_SUB_TABS = [
  { slug: "tong-quan", value: "TỔNG QUAN" as const, label: "Tổng quan", icon: ChartNoAxesColumnIncreasing },
  { slug: "thu-chi", value: "THU CHI" as const, label: "Thu - Chi", icon: Landmark },
  { slug: "lai-lo", value: "LÃI LỖ" as const, label: "Lãi lỗ", icon: TrendingDown },
  { slug: "vat", value: "VAT" as const, label: "VAT", icon: Landmark },
  { slug: "hoa-von", value: "HÒA VỐN" as const, label: "Hòa vốn", icon: ChartNoAxesColumnIncreasing },
  {
    slug: "cong-no",
    value: "CÔNG NỢ" as const,
    label: "Công nợ",
    icon: Landmark,
  },
  {
    slug: "tuoi-no",
    value: "TUỔI NỢ" as const,
    label: "Tuổi nợ",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    slug: "nhac-no",
    value: "NHẮC NỢ" as const,
    label: "Nhắc nợ",
    icon: BellRing,
  },
  {
    slug: "tai-san",
    value: "TÀI SẢN" as const,
    label: "Tài sản",
    icon: Boxes,
  },
  {
    slug: "khau-hao",
    value: "KHẤU HAO" as const,
    label: "Khấu hao",
    icon: TrendingDown,
  },
  {
    slug: "kiem-ke",
    value: "KIỂM KÊ" as const,
    label: "Kiểm kê",
    icon: ClipboardCheck,
  },
] as const;

export function getAllowedFinanceTabSlugs(permissions: readonly string[] = []) {
  if (permissions.includes("*")) return FINANCE_SUB_TABS.map((tab) => tab.slug);
  const allowed: Array<(typeof FINANCE_SUB_TABS)[number]["slug"]> = [];
  if (permissions.includes("finance-wallet:manage")) allowed.push("tong-quan", "thu-chi", "lai-lo", "vat", "hoa-von");
  const canReadReceivables = permissions.some((item) =>
    ["finance-receivable:read", "finance-receivable:manage"].includes(item),
  );
  if (canReadReceivables) allowed.push("cong-no", "tuoi-no", "nhac-no");
  const canReadAssets = permissions.some((item) =>
    ["asset:read", "asset:manage"].includes(item),
  );
  if (canReadAssets) allowed.push("tai-san", "khau-hao", "kiem-ke");
  return allowed;
}

export function resolveFinanceSubTab(
  search: string,
  allowed: readonly string[],
): FinanceSubTab | undefined {
  const slug = new URLSearchParams(search).get("sub");
  const match = FINANCE_SUB_TABS.find(
    (tab) => tab.slug === slug && allowed.includes(tab.slug),
  );
  return (
    match?.value ||
    FINANCE_SUB_TABS.find((tab) => allowed.includes(tab.slug))?.value
  );
}

export default function FinanceWorkspace() {
  const { userProfile } = useAuth();
  const permissions =
    userProfile?.role === "admin" || userProfile?.role === "superadmin"
      ? ["*"]
      : userProfile?.permissions || [];
  const allowedSlugs = useMemo(
    () => getAllowedFinanceTabSlugs(permissions),
    [permissions],
  );
  const tabs = useMemo(
    () => FINANCE_SUB_TABS.filter((tab) => allowedSlugs.includes(tab.slug)),
    [allowedSlugs],
  );
  const fallback =
    resolveFinanceSubTab(window.location.search, allowedSlugs) || "CÔNG NỢ";
  const [activeTab, setActiveTab] = useSubTabRouter<FinanceSubTab>(
    tabs as any,
    fallback,
  );
  const tabBarRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const bar = tabBarRef.current;
    const button = activeTabRef.current;
    if (!bar || !button) return;
    const revealActiveTab = () => {
      const viewport = bar.getBoundingClientRect();
      const active = button.getBoundingClientRect();
      const padding = 8;
      if (active.right > viewport.right - padding) {
        bar.scrollLeft += active.right - viewport.right + padding;
      } else if (active.left < viewport.left + padding) {
        bar.scrollLeft -= viewport.left + padding - active.left;
      }
    };
    revealActiveTab();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(revealActiveTab);
    observer.observe(bar);
    observer.observe(button);
    return () => observer.disconnect();
  }, [activeTab, tabs.length]);
  const [selectedId, setSelectedId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const drillDown = (bucket: AgingBucket) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sub", "cong-no");
    url.searchParams.set("aging", bucket);
    window.history.replaceState(null, "", url);
    setActiveTab("CÔNG NỢ");
  };
  if (!tabs.length)
    return (
      <div className="p-6 text-sm font-semibold text-amber-800">
        Bạn chưa được cấp quyền sử dụng chức năng tài chính.
      </div>
    );
  return (
    <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-slate-50">
      <div ref={tabBarRef} className="flex w-full min-w-0 max-w-full shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.slug}
              ref={activeTab === tab.value ? activeTabRef : undefined}
              aria-current={activeTab === tab.value ? "page" : undefined}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-t-xl px-3 py-2.5 text-sm font-semibold ${activeTab === tab.value ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-cyan-50"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {(["TỔNG QUAN", "THU CHI", "LÃI LỖ", "VAT", "HÒA VỐN"].includes(activeTab)) && <FinancialManagementPage key={activeTab} view={({ "TỔNG QUAN": "overview", "THU CHI": "cash", "LÃI LỖ": "profit", "VAT": "vat", "HÒA VỐN": "breakeven" } as const)[activeTab as "TỔNG QUAN" | "THU CHI" | "LÃI LỖ" | "VAT" | "HÒA VỐN"]} />}
        {(["CÔNG NỢ", "TUỔI NỢ", "NHẮC NỢ"].includes(activeTab)) && <DebtManagementPanel key={activeTab + refreshKey} mode={activeTab === "CÔNG NỢ" ? "debt" : activeTab === "TUỔI NỢ" ? "aging" : "reminders"} permissions={permissions} onOpen={setSelectedId} />}
        {activeTab === "CÔNG NỢ" && (
          <ReceivablesPage
            key={refreshKey}
            permissions={permissions}
            onOpen={setSelectedId}
          />
        )}{" "}
        {activeTab === "TUỔI NỢ" && <details className="mt-5"><summary className="mb-3 cursor-pointer text-sm text-slate-600">Báo cáo nhóm tuổi nợ cũ</summary><AgingReportPage onDrillDown={drillDown} /></details>}{" "}
        {activeTab === "NHẮC NỢ" && (
          <FinanceRemindersPage permissions={permissions} />
        )}{" "}
        {activeTab === "TÀI SẢN" && <FixedAssetsPage permissions={permissions} />}{" "}
        {activeTab === "KHẤU HAO" && (
          <AssetDepreciationPage permissions={permissions} />
        )}{" "}
        {activeTab === "KIỂM KÊ" && (
          <AssetInventoryPage permissions={permissions} />
        )}
      </div>
      {selectedId && (
        <ReceivableDetailDrawer
          id={selectedId}
          permissions={permissions}
          onClose={() => setSelectedId(undefined)}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </div>
  );
}
