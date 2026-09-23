// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardSummary, DashboardActionItems } from "../../types/dashboard";
import { ModernAnalyticsDashboard } from "./ModernAnalyticsDashboard";

vi.mock("../../modules/retail/hooks/useRetailScope", () => ({
  useRetailScope: () => ({ scope: { companyCode: "TEST", branchId: "B1" } }),
}));

vi.mock("../../services/analyticsService", () => ({
  analyticsService: {
    getRevenue: vi.fn().mockResolvedValue({
      total: 17000000,
      series: [
        { bucket: "2026-09-01", amount: 5000000 },
        { bucket: "2026-09-15", amount: 12000000 },
      ],
    }),
  },
}));

vi.mock("../../services/dashboardService", () => ({
  dashboardService: {
    getBestSellingProducts: vi.fn().mockResolvedValue({
      products: [
        { productId: "1", sku: "SKU1", productName: "Product 1", netSales: 5000000, netQuantity: 1 },
      ],
    }),
  },
}));

vi.mock("../../services/inventoryReceivingService", () => ({
  inventoryReceivingService: {
    listBalances: vi.fn().mockResolvedValue([
      { _id: "b1", productId: "p1", quantity: 150 },
      { _id: "b2", productId: "p2", quantity: 50 },
    ]),
  },
}));

afterEach(cleanup);

describe("ModernAnalyticsDashboard", () => {
  const mockSummary = {
    range: { start: "2026-09-01", end: "2026-09-30", filter: "month" },
    projects: {
      activeProjects: 5,
      tasks: { todo: 10, doing: 5, done: 20, total: 35 },
      overdueTasks: 2,
    },
    timekeeping: {
      checkedInToday: 5,
      lateToday: 1,
      totalEmployees: 8,
      date: "2026-09-23",
      onApprovedLeaveToday: 1,
      absentWithoutLeave: 2,
    },
    chat: { unreadMessages: 0, roomCount: 3 },
    resources: { fileCount: 10, recentUploads: 2, totalSize: 1024 },
    training: { totalCourses: 2, ongoingCourses: 1, enrollments: { notStarted: 0, inProgress: 1, completed: 1, total: 2 } },
  };

  const mockActionItems = {
    bulletin: {
      role: "manager" as const,
      cards: [
        { title: "Doanh số hôm nay", value: "0 đ", detail: "", href: "/ban-le" },
        { title: "Doanh số hôm qua", value: "17.000.000 đ", detail: "", href: "/ban-le" },
        { title: "Nhân sự hôm nay", value: "0 / 7 đã vào ca", detail: "", href: "/nhan-su?sub=lich" },
        { title: "Hàng chạm đáy an toàn", value: "Tồn kho trong ngưỡng", detail: "", href: "/kho-san-pham" },
      ],
      updatedAt: "2026-09-23T00:00:00.000Z",
    },
    overdueTasks: [{ id: "t1", title: "Task 1", dueDate: "2026-09-20" }],
    pendingApprovals: [{ id: "p1", type: "leave", employeeName: "Nguyen Van A", since: "2026-09-22" }],
    lowStockAlerts: [{ id: "s1", name: "iPhone 15", sku: "IP15", stock: 1, minStockAlert: 5 }],
    contractExpiryAlerts: [{ id: "c1", contractType: "HĐ Lao Động", employeeId: "e1", employeeName: "Tran Van B", endDate: "2026-10-01", daysRemaining: 7, reminderDays: 7 }],
  };

  it("renders all key sections with Vietnamese labels and KPI -> Title layout", async () => {
    const onNavigate = vi.fn();

    render(
      <ModernAnalyticsDashboard
        summary={mockSummary as unknown as DashboardSummary}
        actionItems={mockActionItems as unknown as DashboardActionItems}
        userDisplayName="Admin User"
        onNavigate={onNavigate}
      />
    );

    // Header elements (No duplicate branch badge, dynamic greeting, no Chào mừng trở lại)
    expect(screen.getByText("Tổng quan")).toBeTruthy();
    expect(screen.getByText(/Admin User/)).toBeTruthy();
    expect(screen.queryByText(/Chào mừng trở lại/)).toBeNull();
    expect(screen.queryByText("Chi nhánh Hà Nội")).toBeNull();
    expect(screen.getByText("Tùy chỉnh")).toBeTruthy();

    // Row 1: Top 5 KPI Cards (Content/Số -> Title, Vietnamese)
    expect(screen.getByText("Doanh số hôm nay")).toBeTruthy();
    expect(screen.getByText("Doanh số hôm qua")).toBeTruthy();
    expect(screen.getByText("Sản phẩm tồn kho")).toBeTruthy();
    expect(screen.getByText("Nhân sự hôm nay")).toBeTruthy();
    expect(screen.getByText("Doanh thu tháng")).toBeTruthy();

    // Content/Số values
    expect(screen.getByText("0 đ")).toBeTruthy();
    expect(screen.getByText("17.000.000 đ")).toBeTruthy();
    expect(screen.getByText("0 / 7")).toBeTruthy();
    expect(await screen.findByText("200")).toBeTruthy();

    // Row 2: Middle Section
    expect(screen.getByText("Tổng quan doanh thu")).toBeTruthy();
    expect(screen.getByText("Sản phẩm bán chạy")).toBeTruthy();
    expect(screen.getByText("Cảnh báo & Nhắc việc")).toBeTruthy();
    expect(screen.getByText("1 việc quá hạn")).toBeTruthy();
    expect(screen.getByText("1 hợp đồng sắp hết hạn")).toBeTruthy();
    expect(screen.getByText("1 phiếu chờ duyệt")).toBeTruthy();
    expect(screen.getByText("1 mã chạm đáy")).toBeTruthy();

    // Row 3: Bottom Tables
    expect(screen.getByText("Hợp đồng & Cảnh báo đến hạn")).toBeTruthy();
    expect(screen.getAllByText("Tran Van B").length).toBe(2);
    expect(screen.getByText("Tiến độ công việc")).toBeTruthy();
    expect(screen.getByText("Tổng hợp chấm công")).toBeTruthy();
    expect(screen.getByText("Có mặt")).toBeTruthy();
    expect(screen.getByText("Đi muộn")).toBeTruthy();
  });

  it("formats numbers to Vietnamese compact correctly (1000000 => 1 triệu, 1200000 => 1,2 triệu)", async () => {
    const { formatVietnameseCompactAmount, parseVnCurrency } = await import("./ModernAnalyticsDashboard");
    expect(formatVietnameseCompactAmount(1000000)).toBe("1 triệu");
    expect(formatVietnameseCompactAmount(1200000)).toBe("1,2 triệu");
    expect(formatVietnameseCompactAmount(5000000)).toBe("5 triệu");
    expect(formatVietnameseCompactAmount(2000000)).toBe("2 triệu");
    expect(formatVietnameseCompactAmount(500000)).toBe("500 nghìn");
    expect(formatVietnameseCompactAmount(1500000000)).toBe("1,5 tỷ");
    expect(formatVietnameseCompactAmount(0)).toBe("0 ₫");

    expect(parseVnCurrency("17.000.000 đ")).toBe(17000000);
    expect(parseVnCurrency("0 đ")).toBe(0);
    expect(parseVnCurrency(5000000)).toBe(5000000);
  });

  it("navigates to contracts when clicking contract alert or contract table", async () => {
    const onNavigate = vi.fn();
    const onOpenContract = vi.fn();
    const { fireEvent } = await import("@testing-library/react");

    render(
      <ModernAnalyticsDashboard
        summary={mockSummary as unknown as DashboardSummary}
        actionItems={mockActionItems as unknown as DashboardActionItems}
        userDisplayName="Admin User"
        onNavigate={onNavigate}
        onOpenContract={onOpenContract}
      />
    );

    // Click orange contract alert
    fireEvent.click(screen.getByText("1 hợp đồng sắp hết hạn"));
    expect(onOpenContract).toHaveBeenCalledWith("Tran Van B");

    // Click Hợp đồng & Cảnh báo đến hạn header
    fireEvent.click(screen.getByText("Hợp đồng & Cảnh báo đến hạn"));
    expect(onNavigate).toHaveBeenCalledWith("NHÂN SỰ", "hop-dong");
  });

  it("compares real totals from two API requests instead of placeholder previousTotal", async () => {
    const { analyticsService } = await import("../../services/analyticsService");
    const { revenueComparisonRange } = await import("./revenueComparison");
    const range = revenueComparisonRange("month");
    vi.mocked(analyticsService.getRevenue).mockImplementation(async params => ({
      total: params.from === range.previousFrom ? 10000000 : 15000000, previousTotal: 0, growthPct: null, series: [],
    }) as any);
    render(<ModernAnalyticsDashboard summary={mockSummary as any} actionItems={mockActionItems as any} onNavigate={vi.fn()} onOpenContract={vi.fn()}/>);
    expect(await screen.findByText(/\+50% tăng/)).toBeTruthy();
    expect(analyticsService.getRevenue).toHaveBeenCalledWith(expect.objectContaining({from:range.previousFrom,to:range.previousTo}));
  });
  it("does not invent 100 percent growth when previous revenue is zero", async () => {
    const { analyticsService } = await import("../../services/analyticsService");
    const { revenueComparisonRange } = await import("./revenueComparison");
    const range = revenueComparisonRange("month");
    vi.mocked(analyticsService.getRevenue).mockImplementation(async params => ({total:params.from===range.previousFrom?0:15000000,series:[]}) as any);
    render(<ModernAnalyticsDashboard summary={mockSummary as any} actionItems={mockActionItems as any} onNavigate={vi.fn()} onOpenContract={vi.fn()}/>);
    expect(await screen.findByText("Chưa có cơ sở so sánh")).toBeTruthy();
  });
});

