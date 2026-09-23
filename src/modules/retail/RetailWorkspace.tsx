import { lazy, Suspense } from "react";
import { ChartColumn, FileText, ListOrdered, Settings, ShieldCheck, Store, Ticket } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

const SettingsPage = lazy(() => import("./pages/RetailSettingsPage"));
const CouponsPage = lazy(() => import("./pages/RetailCouponsPage"));
const PosPage = lazy(() => import("./pages/RetailPosPage"));
const OrdersPage = lazy(() => import("./pages/RetailOrdersPageV2"));
const InvoicesPage = lazy(() => import("./pages/RetailInvoicesPageContent"));
const ReportsPage = lazy(() => import("./pages/RetailReportsPage"));
const WarrantyLookupPage = lazy(() => import("./pages/WarrantyLookupPage"));

type RetailSubTab = "BÁN HÀNG" | "ĐƠN HÀNG" | "HÓA ĐƠN" | "BÁO CÁO" | "CÀI ĐẶT" | "MÃ ƯU ĐÃI";

const SUB_TABS = [
  { slug: "bao-hanh", value: "BẢO HÀNH" as const, label: "Bảo hành", icon: ShieldCheck },
  { slug: "ban-hang", value: "BÁN HÀNG" as const, label: "Bán hàng", icon: Store },
  { slug: "don-hang", value: "ĐƠN HÀNG" as const, label: "Đơn hàng", icon: ListOrdered },
  { slug: "hoa-don", value: "HÓA ĐƠN" as const, label: "Hóa đơn", icon: FileText },
  { slug: "bao-cao", value: "BÁO CÁO" as const, label: "Báo cáo", icon: ChartColumn },
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
                onClick={() => setActiveTab(tab.value)}
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
        <Suspense fallback={<div className="text-sm text-slate-500">Đang tải phân hệ bán lẻ...</div>}>
          {activeTab === "BÁN HÀNG" && <PosPage />}
          {activeTab === "ĐƠN HÀNG" && <OrdersPage />}
          {activeTab === "HÓA ĐƠN" && <InvoicesPage />}
          {activeTab === "BÁO CÁO" && <ReportsPage />}
          {activeTab === "CÀI ĐẶT" && <SettingsPage />}
          {activeTab === "MÃ ƯU ĐÃI" && <CouponsPage />}
          {(activeTab as any) === "BẢO HÀNH" && <WarrantyLookupPage />}
        </Suspense>
      </div>
    </div>
  );
}
