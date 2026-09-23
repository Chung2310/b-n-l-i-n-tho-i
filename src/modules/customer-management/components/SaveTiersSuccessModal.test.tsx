// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(cleanup);
import SaveTiersSuccessModal from "./SaveTiersSuccessModal";
import type { CustomerSettings } from "../types";

const mockSettings: CustomerSettings = {
  companyCode: "IGEN",
  tierEvaluationMetric: "gross_profit",
  evaluationWindow: "rolling12Months",
  customerTiers: [
    { code: "bronze", name: "Hạng Đồng", minSpend: 0, minGrossProfit: 0, pointMultiplier: 1 },
    { code: "silver", name: "Hạng Bạc", minSpend: 10000000, minGrossProfit: 5000000, pointMultiplier: 1.2 },
    { code: "gold", name: "Hạng Vàng", minSpend: 30000000, minGrossProfit: 15000000, pointMultiplier: 1.5 },
  ],
  pointsPolicy: {
    enabled: true,
    grossProfitPerPoint: 10000,
    pointRedeemValue: 1000,
    maxRedeemPercent: 50,
    minOrderTotalForRedeem: 50000,
    allowRepairRedeem: true,
    allowRetailRedeem: true,
  },
};

describe("SaveTiersSuccessModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SaveTiersSuccessModal isOpen={false} onClose={vi.fn()} settings={mockSettings} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders configuration details when open", () => {
    render(
      <SaveTiersSuccessModal isOpen={true} onClose={vi.fn()} settings={mockSettings} />
    );

    expect(screen.getByText("Đã lưu cấu hình phân hạng!")).toBeTruthy();
    expect(screen.getByText("3 bậc")).toBeTruthy();
    expect(screen.getByText("Hạng Đồng")).toBeTruthy();
    expect(screen.getByText("Hạng Bạc")).toBeTruthy();
    expect(screen.getByText("Hạng Vàng")).toBeTruthy();
    expect(screen.getByText("Đang bật")).toBeTruthy();
  });

  it("calls onClose when clicking close button or primary button", () => {
    const onClose = vi.fn();
    render(
      <SaveTiersSuccessModal isOpen={true} onClose={onClose} settings={mockSettings} />
    );

    const doneButton = screen.getByRole("button", { name: /Đã hiểu & Hoàn tất/i });
    fireEvent.click(doneButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByRole("button", { name: "Đóng popup" });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on Escape key press", () => {
    const onClose = vi.fn();
    render(
      <SaveTiersSuccessModal isOpen={true} onClose={onClose} settings={mockSettings} />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
