import React from "react";

interface DashboardSectionCardProps {
  title: string;
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  children: React.ReactNode;
}

export function DashboardSectionCard({
  title,
  icon: Icon,
  gradientFrom,
  gradientTo,
  children,
}: DashboardSectionCardProps) {
  return (
    <div className="flex flex-col gap-3 bg-white backdrop-blur-md border border-[#d1d5db] rounded-2xl p-4 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-[#d1d5db] pb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}
