import { ArrowUpRight, Sparkles, Banknote, CalendarClock, ClipboardList, Clock, PackageSearch, ShoppingCart, Smartphone, Users, Wrench } from "lucide-react";
import type { DashboardActionItems } from "../../types/dashboard";

export function DailyBulletin({ data, error }: { data?: DashboardActionItems["bulletin"]; error: boolean }) {
  const cardIcons: Record<string, typeof Clock> = {
    "Cham cong hom nay": Clock, "Don treo": ShoppingCart,
    "KPI / doanh so thang": Banknote, "May like-new ve": Smartphone,
    "Phieu sua do": Wrench, "Lich hen tra may": CalendarClock,
    "Thieu linh kien": PackageSearch, "Doanh so hom nay": Banknote,
    "Doanh so hom qua": CalendarClock, "Nhan su hom nay": Users,
    "Hang cham day an toan": PackageSearch,
  };
  const labels = { sales: "Bán hàng", technical: "Kỹ thuật", manager: "Quản lý" };
  return <section aria-label="Bản tin việc cần làm" className="mb-3 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-bold text-slate-900"><Sparkles className="h-5 w-5 text-cyan-600" />Bản tin việc cần làm</h2>
      {data && <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">{labels[data.role]}</span>}
    </div>
    {error ? <p role="alert" className="text-sm font-semibold text-rose-800">Không tải được bản tin. Hệ thống sẽ tự thử lại sau 30 giây.</p> : !data ? <p role="status" className="text-sm text-slate-700">Đang tải việc cần làm của bạn…</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.cards.map(card => { const Icon = cardIcons[card.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0110/g, "D").replace(/\u0111/g, "d")] || ClipboardList; return <article key={card.title} className="flex flex-col rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-800"><Icon aria-hidden="true" className="h-4 w-4" /></span><h3 className="text-xs font-bold text-slate-700">{card.title}</h3></div>
          <p className="mt-2 text-lg font-extrabold text-slate-900">{card.value}</p>
          <p className="mb-2 mt-1 text-xs leading-relaxed text-slate-700">{card.detail}</p>
          {card.href && <a href={card.href} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); window.history.pushState(null, "", card.href); window.dispatchEvent(new PopStateEvent("popstate")); }} className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-cyan-700">{card.title === "Hàng chạm đáy an toàn" ? "Nhập hàng từ NCC" : "Xem và xử lý"}<ArrowUpRight className="h-3.5 w-3.5" /></a>}
        </article>; })}
      </div>
      {!data.cards.length && <p className="text-sm text-slate-700">Chưa có mục công việc trong các phân hệ bạn được cấp quyền.</p>}
    </>}
  </section>;
}
