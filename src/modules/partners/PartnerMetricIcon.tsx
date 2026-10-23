import type { ReactNode } from "react";

type PartnerMetricIconKind = "partners" | "collaborators" | "organizations" | "balance";

export default function PartnerMetricIcon({ kind }: { kind: PartnerMetricIconKind }) {
  let art: ReactNode;

  switch (kind) {
    case "partners":
      art = <>
        <circle cx="12" cy="10" r="4.5" fill="white" />
        <circle cx="26" cy="11" r="4" fill="white" opacity=".7" />
        <path d="M3 28c0-6 3.5-10 9-10s9 4 9 10v2H3z" fill="white" />
        <path d="M21 20c5-1 12 2 12 9v1H23v-2c0-3-1-6-2-8z" fill="white" opacity=".7" />
      </>;
      break;
    case "collaborators":
      art = <>
        <circle cx="14" cy="10" r="5" fill="white" />
        <path d="M4 29c0-7 4-11 10-11s10 4 10 11v2H4z" fill="white" />
        <circle cx="28" cy="23" r="7" fill="white" opacity=".8" />
        <path d="M28 19v8m-4-4h8" fill="none" stroke="#1eae88" strokeWidth="2.5" strokeLinecap="round" />
      </>;
      break;
    case "organizations":
      art = <>
        <path d="M5 31V11l10-4v24z" fill="white" opacity=".72" />
        <path d="M15 31V4h15v27z" fill="white" />
        <path d="M2 31h31" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 15h2m-2 5h2m-2 5h2m9-15h5m-5 6h5m-5 6h5" fill="none" stroke="#7138f5" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 31v-5h4v5" fill="#7138f5" />
      </>;
      break;
    case "balance":
      art = <>
        <circle cx="12" cy="14" r="8" fill="white" />
        <circle cx="24" cy="23" r="8" fill="white" opacity=".8" />
        <path d="M12 10v8m2-6h-3a2 2 0 0 0 0 4h3m10 3v8m2-6h-3a2 2 0 0 0 0 4h3" fill="none" stroke="#ff8d27" strokeWidth="1.8" strokeLinecap="round" />
      </>;
  }

  return <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">{art}</svg>;
}
