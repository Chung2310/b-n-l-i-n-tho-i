import { useEffect, useState } from "react";
import {
  Wrench,
  ShieldCheck,
  BarChart3,
  Sparkles,
} from "lucide-react";
import WarrantyLookupSection from "../components/inventory/WarrantyLookupSection";
import RepairBoardPage, {
  type RepairCreatePrefill,
} from "../modules/repair/RepairBoardPage";
import RepairReportsPanel from "../modules/repair/RepairReportsPanel";

const TABS = [
  { key: "warranty", label: "Tra cứu bảo hành", icon: ShieldCheck },
  { key: "repair", label: "Phiếu sửa chữa", icon: Wrench },
  { key: "reports", label: "Báo cáo", icon: BarChart3 },
] as const;
type RepairView = (typeof TABS)[number]["key"];

export default function RepairTab() {
  const [view, setView] = useState<RepairView>("warranty");
  const [prefill, setPrefill] = useState<RepairCreatePrefill | null>(null);

  useEffect(() => {
    const openRepair = (event: Event) => {
      setPrefill((event as CustomEvent<RepairCreatePrefill>).detail);
      setView("repair");
    };
    window.addEventListener("inventory:open-repair", openRepair);
    return () =>
      window.removeEventListener("inventory:open-repair", openRepair);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-600/20">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Sửa chữa & Bảo hành
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 border border-cyan-200/80 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700">
                <Sparkles className="h-3 w-3" />
                Dịch vụ kỹ thuật
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi tình trạng bảo hành thiết bị theo IMEI/Serial, luồng tiếp nhận sửa chữa và báo cáo hiệu suất.
            </p>
          </div>
        </div>

        {/* Subtabs Switcher */}
        <div className="flex gap-1.5 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-2xs w-fit self-start sm:self-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab View Content */}
      <div className="min-h-0">
        {view === "warranty" && <WarrantyLookupSection />}
        {view === "repair" && (
          <RepairBoardPage
            createPrefill={prefill}
            onCreatePrefillConsumed={() => setPrefill(null)}
          />
        )}
        {view === "reports" && <RepairReportsPanel />}
      </div>
    </div>
  );
}
