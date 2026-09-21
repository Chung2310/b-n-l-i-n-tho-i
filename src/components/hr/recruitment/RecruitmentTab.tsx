import React, { useState, useRef } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
} from "lucide-react";
import RecruitmentJobsView from "./RecruitmentJobsView";
import RecruitmentApplicantsView from "./RecruitmentApplicantsView";
import RecruitmentInterviewsView from "./RecruitmentInterviewsWorkspace";

type View = "jobs" | "applicants" | "interviews";

const tabs = [
  { id: "jobs" as const, label: "Tin tuyển dụng", icon: BriefcaseBusiness },
  { id: "applicants" as const, label: "Ứng viên", icon: Users },
  { id: "interviews" as const, label: "Phỏng vấn", icon: CalendarClock },
];

export default function RecruitmentTab({
  canManage = false,
}: {
  canManage?: boolean;
}) {
  const [view, setView] = useState<View>("jobs");
  const subTabsRef = useRef<HTMLDivElement>(null);

  const scrollSubTabs = (direction: "left" | "right") => {
    if (subTabsRef.current) {
      const scrollAmount = 140;
      subTabsRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-slate-50/60"
      aria-label="Quản lý tuyển dụng"
    >
      {/* Modern Subtabs Navigation Bar */}
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-200/80 bg-white px-3 py-2 sm:px-6 shadow-2xs">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            aria-label="Cuộn tab tuyển dụng sang trái"
            onClick={() => scrollSubTabs("left")}
            className="flex h-8 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:hidden cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={subTabsRef}
            className="flex min-w-0 max-w-full flex-1 gap-1.5 overflow-x-auto scrollbar-none select-none py-0.5"
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${active
                    ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-sm shadow-cyan-600/20 ring-1 ring-cyan-600/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-cyan-700"
                    }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Cuộn tab tuyển dụng sang phải"
            onClick={() => scrollSubTabs("right")}
            className="flex h-8 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:hidden cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "jobs" && <RecruitmentJobsView canManage={canManage} />}
        {view === "applicants" && <RecruitmentApplicantsView canManage={canManage} />}
        {view === "interviews" && <RecruitmentInterviewsView canManage={canManage} />}
      </div>
    </section>
  );
}

