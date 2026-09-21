import React, { useState } from "react";
import { Sliders, Bell, GraduationCap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CompanySmtpSettingsTab from "./CompanySmtpSettingsTab";
import CompanyPaymentSettingsTab from "./CompanyPaymentSettingsTab";

export default function ErpConfigTab() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "companyModules" >("general");

  const canManageSmtp = hasPermission("settings:manage");
  const canManageCompanyModules = canManageSmtp;

  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Tab bar nội bộ của Cấu hình ERP */}
      {canManageCompanyModules && (
        <div className="flex gap-2 border-b border-gray-100 pb-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-1.5 shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === "general" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Cấu hình chung
          </button>
          {canManageCompanyModules && (
            <button type="button" onClick={() => setActiveTab("companyModules")}
              className={`flex items-center gap-1.5 shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${activeTab === "companyModules" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <GraduationCap className="h-3.5 w-3.5" />
              Thanh toán & Email
            </button>
          )}
        </div>
      )}


      {/* Preferences Section */}
      {activeTab === "companyModules" && canManageCompanyModules && (
        <div className="space-y-5">
          {hasPermission("settings:manage") && <CompanyPaymentSettingsTab />}
          {canManageSmtp && <CompanySmtpSettingsTab />}
        </div>
      )}
      {activeTab === "general" && (
      <>
      <div>
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
          <Sliders className="h-5 w-5 text-purple-500" />
          Cài đặt hiển thị & Thông báo
        </h3>

        <div className="space-y-4">
          {/* Dark Mode toggle has been moved to the global top Header bar */}

          {/* Email notification toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-gray-800">Nhận thông báo qua Email</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Nhận các báo cáo tóm tắt hàng ngày qua email đăng ký.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">

              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>
      </div>



      </>
      )}
    </div>
  );
}
