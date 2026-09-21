// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayrollEmployeeDeductionsModal } from "./PayrollEmployeeDeductionsModal";
afterEach(cleanup);
describe("employee deductions", () => {
  it("previews deductions exceeding income without a negative payout", () => {
    render(<PayrollEmployeeDeductionsModal employeeName="An" values={{ advances: 0, otherDeductions: 0 }} gross={1000000} deductionTotal={100000} onApply={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tạm ứng lương (đ)"), { target: { value: "1200000" } });
    expect(screen.getByText(/Khấu trừ vượt thu nhập/).textContent).toContain("300.000");
    expect(screen.getByText(/Thực nhận dự kiến/).textContent).toContain("0 đ");
  });
  it("rejects negative and fractional amounts and allows clearing an advance", () => {
    const apply = vi.fn();
    render(<PayrollEmployeeDeductionsModal employeeName="An" values={{ advances: 500000, otherDeductions: 0 }} gross={1000000} deductionTotal={500000} onApply={apply} onCancel={vi.fn()} />);
    const amount = screen.getByLabelText("Tạm ứng lương (đ)");
    for (const value of ["-1", "0.5"]) {
      fireEvent.change(amount, { target: { value } });
      fireEvent.submit(screen.getByRole("dialog"));
      expect(apply).not.toHaveBeenCalled();
    }
    fireEvent.change(amount, { target: { value: "0" } });
    fireEvent.submit(screen.getByRole("dialog"));
    expect(apply).toHaveBeenCalledWith({ advances: 0, otherDeductions: 0 });
  });
});
