import { ArrowUpRight, Sparkles } from "lucide-react";
import type { DashboardActionItems } from "../../types/dashboard";

export function DailyBulletin({ data, error }: { data?: DashboardActionItems["bulletin"]; error: boolean }) {
  const labels = { sales: "Bán hàng", technical: "Kỹ thuật", manager: "Quản lý" };
  return <section aria-label="Bản tin việc cần làm" className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 sm:p-5 dark:border-cyan-900 dark:bg-slate-900">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Sparkles className="h-5 w-5 text-cyan-600" />Bản tin việc cần làm</h2>
      {data && <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">{labels[data.role]}</span>}
    </div>
    {error ? <p role="alert" className="text-sm text-rose-600">Không tải được bản tin. Hệ thống sẽ tự thử lại sau 30 giây.</p> : !data ? <p role="status" className="text-sm text-slate-500">Đang tải việc cần làm của bạn…</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.cards.map(card => <article key={card.title} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-300">{card.title}</h3>
          <p className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">{card.value}</p>
          <p className="mb-4 mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{card.detail}</p>
          {card.href && <a href={card.href} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); window.history.pushState(null, "", card.href); window.dispatchEvent(new PopStateEvent("popstate")); }} className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-cyan-700 dark:text-cyan-400">{card.title === "Hàng chạm đáy an toàn" ? "Nhập hàng từ NCC" : "Xem và xử lý"}<ArrowUpRight className="h-3.5 w-3.5" /></a>}
        </article>)}
      </div>
      {!data.cards.length && <p className="text-sm text-slate-500">Chưa có mục công việc trong các phân hệ bạn được cấp quyền.</p>}
    </>}
  </section>;
}
