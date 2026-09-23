// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarChart } from "./DashboardWidgets";
afterEach(cleanup);
describe("revenue combination chart", () => {
  it("aligns the line points with bar tops on the same scale", () => {
    const { container } = render(<BarChart data={[{label: "Day 1", value: 100}, {label: "Day 2", value: 50}, {label: "Day 3", value: 0}]} />);
    const bars = container.querySelectorAll("rect");
    const dots = container.querySelectorAll("circle");
    expect(bars.length).toBe(3);
    dots.forEach((dot, i) => expect(dot.getAttribute("cy")).toBe(bars[i].getAttribute("y")));
    expect(dots[0].getAttribute("cy")).toBe("0");
    expect(dots[1].getAttribute("cy")).toBe("130");
    expect(dots[2].getAttribute("cy")).toBe("260");
    expect(container.querySelector("polyline")?.getAttribute("points")?.split(" ")).toHaveLength(3);
  });
  it("handles empty and all-zero series without invalid SVG coordinates", () => {
    const { container, rerender } = render(<BarChart data={[]} />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<BarChart data={[{label: "Day 1", value: 0}]} />);
    expect(container.querySelector("circle")?.getAttribute("cy")).toBe("260");
    expect(container.innerHTML).not.toContain("NaN");
    expect(container.innerHTML).not.toContain("Infinity");
  });
});
