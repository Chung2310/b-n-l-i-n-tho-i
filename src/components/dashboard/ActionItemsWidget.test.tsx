// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardActionItems } from "../../types/dashboard";
import { ActionItemsWidget } from "./ActionItemsWidget";

describe("ActionItemsWidget contract expiry reminders", () => {
  it("shows the contract message and opens the selected contract", () => {
    const alert: DashboardActionItems["contractExpiryAlerts"][number] = {
      id: "contract-1",
      contractType: "Hợp đồng chính thức",
      employeeId: "employee-1",
      employeeName: "ABC",
      endDate: "2026-09-29T00:00:00.000Z",
      daysRemaining: 7,
      reminderDays: 7,
    };
    const onGoToContract = vi.fn();

    render(
      <ActionItemsWidget
        actionItems={{
          overdueTasks: [],
          pendingApprovals: [],
          lowStockAlerts: [],
          contractExpiryAlerts: [alert],
        }}
        onGoToTasks={vi.fn()}
        onGoToApprovals={vi.fn()}
        onGoToInventory={vi.fn()}
        onGoToContract={onGoToContract}
      />,
    );

    fireEvent.click(screen.getByRole("button", {
      name: /Hợp đồng chính thức của ABC 7 ngày nữa hết hạn/i,
    }));
    expect(onGoToContract).toHaveBeenCalledWith(alert);
  });
});
