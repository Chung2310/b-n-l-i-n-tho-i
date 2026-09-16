import type { TabType } from "../types";

export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "customer", "retail", "repair", "finance", "marketing"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const DEFAULT_MODULE_KEYS = MODULE_KEYS.filter((key) => key !== "retail" && key !== "finance" && key !== "marketing") as Exclude<ModuleKey, "retail" | "finance" | "marketing">[];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "Nhân sự", inventory: "Kho & Sản phẩm", resource: "Quản lý tài nguyên", chat: "Trò chuyện",
  customer: "Khách hàng", retail: "Bán lẻ & POS", repair: "Sửa chữa & bảo hành", finance: "Tài chính", marketing: "Marketing tự động",
};

export const MODULE_TAB_MAP: Record<ModuleKey, TabType> = {
  hr: "NHÂN SỰ", inventory: "KHO & SẢN PHẨM", resource: "QUẢN LÝ TÀI NGUYÊN", chat: "TRÒ CHUYỆN",
  customer: "QUẢN LÝ KHÁCH HÀNG", retail: "BÁN LẺ", repair: "SỬA CHỮA & BẢO HÀNH", finance: "TÀI CHÍNH", marketing: "MARKETING",
};

export const TAB_MODULE_MAP: Partial<Record<TabType, ModuleKey>> = {
  "NHÂN SỰ": "hr", "KHO & SẢN PHẨM": "inventory", "SỬA CHỮA & BẢO HÀNH": "repair", "QUẢN LÝ TÀI NGUYÊN": "resource",
  "TRÒ CHUYỆN": "chat", "QUẢN LÝ KHÁCH HÀNG": "customer", "BÁN LẺ": "retail", "TÀI CHÍNH": "finance", "MARKETING": "marketing",
};

export const MODULE_OPTIONS = (Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => ({ key, label: MODULE_LABELS[key], moduleKeys: [key] as readonly ModuleKey[] })) as ReadonlyArray<{ key: string; label: string; moduleKeys: readonly ModuleKey[] }>;

export const MODULE_READ_PERMISSIONS: Partial<Record<TabType, string[]>> = {
  "ĐỐI TÁC": ["partner:read", "partner:manage", "partner-self:read", "partner-self:manage"],
  "TỔNG QUAN": ["dashboard:read"], "NHÂN SỰ": ["hr:read", "access:read", "work:read", "timekeeping:read"], "KHO & SẢN PHẨM": ["inventory:read"],
  "QUẢN LÝ KHÁCH HÀNG": ["customer:read", "customer:manage"], "SỬA CHỮA & BẢO HÀNH": ["repair:read", "repair:manage"], "QUẢN LÝ TÀI NGUYÊN": ["resource:read"],
  "BÁN LẺ": ["retail:read", "retail:manage"], "TÀI CHÍNH": ["finance-wallet:read", "finance-wallet:manage", "finance-receivable:read", "finance-receivable:manage", "asset:read", "asset:manage"],
  "TRÒ CHUYỆN": ["chat:read"], "MARKETING": ["marketing:read", "marketing:manage"],
};

export const HIDDEN_TABS = new Set<TabType>();
export function isTabHidden(tab: TabType): boolean { return HIDDEN_TABS.has(tab); }
export const HIDDEN_SETTINGS_SUBTABS = new Set<string>(["personal-integrations", "company-integrations"]);
export function isSettingsSubTabHidden(value: string): boolean { return HIDDEN_SETTINGS_SUBTABS.has(value); }
export const HIDE_AI_AUTO_REPLY = true;

export function isModuleEnabled(enabledModules: string[] | undefined, key: ModuleKey): boolean {
  if (key === "retail" || key === "finance") return Boolean(enabledModules?.includes(key));
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}
export function filterEnabledTabs(tabs: TabType[], enabledModules: string[] | undefined): TabType[] {
  return tabs.filter((tab) => { const key = TAB_MODULE_MAP[tab]; return !key || isModuleEnabled(enabledModules, key); });
}
export function resolveEnabledTab(tab: TabType, enabledModules: string[] | undefined): TabType {
  const key = TAB_MODULE_MAP[tab];
  return key && !isModuleEnabled(enabledModules, key) ? "TỔNG QUAN" : tab;
}