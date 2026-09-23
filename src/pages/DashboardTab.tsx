/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { dashboardService } from "../services/dashboardService";
import { DashboardSummary, DashboardActionItems } from "../types/dashboard";
import { ModernAnalyticsDashboard } from "../components/dashboard/ModernAnalyticsDashboard";
import { buildContractReviewUrl } from "../utils/contractExpiryNavigation";

import "../components/dashboard/overview.css";

export default function DashboardTab() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const bulletinKey = `${userProfile?.uid}:${userProfile?.role}:${activeBranchId}`;
  const [bulletinResult, setBulletinResult] = useState<{
    key: string;
    data: DashboardActionItems | null;
    error: boolean;
  } | null>(null);

  const actionItems = bulletinResult?.key === bulletinKey ? bulletinResult.data : null;

  // Poll summary data
  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;

    const loadSummary = () => {
      dashboardService
        .getSummary({ filter: "day" })
        .then((data) => {
          if (!cancelled) setSummary(data);
        })
        .catch((err) => {
          console.error("Lỗi tải dữ liệu tổng quan module:", err);
        });
    };

    loadSummary();
    const intervalId = setInterval(loadSummary, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userProfile?.uid, activeBranchId]);

  // Poll action items
  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;

    const loadActionItems = () => {
      dashboardService
        .getActionItems()
        .then((data) => {
          if (!cancelled) setBulletinResult({ key: bulletinKey, data, error: false });
        })
        .catch((err) => {
          if (!cancelled) setBulletinResult({ key: bulletinKey, data: null, error: true });
          console.error("Lỗi tải việc cần xử lý hôm nay:", err);
        });
    };

    loadActionItems();
    const intervalId = setInterval(loadActionItems, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userProfile?.uid, userProfile?.role, activeBranchId]);

  const goToTab = (tab: string, subTab?: string) => {
    let path = "/tong-quan";
    if (tab === "NHÂN SỰ") path = "/nhan-su";
    else if (tab === "KHO & SẢN PHẨM") path = "/kho-san-pham";
    else if (tab === "BÁN LẺ") path = "/ban-le";
    else if (tab === "TÀI CHÍNH") path = "/tai-chinh";

    const url = subTab ? `${path}?sub=${subTab}` : path;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const goToContract = (employeeName: string) => {
    window.history.pushState(null, "", buildContractReviewUrl(employeeName));
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div
      data-overview="true"
      className="w-full min-w-0 max-h-[88vh] overflow-y-auto px-1 pb-10 text-left sm:pr-3"
      id="dashboard_tab_view"
    >
      <ModernAnalyticsDashboard
        summary={summary}
        actionItems={actionItems}
        userDisplayName={userProfile?.displayName}
        onNavigate={goToTab}
        onOpenContract={goToContract}
      />
    </div>
  );
}
