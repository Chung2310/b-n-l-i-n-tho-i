import { Users, Clock, UserX, CheckCircle2 } from "lucide-react";
import { DashboardSummary, DashboardActionItems } from "../../types/dashboard";
import { ActionItemsWidget } from "./ActionItemsWidget";
import { DashboardSectionCard } from "./DashboardSectionCard";
import { buildContractReviewUrl } from "../../utils/contractExpiryNavigation";

export function OverviewPanel({
  summary,
  actionItems,
  canSeeHr,
}: {
  summary: DashboardSummary | null;
  actionItems?: DashboardActionItems | null;
  canSeeHr: boolean;
}) {
  const goToTab = (tab: string, subTab?: string) => {
    const path = tab === "NHÂN SỰ" ? "/nhan-su" : "/tong-quan";
    const url = subTab ? `${path}?sub=${subTab}` : path;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const goToContract = (employeeName: string) => {
    window.history.pushState(null, "", buildContractReviewUrl(employeeName));
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const SimpleMetric = ({ icon: Icon, title, value, unit, tone = "blue", onClick }: any) => {
    const tones: Record<string, { bg: string; text: string; iconBg: string }> = {
      blue: { bg: "hover:bg-blue-50/50 hover:border-[#9ca3af]", text: "text-blue-600", iconBg: "bg-blue-50 text-blue-600" },
      amber: { bg: "hover:bg-amber-50/50 hover:border-[#9ca3af]", text: "text-amber-600", iconBg: "bg-amber-50 text-amber-600" },
      emerald: { bg: "hover:bg-emerald-50/50 hover:border-[#9ca3af]", text: "text-emerald-600", iconBg: "bg-emerald-50 text-emerald-600" },
      rose: { bg: "hover:bg-rose-50/50 hover:border-[#9ca3af]", text: "text-rose-600", iconBg: "bg-rose-50 text-rose-600" },
      slate: { bg: "hover:bg-slate-50 hover:border-[#9ca3af]", text: "text-slate-600", iconBg: "bg-slate-100 text-slate-700" },
    };
    const c = tones[tone] || tones.blue;
    return (
      <div onClick={onClick} className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#d1d5db] bg-white p-3.5 shadow-sm transition-all duration-200 ${onClick ? `cursor-pointer ${c.bg}` : ""}`}>
        <div className="mb-2 flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconBg}`}><Icon className="h-4 w-4" /></div>
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-700">{title}</p>
        </div>
        <div className="flex items-baseline gap-1.5"><span className="truncate text-xl font-black tracking-tight text-slate-800">{value}</span>{unit && <span className="text-[10px] font-bold uppercase text-slate-600">{unit}</span>}</div>
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-3">
      {actionItems && <ActionItemsWidget actionItems={actionItems} onGoToTasks={() => goToTab("NHÂN SỰ", "kanban")} onGoToApprovals={() => goToTab("NHÂN SỰ", "lich")} onGoToInventory={() => { window.history.pushState(null, "", "/kho-san-pham?sub=nhap-hang"); window.dispatchEvent(new PopStateEvent("popstate")); }} onGoToContract={(alert) => goToContract(alert.employeeName)} />}
      {canSeeHr && (
        <DashboardSectionCard title="Nhân sự & Chấm công" icon={Users} gradientFrom="from-emerald-500" gradientTo="to-teal-600">
          <SimpleMetric icon={CheckCircle2} tone="emerald" title="Đi làm" value={summary ? String(summary.timekeeping.checkedInToday) : "..."} unit={`/ ${summary ? summary.timekeeping.totalEmployees : "..."} Người`} onClick={() => goToTab("NHÂN SỰ", "lich")} />
          <SimpleMetric icon={Clock} tone="amber" title="Đi muộn" value={summary ? String(summary.timekeeping.lateToday) : "..."} unit="Người" onClick={() => goToTab("NHÂN SỰ", "lich")} />
          <SimpleMetric icon={UserX} tone="slate" title="Nghỉ phép" value={summary?.timekeeping?.onApprovedLeaveToday != null ? String(summary.timekeeping.onApprovedLeaveToday) : "..."} unit="Người" onClick={() => goToTab("NHÂN SỰ", "lich")} />
          <SimpleMetric icon={UserX} tone="rose" title="Nghỉ không phép" value={summary?.timekeeping?.absentWithoutLeave != null ? String(summary.timekeeping.absentWithoutLeave) : "..."} unit="Người" onClick={() => goToTab("NHÂN SỰ", "lich")} />
        </DashboardSectionCard>
      )}
    </div>
  );
}
