import type { SubTabRouteMap } from "../hooks/useSubTabRouter";
import type {
  TabType,
  HRSubTabType,
  InventorySubTabType,
  ResourceSubTabType,
} from "../types";

export type SettingsSubTabType =
  | "profile"
  | "security"
  | "erp"
  | "face-recognition"
  | "branches";

// Nguồn slug ?sub= duy nhất cho toàn app — các trang và điều hướng toàn cục
// (handleSearchNavigation) đều dùng chung để không bao giờ lệch nhau.
export const HR_SUB_TAB_ROUTES: SubTabRouteMap<HRSubTabType> = [
  { slug: "chi-nhanh", value: "CHI NHÁNH" },
  { slug: "ca-va-lich", value: "CA & LỊCH LÀM VIỆC" },
  { slug: "nghi-le", value: "CA & LỊCH LÀM VIỆC" },
  { slug: "ca-lam-viec", value: "CA & LỊCH LÀM VIỆC" },
  { slug: "gio-lam-viec", value: "CA & LỊCH LÀM VIỆC" },
  { slug: "tuyen-dung", value: "TUYỂN DỤNG" },
  { slug: "email-chuc-mung", value: "EMAIL CHÚC MỪNG" as HRSubTabType },
  { slug: "so-do", value: "SƠ ĐỒ TỔ CHỨC" },
  { slug: "phong-ban", value: "PHÒNG BAN" },
  { slug: "kanban", value: "Giao Việc" },
  { slug: "dao-tao", value: "ĐÀO TẠO" },
  { slug: "quy-trinh", value: "QUY TRÌNH" },
  { slug: "lich", value: "LỊCH" },
  { slug: "don-tu", value: "LỊCH" },
  { slug: "cham-cong", value: "LỊCH" },
  { slug: "lich-su-cham-cong", value: "LỊCH" },
  { slug: "payroll", value: "PAYROLL" },
  { slug: "hop-dong", value: "HỢP ĐỒNG" },
];

export const INVENTORY_SUB_TAB_ROUTES: SubTabRouteMap<InventorySubTabType> = [
  { slug: "bao-hanh", value: "BẢO HÀNH" as InventorySubTabType },
  { slug: "sua-chua", value: "SỬA CHỮA" as InventorySubTabType },
  { slug: "san-pham", value: "SẢN PHẨM" },
  { slug: "kho-hang", value: "KHO HÀNG" },
  { slug: "nhap-hang", value: "NHẬP HÀNG" },
  { slug: "xuat-hang", value: "XUẤT HÀNG" },
  { slug: "giao-dich-kho", value: "GIAO DỊCH KHO" },
  { slug: "du-bao", value: "DỰ BÁO" },
  { slug: "imei-serial", value: "IMEI / SERIAL" },
];

export const RESOURCE_SUB_TAB_ROUTES: SubTabRouteMap<ResourceSubTabType> = [
  { slug: "tai-lieu", value: "TÀI LIỆU KHÁC" },
];

export const SETTINGS_SUB_TAB_ROUTES: SubTabRouteMap<SettingsSubTabType> = [
  { slug: "ho-so", value: "profile" },
  { slug: "bao-mat", value: "security" },
  { slug: "cau-hinh", value: "erp" },
  { slug: "nhan-dien-khuon-mat", value: "face-recognition" },
  { slug: "chi-nhanh", value: "branches" },
];

export type RepairSubTabType = "repair" | "warranty" | "reports";

export const REPAIR_SUB_TAB_ROUTES: SubTabRouteMap<RepairSubTabType> = [
  { slug: "sua-chua", value: "repair" },
  { slug: "phieu-sua-chua", value: "repair" },
  { slug: "bao-hanh", value: "warranty" },
  { slug: "tra-cuu-bao-hanh", value: "warranty" },
  { slug: "bao-cao", value: "reports" },
  { slug: "bao-cao-ktv", value: "reports" },
];

export type CustomerSubTabType = "list" | "settings";

export const CUSTOMER_SUB_TAB_ROUTES: SubTabRouteMap<CustomerSubTabType> = [
  { slug: "danh-sach", value: "list" },
  { slug: "khach-hang", value: "list" },
  { slug: "cau-hinh", value: "settings" },
  { slug: "phan-hang", value: "settings" },
];

const SUB_TAB_ROUTES_BY_TAB: Partial<Record<TabType, SubTabRouteMap<string>>> = {
  "NHÂN SỰ": HR_SUB_TAB_ROUTES,
  "KHO & SẢN PHẨM": INVENTORY_SUB_TAB_ROUTES,
  "QUẢN LÝ TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "CÀI ĐẶT": SETTINGS_SUB_TAB_ROUTES,
  "SỬA CHỮA & BẢO HÀNH": REPAIR_SUB_TAB_ROUTES,
  "QUẢN LÝ KHÁCH HÀNG": CUSTOMER_SUB_TAB_ROUTES,
};

/** Tra slug ?sub= cho một sub-tab; trả "" nếu tab/sub-tab không có slug. */
export function subTabToSlug(tab: TabType, subTab: string): string {
  const routes = SUB_TAB_ROUTES_BY_TAB[tab];
  return routes?.find((entry) => entry.value === subTab)?.slug || "";
}

