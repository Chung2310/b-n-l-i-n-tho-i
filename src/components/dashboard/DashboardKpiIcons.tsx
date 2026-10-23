import { useId } from "react";
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconFrame({ children, ...props }: Omit<IconProps, "children"> & { children: (fill: string) => ReactNode }) {
  const id = useId().replace(/:/g, "");
  const fill = `url(#${id}-main)`;
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient id={`${id}-main`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#0866f5" />
          <stop offset="1" stopColor="#7138f5" />
        </linearGradient>
      </defs>
      {children(fill)}
    </svg>
  );
}

export function TodaySalesIcon(props: IconProps) {
  return (
    <IconFrame {...props}>{(fill) => <>
      <rect x="5" y="18" width="6" height="12" rx="2" fill="#80adff" />
      <rect x="15" y="11" width="6" height="19" rx="2" fill={fill} />
      <rect x="25" y="5" width="6" height="25" rx="2" fill="#4b37e9" />
      <path d="M5 32h26" stroke="#4b37e9" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </>}</IconFrame>
  );
}

export function YesterdaySalesIcon(props: IconProps) {
  return (
    <IconFrame {...props}>{(fill) => <>
      <circle cx="18" cy="18" r="13" fill={fill} />
      <circle cx="18" cy="18" r="9" fill="none" stroke="#e4eaff" strokeWidth="2" />
      <path d="M18 11v7l5 3" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="18" r="1.8" fill="#fff" />
      <path d="M5 9h5M26 27h5" stroke="#80adff" strokeWidth="2.5" strokeLinecap="round" />
    </>}</IconFrame>
  );
}

export function StockIcon(props: IconProps) {
  return (
    <IconFrame {...props}>{(fill) => <>
      <path d="M18 3 31 10v16L18 33 5 26V10z" fill={fill} />
      <path d="m5 10 13 7 13-7M18 17v16" fill="none" stroke="#e4eaff" strokeWidth="2" strokeLinejoin="round" />
      <path d="m12 6 13 7" fill="none" stroke="#80adff" strokeWidth="3" />
    </>}</IconFrame>
  );
}

export function WorkforceIcon(props: IconProps) {
  return (
    <IconFrame {...props}>{(fill) => <>
      <circle cx="18" cy="10" r="5" fill={fill} />
      <circle cx="7.5" cy="14" r="3.5" fill="#80adff" />
      <circle cx="28.5" cy="14" r="3.5" fill="#4b37e9" />
      <path d="M8 27c0-5.1 4.1-9 10-9s10 3.9 10 9v2H8z" fill={fill} />
      <path d="M2.5 26c0-3.7 2.2-6.6 5.7-7.3a11.8 11.8 0 0 0-2.5 7.3v2H2.5zm31 0c0-3.7-2.2-6.6-5.7-7.3a11.8 11.8 0 0 1 2.5 7.3v2h3.2z" fill="#4b37e9" />
    </>}</IconFrame>
  );
}

export function MonthlyRevenueIcon(props: IconProps) {
  return (
    <IconFrame {...props}>{(fill) => <>
      <rect x="4" y="6" width="28" height="26" rx="5" fill={fill} />
      <path d="M4 12h28" stroke="#e4eaff" strokeWidth="2" />
      <path d="M11 3v6M25 3v6" stroke="#80adff" strokeWidth="3" strokeLinecap="round" />
      <rect x="9" y="22" width="4" height="6" rx="1" fill="#fff" />
      <rect x="16" y="18" width="4" height="10" rx="1" fill="#fff" />
      <rect x="23" y="15" width="4" height="13" rx="1" fill="#e4eaff" />
    </>}</IconFrame>
  );
}
