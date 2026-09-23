// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricBar } from "./MetricBar";

afterEach(() => {
  cleanup();
});

describe("MetricBar", () => {
  it("renders metric items with label, value, unit, and subtext", () => {
    render(
      <MetricBar
        items={[
          {
            label: "Quy mô thiết bị",
            value: 24,
            unit: "máy",
            subtext: "Phân chia trên 1 dòng máy",
          },
          {
            label: "Trong kho khả dụng",
            value: 21,
            unit: "máy",
            subtext: "Sẵn sàng xuất bán",
            tone: "emerald",
            isActive: true,
          },
        ]}
      />
    );

    expect(screen.getByText("Quy mô thiết bị")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText("Phân chia trên 1 dòng máy")).toBeTruthy();
    expect(screen.getByText("Trong kho khả dụng")).toBeTruthy();
    expect(screen.getByText("21")).toBeTruthy();
    expect(screen.getByText("Sẵn sàng xuất bán")).toBeTruthy();
  });

  it("handles click and keyboard activation when onClick is provided", () => {
    const handleClick = vi.fn();
    render(
      <MetricBar
        items={[
          {
            label: "Đã xuất bán",
            value: 3,
            unit: "máy",
            onClick: handleClick,
          },
        ]}
      />
    );

    const item = screen.getByText("Đã xuất bán").closest("div")!;
    fireEvent.click(item);
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(item, { key: "Enter" });
    expect(handleClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(item, { key: " " });
    expect(handleClick).toHaveBeenCalledTimes(3);
  });
});
