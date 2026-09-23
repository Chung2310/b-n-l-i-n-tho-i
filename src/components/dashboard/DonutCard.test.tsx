// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DonutCard } from "./DashboardWidgets";
afterEach(cleanup);
it("shows the hovered product and revenue, and clears the tooltip on leave", () => {
 const { container } = render(<DonutCard segments={[
  { label: "Product A", value: 60, color: "blue", display: "60.000.000 VND" },
  { label: "Product B", value: 40, color: "red", display: "40.000.000 VND" },
 ]} />);
 const slices = container.querySelectorAll('circle[tabindex="0"]');
 fireEvent.mouseEnter(slices[0]);
 expect(screen.getByRole("tooltip").textContent).toContain("Product A");
 expect(screen.getByRole("tooltip").textContent).toContain("60.000.000 VND");
 fireEvent.mouseEnter(slices[1]);
 expect(screen.getByRole("tooltip").textContent).toContain("Product B");
 expect(screen.getByRole("tooltip").textContent).not.toContain("Product A");
 fireEvent.mouseLeave(slices[1]);
 expect(screen.queryByRole("tooltip")).toBeNull();
 fireEvent.focus(slices[0]);
 expect(screen.getByRole("tooltip")).toBeTruthy();
 fireEvent.keyDown(slices[0], { key: "Escape" });
 expect(screen.queryByRole("tooltip")).toBeNull();
});
