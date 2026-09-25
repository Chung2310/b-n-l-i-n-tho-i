import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, LayoutDashboard, MessageSquare, Package, Settings, Shield, Users, BookOpen, ShoppingCart, Landmark, Megaphone, Wrench, ContactRound, Headphones } from "lucide-react";
import { BRAND_LOGO_PATH, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, USER_DATA_DELETION_URL } from "../config/brand";
import type { TabType } from "../types";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useMediaQuery";
import { filterEnabledTabs, MODULE_READ_PERMISSIONS } from "../config/modules";
import { isPartnerPortalProfile } from "../modules/partners/partnerAccess";

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
  { label: "BÁN LẺ", title: "Bán lẻ", icon: ShoppingCart, group: "operations" },
  { label: "TÀI CHÍNH", title: "Tài chính", icon: Landmark, group: "operations" },
  { label: "MARKETING", title: "Marketing tự động", icon: Megaphone, group: "operations" },
  { label: "QUẢN LÝ TÀI NGUYÊN", title: "Quản lý tài nguyên", icon: FolderOpen, group: "tools" },
  { label: "TRÒ CHUYỆN", title: "Trò chuyện nội bộ", icon: MessageSquare, group: "tools" },
];
const groupTitles: Record<MenuItem["group"], string> = { main: "Tổng quan", operations: "Vận hành", tools: "Công cụ", system: "Hệ thống" };

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, hasPermission } = useAuth();
  const [isCollapsedState, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const isCollapsed = isCollapsedState && !isMobile;
  const partnerPortal = isPartnerPortalProfile(userProfile);
  useEffect(() => { if (!isMobile || !mobileOpen) return; const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previousOverflow; }; }, [isMobile, mobileOpen]);
  const visibleBaseMenuItems = partnerPortal ? baseMenuItems.filter((item) => item.label === "ĐỐI TÁC") : baseMenuItems;
  const enabledTabs = new Set(filterEnabledTabs(visibleBaseMenuItems.map((item) => item.label), userProfile?.enabledModules));
  const menuItems: MenuItem[] = visibleBaseMenuItems.filter((item) => enabledTabs.has(item.label)).map((item) => { const requiredPerms = MODULE_READ_PERMISSIONS[item.label]; return { ...item, locked: requiredPerms ? !requiredPerms.some((code) => hasPermission(code)) : false }; });
  if (userProfile?.role === "superadmin" || userProfile?.role === "admin") menuItems.push({ label: "QUẢN TRỊ USER", title: "Quản lý người dùng", icon: Shield, group: "system" });
  menuItems.push({ label: "CÀI ĐẶT", title: "Cài đặt hệ thống", icon: Settings, group: "system" });
  menuItems.push({ label: "HƯỚNG DẪN", title: "Hướng dẫn sử dụng", icon: BookOpen, group: "system" });
  const groups: MenuItem["group"][] = ["main", "operations", "tools", "system"];
  return <>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden" onClick={onMobileClose} aria-hidden="true" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-slate-200/80 bg-white text-slate-800 shadow-sm transition-all duration-300 md:sticky md:top-0 md:z-auto md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${isCollapsed ? "md:w-20" : "md:w-64"}`}>
      <div className={`flex items-center border-b border-slate-100 ${isCollapsed ? "justify-center px-3 py-4" : "px-5 py-4"}`}>
        <div className={`flex min-w-0 items-center ${isCollapsed ? "justify-center" : "gap-3"}`}><img src={BRAND_LOGO_PATH} alt="ANHKHOA MOBILE" onClick={() => setActiveTab("TỔNG QUAN")} className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-sky-100 object-cover shadow-sm" />{!isCollapsed && <div className="min-w-0"><h2 className="truncate text-sm font-bold text-sky-700">ANHKHOA</h2><p className="truncate font-mono text-[10px] tracking-widest text-slate-400">Mobile</p></div>}</div>
      </div>
      <nav className={`flex-1 select-none space-y-5 overflow-y-auto ${isCollapsed ? "px-2 py-4" : "px-3 py-4"}`}>
        {groups.map((group) => { const items = menuItems.filter((item) => item.group === group); if (!items.length) return null; return <div key={group} className="space-y-1">{!isCollapsed && <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{groupTitles[group]}</p>}{items.map((item) => { const Icon = item.icon; const active = activeTab === item.label; return <button key={item.label} type="button" onClick={() => { if (item.locked) return; setActiveTab(item.label); onMobileClose(); }} aria-disabled={item.locked} title={isCollapsed ? item.title : undefined} className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${item.locked ? "cursor-not-allowed text-slate-300 opacity-60" : active ? "bg-sky-50 font-bold text-sky-700" : "text-slate-600 hover:bg-slate-50 hover:text-sky-700"}`}><Icon className="h-4 w-4 shrink-0" />{!isCollapsed && <span className="ml-3 truncate">{item.title}</span>}{item.locked && !isCollapsed && <span className="ml-auto text-[10px]">🔒</span>}</button>; })}</div>; })}
      </nav>
      <div className={`border-t border-slate-100 ${isCollapsed ? "px-2 py-3" : "px-3 py-3"}`}>
        <button type="button" onClick={() => setIsCollapsed((current) => !current)} className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm" title={isCollapsed ? "Mở rộng" : "Thu gọn"}>{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        {!isCollapsed && <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 text-[11px] text-slate-400"><a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">Bảo mật</a><span>•</span><a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer">Điều khoản</a><span>•</span><a href={USER_DATA_DELETION_URL} target="_blank" rel="noreferrer">Xóa dữ liệu</a></div>}
      </div>
    </aside>
  </>;
}
