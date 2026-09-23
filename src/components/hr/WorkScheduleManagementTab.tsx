import React, { useState } from "react";
import { CalendarDays, Clock3, Clock, Settings2, CalendarCheck } from "lucide-react";
import { UserProfile, EmployeeNode } from "../../types";
import CalendarTab from "./CalendarTab";
import CompanyWorkCalendarTab from "../settings/CompanyWorkCalendarTab";
import WorkShiftsTab from "../settings/WorkShiftsTab";
import WorkHoursSettingsTab from "./WorkHoursSettingsTab";

export type WorkScheduleSubTab = "attendance" | "shifts" | "holidays" | "hours";

interface WorkScheduleManagementTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  isManager: boolean;
  canManageAttendance?: boolean;
  canEditAttendance?: boolean;
  usersList: UserProfile[];
  employees: EmployeeNode[];
  canApproveLeave?: boolean;
  canManageCalendar?: boolean;
  canManageTimekeeping?: boolean;
  initialSubTab?: WorkScheduleSubTab;
  initialCalendarSubTab?: "schedule" | "attendance" | "requests";
}

export default function WorkScheduleManagementTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  canManageAttendance,
  canEditAttendance,
  usersList,
  employees,
  canApproveLeave,
  canManageCalendar = true,
  canManageTimekeeping = true,
  initialSubTab,
  initialCalendarSubTab,
}: WorkScheduleManagementTabProps) {
  const [activeTab, setActiveTab] = useState<WorkScheduleSubTab>(
    initialSubTab || "attendance"
  );

  const tabs: {
    id: WorkScheduleSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
  }[] = [
    {
      id: "attendance",
      label: "Chấm công & Lịch làm việc",
      icon: CalendarCheck,
      visible: true,
    },
    {
      id: "shifts",
      label: "Ca làm việc",
      icon: Clock3,
      visible: canManageTimekeeping,
    },
    {
      id: "holidays",
      label: "Lịch nghỉ lễ",
      icon: CalendarDays,
      visible: canManageCalendar,
    },
    {
      id: "hours",
      label: "Cấu hình giờ & GPS",
      icon: Clock,
      visible: canManageTimekeeping,
    },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="space-y-6 text-left">
      {/* Tab Navigation Pill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                    : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50/60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 text-[11px] font-semibold text-slate-400">
          <Settings2 className="h-3.5 w-3.5" />
          <span>Quản lý lịch trình, ca kíp & thời gian làm việc</span>
        </div>
      </div>

      {/* Content Rendering */}
      <div>
        {activeTab === "attendance" && (
          <CalendarTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            isManager={isManager}
            canManage={canManageAttendance}
            canEditAttendance={canEditAttendance}
            usersList={usersList}
            employees={employees}
            canApproveLeave={canApproveLeave}
            initialSubTab={initialCalendarSubTab}
          />
        )}
        {activeTab === "shifts" && canManageTimekeeping && <WorkShiftsTab />}
        {activeTab === "holidays" && canManageCalendar && <CompanyWorkCalendarTab />}
        {activeTab === "hours" && canManageTimekeeping && <WorkHoursSettingsTab />}
      </div>
    </div>
  );
}

