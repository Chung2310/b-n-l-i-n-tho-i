import React from "react";
import { useAuth } from "../../context/AuthContext";
import PartnersPage from "./PartnersPage";
import { SEOHead } from "../../seo/SEOHead";
import { getSeoForTab } from "../../seo/seo-config";

export default function PartnerPortal() {
  const { userProfile, logout } = useAuth();
  React.useEffect(() => {
    const stayInPortal = () => {
      if (window.location.pathname !== "/doi-tac") window.history.replaceState(null, "", "/doi-tac");
    };
    stayInPortal();
    window.addEventListener("popstate", stayInPortal);
    return () => window.removeEventListener("popstate", stayInPortal);
  }, []);
  return (
    <div className="h-dvh overflow-y-auto bg-slate-50 text-slate-900">
      <SEOHead meta={getSeoForTab("ĐỐI TÁC")} />
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div><p className="font-bold">Cổng đối tác</p><p className="text-sm text-slate-500">{userProfile?.displayName}</p></div>
          <button type="button" onClick={() => void logout()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Đăng xuất</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-8"><PartnersPage portalOnly /></main>
    </div>
  );
}
