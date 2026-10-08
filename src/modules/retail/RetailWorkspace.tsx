import { lazy, Suspense } from "react";
import { ChartColumn, Clock3, FileText, ListOrdered, RotateCcw, Settings, ShieldCheck, Store, Ticket } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

const SettingsPage = lazy(() => import("./pages/RetailSettingsPage"));
const CouponsPage = lazy(() => import("./pages/RetailCouponsPage"));
const OrdersPage = lazy(() => import("./pages/RetailOrdersPageV2"));
const ReturnsPage = lazy(() => import("./pages/RetailReturnsPage"));
const InvoicesPage = lazy(() => import("./pages/RetailInvoicesPageContent"));
const ReportsPage = lazy(() => import("./pages/RetailReportsPage"));
const WarrantyLookupPage = lazy(() => import("./pages/WarrantyLookupPage"));
const ShiftWorkspace = lazy(() => import("./pages/RetailShiftWorkspace"));
const ShiftReconciliation = lazy(() => import("./pages/RetailShiftReconciliationPanel"));

type RetailSubTab = "BÁN HÀNG" | "ĐƠN HÀNG" | "ĐỔI TRẢ" | "HÓA ĐƠN" | "BÁO CÁO" | "CA POS" | "CÀI ĐẶT" | "MÃ ƯU ĐÃI";

const SUB_TABS = [
  { slug: "bao-hanh", value: "BẢO HÀNH" as const, label: "Bảo hành", icon: ShieldCheck },
  { slug: "ban-hang", value: "BÁN HÀNG" as const, label: "Bán hàng", icon: Store },
  { slug: "don-hang", value: "ĐƠN HÀNG" as const, label: "Đơn hàng", icon: ListOrdered },
  { slug: "doi-tra", value: "ĐỔI TRẢ" as const, label: "Đổi trả", icon: RotateCcw },
  { slug: "hoa-don", value: "HÓA ĐƠN" as const, label: "Hóa đơn", icon: FileText },
  { slug: "bao-cao", value: "BÁO CÁO" as const, label: "Báo cáo", icon: ChartColumn },
  { slug: "ca-pos", value: "CA POS" as const, label: "Ca POS", icon: Clock3 },
  { slug: "cai-dat", value: "CÀI ĐẶT" as const, label: "Cài đặt", icon: Settings },
  { slug: "ma-uu-dai", value: "MÃ ƯU ĐÃI" as const, label: "Mã ưu đãi", icon: Ticket },
];

export default function RetailWorkspace() {
  const { userProfile } = useAuth();
  const allowed = getAllowedRetailTabSlugs(
    userProfile?.role === "admin" || userProfile?.role === "superadmin" ? ["*"] : userProfile?.permissions || [],
  );
  const tabs: any = SUB_TABS.filter((tab) => allowed.includes(tab.slug as (typeof allowed)[number]));
  const [activeTab, setActiveTab] = useSubTabRouter<RetailSubTab>(tabs, tabs[0]?.value || "BÁN HÀNG");

  if (!tabs.length) {
    return <div className="p-6 text-sm font-semibold text-amber-800">Bạn chưa được cấp quyền sử dụng chức năng này.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="px-4 pt-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.slug}
                type="button"
                onClick={() => {
                  if (tab.value === "BÁN HÀNG") {
                    window.history.pushState(null, "", "/pos");
                    window.dispatchEvent(new Event("popstate"));
                    return;
                  }
                  setActiveTab(tab.value);
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
                  active
                    ? "bg-cyan-600 text-white shadow-sm shadow-cyan-600/25"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-slate-500">Đang tải phân hệ bán hàng...</div>}>
          {activeTab === "BÁN HÀNG" && <div className="rounded-2xl border border-cyan-200 bg-white p-6 text-sm text-slate-600"><a href="/pos" className="inline-flex rounded-xl bg-cyan-700 px-5 py-3 font-bold text-white">Mở quầy POS toàn màn hình</a></div>}
          {activeTab === "ĐƠN HÀNG" && <OrdersPage />}
          {activeTab === "ĐỔI TRẢ" && <ReturnsPage />}
          {activeTab === "HÓA ĐƠN" && <InvoicesPage />}
          {activeTab === "BÁO CÁO" && <ReportsPage />}
          {activeTab === "CA POS" && <div className="space-y-5"><ShiftReconciliation /><ShiftWorkspace /></div>}
          {activeTab === "CÀI ĐẶT" && <SettingsPage />}
          {activeTab === "MÃ ƯU ĐÃI" && <CouponsPage />}
          {(activeTab as any) === "BẢO HÀNH" && <WarrantyLookupPage />}
        </Suspense>
      </div>
    </div>
  );
}
