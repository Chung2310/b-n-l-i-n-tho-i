// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MarketingAutomationModal from "./MarketingAutomationModal";
import { HeartHandshake } from "lucide-react";

afterEach(cleanup);

describe("MarketingAutomationModal", () => {
  const dummyAutomation = {
    type: "thank_you" as const,
    title: "Cảm ơn sau khi xuất hoá đơn",
    description: "Gửi ngay khi đơn bán hàng được xác nhận và xuất hoá đơn.",
    icon: HeartHandshake,
  };

  const dummyConfig = {
    enabled: true,
    channels: ["email"] as any,
    subject: "Cảm ơn bạn đã mua hàng",
    html: "<p>Nội dung mẫu</p>",
  };

  const dummySettings: any = {
    sendTime: "09:00",
    timeZone: "Asia/Ho_Chi_Minh",
    attachInvoicePdf: true,
    remarketingInactiveDays: 30,
    remarketingCooldownDays: 14,
    thank_you: dummyConfig,
  };

  it("renders modal with automation details and calls onClose on close click", () => {
    const onClose = vi.fn();
    const onPatch = vi.fn();

    render(
      <MarketingAutomationModal
        automation={dummyAutomation}
        config={dummyConfig}
        settings={dummySettings}
        canManage={true}
        channels={[
          { channel: "email" as any, label: "Email", implemented: true, configured: true },
        ]}
        dirty={false}
        saving={false}
        onPatch={onPatch}
        onUpdateSettings={vi.fn()}
        onSendTest={vi.fn()}
        onRunScan={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("Cảm ơn sau khi xuất hoá đơn")).toBeTruthy();
    expect(screen.getByText("Gửi kèm hoá đơn PDF khi gửi qua Email")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalled();
  });
});
