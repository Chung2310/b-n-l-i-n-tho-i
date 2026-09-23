// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarChart } from "./DashboardWidgets";
afterEach(cleanup);
describe("revenue combination chart", () => {
  it("aligns the line points with bar tops on the same scale", () => {
    const { container } = render(<BarChart data={[{label: "Day 1", value: 100}, {label: "Day 2", value: 50}, {label: "Day 3", value: 0}]} />);
    const bars = container.querySelectorAll("rect");
    const linePoints = container.querySelector("polyline")!.getAttribute("points")!.split(" ").map(point => point.split(",").map(Number));
    expect(container.querySelector("circle")).toBeNull();
    expect(bars.length).toBe(3);
    linePoints.slice(1, -1).forEach((point, i) => expect(point[1]).toBe(Number(bars[i].getAttribute("y"))));
    expect(linePoints[0]).toEqual([0, 260]);
    expect(linePoints[1][1]).toBe(0);
    expect(linePoints[2][1]).toBe(130);
    expect(linePoints[3][1]).toBe(260);
    expect(linePoints[4]).toEqual([1000, 260]);
    expect(container.querySelector("polyline")?.getAttribute("points")?.split(" ")).toHaveLength(5);
  });
  it("handles empty and all-zero series without invalid SVG coordinates", () => {
    const { container, rerender } = render(<BarChart data={[]} />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<BarChart data={[{label: "Day 1", value: 0}]} />);
    expect(container.querySelector("polyline")?.getAttribute("points")).toBe("0,260 500,260 1000,260");
    expect(container.innerHTML).not.toContain("NaN");
    expect(container.innerHTML).not.toContain("Infinity");
  });
});
