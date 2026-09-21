// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PayrollSalaryAdvanceModal,
  numberToVietnameseWords,
} from "./PayrollSalaryAdvanceModal";

describe("numberToVietnameseWords", () => {
  it("converts numbers to Vietnamese words correctly", () => {
    expect(numberToVietnameseWords(0)).toBe("Không đồng");
    expect(numberToVietnameseWords(500000)).toBe("Năm trăm nghìn đồng");
    expect(numberToVietnameseWords(2000000)).toBe("Hai triệu đồng");
    expect(numberToVietnameseWords(1500000)).toBe("Một triệu năm trăm nghìn đồng");
  });
});

describe("PayrollSalaryAdvanceModal", () => {
  const employees = [
    { employeeId: "e1", employeeName: "Nguyen Van A", monthlySalary: 10000000, advances: 500000 },
    { employeeId: "e2", employeeName: "Tran Thi B", monthlySalary: 12000000, advances: 0 },
  ];

  it("fills the advance form and submits correctly", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();

    render(
      <PayrollSalaryAdvanceModal
        open={true}
        periodKey="2026-08"
        employees={employees}
        onClose={close}
        onSubmit={submit}
      />
    );

    expect(screen.getByText("Tạo phiếu tạm ứng lương")).toBeTruthy();
    expect(screen.getByText("Kỳ lương 2026-08")).toBeTruthy();

    const amountInput = screen.getByPlaceholderText("Ví dụ: 2000000");
    fireEvent.change(amountInput, { target: { value: "2000000" } });
    expect(screen.getByText("Hai triệu đồng")).toBeTruthy();

    const reasonInput = screen.getByPlaceholderText(/Nhập lý do tạm ứng lương/);
    fireEvent.change(reasonInput, { target: { value: "Tạm ứng tiền sinh hoạt" } });

    const submitBtn = screen.getByText("Lưu & Tạo phiếu tạm ứng");
    fireEvent.click(submitBtn);

    expect(submit).toHaveBeenCalledWith({
      employeeId: "e1",
      amount: 2000000,
      date: expect.any(String),
      method: "Chuyển khoản ngân hàng",
      reason: "Tạm ứng tiền sinh hoạt",
      note: undefined,
    });
  });

  it("toggles print preview mode and renders voucher template", () => {
    render(
      <PayrollSalaryAdvanceModal
        open={true}
        periodKey="2026-08"
        employees={employees}
        initialEmployeeId="e2"
        initialAmount={3000000}
        initialReason="Tam ung hoc phi"
        initialPreviewPrint={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Xem trước phiếu tạm ứng lương")).toBeTruthy();
    expect(screen.getByText("PHIẾU TẠM ỨNG LƯƠNG")).toBeTruthy();
    expect(screen.getAllByText("Tran Thi B").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/3[,.]000[,.]000 VNĐ/)).toBeTruthy();
    expect(screen.getByText("Ba triệu đồng")).toBeTruthy();
    expect(screen.getByText("Người đề nghị tạm ứng")).toBeTruthy();
    expect(screen.getByText("Kế toán thanh toán")).toBeTruthy();
    expect(screen.getByText("Giám đốc / Phê duyệt")).toBeTruthy();
  });
});
