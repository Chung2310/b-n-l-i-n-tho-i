// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DailyBulletin } from "./DailyBulletin";
import { getEnergyGreeting } from "./energyGreeting";

afterEach(cleanup);
describe("daily bulletin", () => {
  it("changes greetings at noon and evening", () => {
    expect(getEnergyGreeting(11).greeting).toBe("Xin chào, chúc bạn một ngày làm việc hiệu quả!");
    expect(getEnergyGreeting(12).greeting).toBe("Xin chào, chúc bạn một ngày làm việc đầy năng lượng!");
    expect(getEnergyGreeting(18).greeting).toBe("Xin chào, cố gắng hoàn thành tốt nhiệm vụ nhé!");
  });
  it("stays visible while loading and reports failed requests", () => {
    const view = render(<DailyBulletin error={false} />);
    expect(screen.getByRole("region", { name: "Bản tin việc cần làm" })).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    view.rerender(<DailyBulletin error />);
    expect(screen.getByRole("alert").textContent).toContain("Không tải được");
  });
  it("renders technical work inline with accessible action links", () => {
    render(<DailyBulletin error={false} data={{ role: "technical", updatedAt: "", cards: [{ title: "Thiếu linh kiện", value: "2 phiếu", detail: "Phiếu được phân công", href: "/sua-chua-bao-hanh" }] }} />);
    expect(screen.getByText("Kỹ thuật")).toBeTruthy();
    expect(screen.getByText("2 phiếu")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/sua-chua-bao-hanh");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
