import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, LayoutDashboard, LockKeyhole, MessageSquare, Package, Settings, Shield, Users, BookOpen, ShoppingCart, Landmark, Megaphone, Wrench, ContactRound, Headphones } from "lucide-react";
import { PRIVACY_POLICY_PATH, TERMS_OF_SERVICE_PATH, USER_DATA_DELETION_PATH } from "../config/brand";
import { handleInternalNavigation } from "../utils/internalNavigation";
import type { TabType } from "../types";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useMediaQuery";
import { filterEnabledTabs, MODULE_READ_PERMISSIONS } from "../config/modules";
import { isPartnerPortalProfile } from "../modules/partners/partnerAccess";
import SidebarIcon from "./SidebarIcons";
import { useRetailScope } from "../modules/retail/hooks/useRetailScope";
import { retailShiftsApi } from "../modules/retail/api/retailShifts.api";
import { socketService } from "../services/socketService";

interface SidebarProps { activeTab: TabType; setActiveTab: (tab: TabType) => void; mobileOpen: boolean; onMobileClose: () => void; }
interface MenuItem { label: TabType; title: string; icon: React.ElementType; group: "main" | "operations" | "tools" | "system"; locked?: boolean; }
const baseMenuItems: MenuItem[] = [
  { label: "ĐỐI TÁC", title: "Đối tác & hoa hồng", icon: ContactRound, group: "operations" },
  { label: "TỔNG QUAN", title: "Tổng quan", icon: LayoutDashboard, group: "main" },
  { label: "NHÂN SỰ", title: "Nhân sự", icon: Users, group: "operations" },
  { label: "KHO & SẢN PHẨM", title: "Kho & Sản phẩm", icon: Package, group: "operations" },
  { label: "SỬA CHỮA & BẢO HÀNH", title: "Sửa chữa & bảo hành", icon: Wrench, group: "operations" },
  { label: "QUẢN LÝ KHÁCH HÀNG", title: "Khách hàng", icon: ContactRound, group: "operations" },
  { label: "CSKH", title: "Hộp thư CSKH 1-1", icon: Headphones, group: "operations" },
  { label: "BÁN HÀNG", title: "Bán hàng", icon: ShoppingCart, group: "operations" },
  { label: "TÀI CHÍNH", title: "Tài chính", icon: Landmark, group: "operations" },
  { label: "MARKETING", title: "Marketing tự động", icon: Megaphone, group: "operations" },
  { label: "QUẢN LÝ TÀI NGUYÊN", title: "Quản lý tài nguyên", icon: FolderOpen, group: "tools" },
  { label: "TRÒ CHUYỆN", title: "Trò chuyện nội bộ", icon: MessageSquare, group: "tools" },
];
const groupTitles: Record<MenuItem["group"], string> = { main: "Tổng quan", operations: "Vận hành", tools: "Công cụ", system: "Hệ thống" };

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, hasPermission } = useAuth();
  const { scope } = useRetailScope();
  const canViewSalesManagement = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("retail:manage") || hasPermission("retail:read");
  const isPosOperator = !canViewSalesManagement && hasPermission("pos:manage");
  const companyCode = scope?.companyCode;
  const branchId = scope?.branchId;
  const terminalId = scope?.terminalId;
  const assignmentKey = `${userProfile?.uid}:${companyCode}:${branchId}:${terminalId}`;
  const [assignment, setAssignment] = useState<{ key: string; assigned: boolean } | null>(null);
  const hasAssignedPosShift = isPosOperator && assignment?.key === assignmentKey && assignment.assigned;
  useEffect(() => {
    if (!isPosOperator || !companyCode || !branchId || !terminalId || !userProfile?.uid) return;
    const currentScope = { companyCode, branchId, terminalId };
    let active = true;
    const refresh = async () => {
      try {
        const shift = await retailShiftsApi.current(currentScope);
        if (active) setAssignment({ key: assignmentKey, assigned: shift?.status === "open" && shift.cashierId === userProfile.uid });
      } catch { if (active) setAssignment({ key: assignmentKey, assigned: false }); }
    };
    const onSessionChange = (event: { companyCode?: string; branchId?: string; cashierId?: string }) => {
      if (event?.companyCode === companyCode && event?.branchId === branchId && event?.cashierId === userProfile.uid) void refresh();
    };
    const dispose = ["opened", "closed", "reconciled", "device-changed"].map((event) => socketService.on(`pos:session:${event}`, onSessionChange));
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    void refresh();
    return () => { active = false; dispose.forEach((off) => off()); document.removeEventListener("visibilitychange", onVisibilityChange); window.clearInterval(interval); };
  }, [isPosOperator, companyCode, branchId, terminalId, userProfile?.uid, assignmentKey]);
  const [isCollapsedState, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const isCollapsed = isCollapsedState && !isMobile;
  const partnerPortal = isPartnerPortalProfile(userProfile);
  useEffect(() => { if (!isMobile || !mobileOpen) return; const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previousOverflow; }; }, [isMobile, mobileOpen]);
  const visibleBaseMenuItems = partnerPortal ? baseMenuItems.filter((item) => item.label === "ĐỐI TÁC") : baseMenuItems;
  const enabledTabs = new Set(filterEnabledTabs(visibleBaseMenuItems.map((item) => item.label), userProfile?.enabledModules));
  const menuItems: MenuItem[] = visibleBaseMenuItems.filter((item) => enabledTabs.has(item.label)).map((item) => { const requiredPerms = MODULE_READ_PERMISSIONS[item.label]; return { ...item, locked: item.label === "BÁN HÀNG" ? !canViewSalesManagement && !hasAssignedPosShift : requiredPerms ? !requiredPerms.some((code) => hasPermission(code)) : false }; });
  if (userProfile?.role === "superadmin" || userProfile?.role === "admin") menuItems.push({ label: "QUẢN TRỊ USER", title: "Quản lý người dùng", icon: Shield, group: "system" });
  menuItems.push({ label: "CÀI ĐẶT", title: "Cài đặt hệ thống", icon: Settings, group: "system" });
  menuItems.push({ label: "HƯỚNG DẪN", title: "Hướng dẫn sử dụng", icon: BookOpen, group: "system" });
  const groups: MenuItem["group"][] = ["main", "operations", "tools", "system"];
  return <>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden" onClick={onMobileClose} aria-hidden="true" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-slate-200/80 bg-white text-slate-800 shadow-sm transition-all duration-300 md:sticky md:top-0 md:z-auto md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${isCollapsed ? "md:w-20" : "md:w-64"}`}>
      <div className="relative h-20 shrink-0 overflow-hidden border-b border-slate-100">
        <button type="button" onClick={() => setActiveTab("TỔNG QUAN")} aria-label="Về tổng quan" className="relative h-full w-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#0866f5]">
          <img src="/logo-akm.png" alt="" aria-hidden="true" className={`pointer-events-none absolute left-[calc(50%-44px)] top-1/2 h-16 w-[220px] -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity duration-200 ${isCollapsed ? "opacity-0" : "opacity-100"}`} />
          <img src="/logo-rutgon.png" alt="" aria-hidden="true" className={`pointer-events-none absolute left-1/2 top-1/2 h-16 w-[60px] -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity duration-200 ${isCollapsed ? "opacity-100" : "opacity-0"}`} />
        </button>
      </div>
      <nav className={`flex-1 select-none space-y-5 overflow-y-auto ${isCollapsed ? "px-2 py-4" : "px-3 py-4"}`}>
        {groups.map((group) => { const items = menuItems.filter((item) => item.group === group); if (!items.length) return null; return <div key={group} className="space-y-1">{!isCollapsed && <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{groupTitles[group]}</p>}{items.map((item) => { const active = activeTab === item.label || (item.label === "BÁN HÀNG" && activeTab === "BÁN LẺ"); return <button key={item.label} type="button" onClick={() => { if (item.locked) return; if (item.label === "BÁN HÀNG") { window.history.pushState(null, "", isPosOperator ? "/pos" : "/ban-le"); window.dispatchEvent(new PopStateEvent("popstate")); } else { setActiveTab(item.label); } onMobileClose(); }} aria-disabled={item.locked} title={isCollapsed ? item.title : undefined} className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${item.locked ? "cursor-not-allowed text-slate-300 opacity-60" : active ? "bg-gradient-to-r from-[#edf3ff] to-[#f5f0ff] font-bold text-[#27346d] ring-1 ring-inset ring-[#dfe3ff]" : "text-slate-600 hover:bg-slate-50 hover:text-sky-700"}`}><span className="flex h-5 w-5 shrink-0 items-center justify-center"><SidebarIcon name={item.label} /></span>{!isCollapsed && <span className="ml-3 truncate">{item.title}</span>}{item.locked && !isCollapsed && <LockKeyhole aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />}</button>; })}</div>; })}
      </nav>
      <div className={`border-t border-slate-100 ${isCollapsed ? "px-2 py-3" : "px-3 py-3"}`}>
        <button type="button" onClick={() => setIsCollapsed((current) => !current)} className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm" title={isCollapsed ? "Mở rộng" : "Thu gọn"}>{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        {!isCollapsed && <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 text-[11px] text-slate-400"><a href={PRIVACY_POLICY_PATH} onClick={(event) => handleInternalNavigation(event, PRIVACY_POLICY_PATH)}>Bảo mật</a><span>•</span><a href={TERMS_OF_SERVICE_PATH} onClick={(event) => handleInternalNavigation(event, TERMS_OF_SERVICE_PATH)}>Điều khoản</a><span>•</span><a href={USER_DATA_DELETION_PATH} onClick={(event) => handleInternalNavigation(event, USER_DATA_DELETION_PATH)}>Xóa dữ liệu</a></div>}
      </div>
    </aside>
  </>;
}
