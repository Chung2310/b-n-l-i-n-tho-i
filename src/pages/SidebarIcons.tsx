import { useId } from "react";
import type { ReactNode } from "react";
import type { TabType } from "../types";

/** Filled, two-tone pictograms drawn for the ERP navigation. */
export default function SidebarIcon({ name, active = false }: { name: TabType; active?: boolean }) {
  const id = useId().replace(/:/g, "");
  const fill = `url(#${id}-main)`;
  const detail = active ? "#fff" : "#4b37e9";
  const light = active ? "#fff" : "#80adff";
  let art: ReactNode;

  switch (name) {
    case "TỔNG QUAN":
      art = <><rect x="5" y="18" width="6" height="12" rx="2" fill={light} /><rect x="15" y="11" width="6" height="19" rx="2" fill={fill} /><rect x="25" y="5" width="6" height="25" rx="2" fill={detail} /><path d="M5 32h26" stroke={detail} strokeWidth="2" strokeLinecap="round" opacity=".55" /></>;
      break;
    case "NHÂN SỰ":
      art = <><circle cx="18" cy="10" r="5" fill={fill} /><circle cx="7.5" cy="14" r="3.5" fill={light} /><circle cx="28.5" cy="14" r="3.5" fill={detail} /><path d="M8 27c0-5.1 4.1-9 10-9s10 3.9 10 9v2H8z" fill={fill} /><path d="M2.5 26c0-3.7 2.2-6.6 5.7-7.3a11.8 11.8 0 0 0-2.5 7.3v2H2.5zm31 0c0-3.7-2.2-6.6-5.7-7.3a11.8 11.8 0 0 1 2.5 7.3v2h3.2z" fill={detail} /></>;
      break;
    case "KHO & SẢN PHẨM":
      art = <><path d="M18 3 31 10v16L18 33 5 26V10z" fill={fill} /><path d="m5 10 13 7 13-7M18 17v16" fill="none" stroke={active ? "#fff" : "#e4eaff"} strokeWidth="2" strokeLinejoin="round" /><path d="m12 6 13 7" fill="none" stroke={light} strokeWidth="3" /></>;
      break;
    case "BÁN HÀNG":
    case "BÁN LẺ":
      art = <><path d="M4 6h4l3.3 17h16.5l3-12H10" fill="none" stroke={fill} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 14h16l-1.6 6.5H13.3z" fill={detail} opacity=".85" /><circle cx="14" cy="29" r="2.7" fill={fill} /><circle cx="26" cy="29" r="2.7" fill={detail} /></>;
      break;
    case "QUẢN LÝ KHÁCH HÀNG":
      art = <><circle cx="18" cy="10" r="6" fill={fill} /><path d="M6 29c0-7 4.8-11 12-11s12 4 12 11v2H6z" fill={fill} /><circle cx="27.5" cy="18.5" r="5" fill={detail} /><path d="M25.5 18.5h4m-2-2v4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" /></>;
      break;
    case "TÀI CHÍNH":
      art = <><path d="M9 3h14l6 6v23H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill={fill} /><path d="M23 3v6h6" fill={light} /><path d="M12 16h11M12 21h9M12 26h11" stroke="#fff" strokeWidth="2" strokeLinecap="round" /><path d="M27 19v9m-3-6h6" stroke={detail} strokeWidth="2.2" strokeLinecap="round" /></>;
      break;
    case "MARKETING":
      art = <><path d="M4 16v6a3 3 0 0 0 3 3h4l3 6h4l-2.5-8L29 29V9L11 16H7a3 3 0 0 0-3 3z" fill={fill} /><path d="M30 14c2 1 2 7 0 9M33 11c3 3 3 12 0 15" fill="none" stroke={detail} strokeWidth="2" strokeLinecap="round" /><path d="M7 17v7" stroke={light} strokeWidth="2" /></>;
      break;
    case "SỬA CHỮA & BẢO HÀNH":
      art = <><path d="M27 5a9 9 0 0 0-10 11L6 27a3 3 0 0 0 4 4l11-11A9 9 0 0 0 32 10l-5 5-6-1-1-5z" fill={fill} /><circle cx="9" cy="28" r="1.5" fill="#fff" /><path d="m23 8 5 5" stroke={detail} strokeWidth="2" strokeLinecap="round" /></>;
      break;
    case "CSKH":
      art = <><path d="M6 19a12 12 0 0 1 24 0" fill="none" stroke={fill} strokeWidth="4" strokeLinecap="round" /><rect x="3" y="18" width="6" height="11" rx="3" fill={detail} /><rect x="27" y="18" width="6" height="11" rx="3" fill={fill} /><path d="M29 28c-2 4-6 5-11 5" fill="none" stroke={detail} strokeWidth="2.5" strokeLinecap="round" /><rect x="14" y="30" width="7" height="4" rx="2" fill={fill} /></>;
      break;
    case "ĐỐI TÁC":
      art = <><circle cx="11" cy="10" r="5" fill={fill} /><circle cx="26" cy="10" r="5" fill={detail} /><path d="M2 29c0-7 3.5-11 9-11s9 4 9 11v2H2zm14 0c0-7 3.5-11 10-11 5 0 8 4 8 11v2H16z" fill={fill} opacity=".9" /><path d="M17 22h3" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></>;
      break;
    case "QUẢN LÝ TÀI NGUYÊN":
      art = <><path d="M3 11a3 3 0 0 1 3-3h9l3 4h12a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill={fill} /><path d="M4 18h28l-3 12H7z" fill={detail} /><path d="M10 23h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></>;
      break;
    case "TRÒ CHUYỆN":
      art = <><path d="M4 7h23a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H14l-8 5v-5H4a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4z" fill={fill} /><circle cx="9" cy="18" r="2" fill="#fff" /><circle cx="17" cy="18" r="2" fill="#fff" /><circle cx="25" cy="18" r="2" fill="#fff" /></>;
      break;
    case "QUẢN TRỊ USER":
      art = <><path d="M18 2 31 7v10c0 8-4.7 13.3-13 17C9.7 30.3 5 25 5 17V7z" fill={fill} /><path d="m12 18 4 4 8-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="M18 3v8" stroke={light} strokeWidth="2" /></>;
      break;
    case "CÀI ĐẶT":
      art = <><path d="m15 2 1 4a12 12 0 0 1 4 0l1-4 5 2-1 4a12 12 0 0 1 3 3l4-1 2 5-4 2a12 12 0 0 1 0 4l4 2-2 5-4-1a12 12 0 0 1-3 3l1 4-5 2-1-4a12 12 0 0 1-4 0l-1 4-5-2 1-4a12 12 0 0 1-3-3l-4 1-2-5 4-2a12 12 0 0 1 0-4l-4-2 2-5 4 1a12 12 0 0 1 3-3l-1-4z" fill={fill} /><circle cx="18" cy="18" r="6" fill="#fff" /><circle cx="18" cy="18" r="3.2" fill={detail} /></>;
      break;
    case "HƯỚNG DẪN":
      art = <><path d="M18 7C13 4 8 4 3 6v23c5-2 10-2 15 1 5-3 10-3 15-1V6c-5-2-10-2-15 1z" fill={fill} /><path d="M18 7v23" stroke="#fff" strokeWidth="2" /><path d="M7 12h7M7 17h7M22 12h7M22 17h7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></>;
      break;
    default:
      art = <circle cx="18" cy="18" r="13" fill={fill} />;
  }

  return <svg viewBox="0 0 36 36" width="20" height="20" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-main`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={active ? "#fff" : "#0866f5"} /><stop offset="1" stopColor={active ? "#fff" : "#7138f5"} /></linearGradient></defs>
    {art}
  </svg>;
}
