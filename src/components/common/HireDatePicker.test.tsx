// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HireDatePicker } from "./HireDatePicker";

afterEach(cleanup);

it("selects a hiring day from the styled inline calendar", () => {
  const onChange = vi.fn();
  render(<HireDatePicker id="hire-date" label="Ngày vào làm" value="2026-10-24" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Ngày vào làm" }));
  expect(screen.getByRole("dialog", { name: "Lịch chọn ngày vào làm" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "23/10/2026" }));
  expect(onChange).toHaveBeenCalledWith("2026-10-23");
  expect(screen.queryByRole("dialog", { name: "Lịch chọn ngày vào làm" })).toBeNull();
});

it("moves directly between years without a browser date input", () => {
  render(<HireDatePicker id="hire-date" label="Ngày vào làm" value="2026-10-24" onChange={vi.fn()} />);
  expect(document.querySelector('input[type="date"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ngày vào làm" }));
  fireEvent.click(screen.getByRole("button", { name: "Năm trước" }));
  expect(screen.getByText("Tháng 10 / 2025")).toBeTruthy();
});
