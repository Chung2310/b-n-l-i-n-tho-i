// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayrollReviewQueue } from "./PayrollReviewQueue";

describe("PayrollReviewQueue", () => {
  it("shows pending adjustments and sends approve/reject actions", () => {
    const approve = vi.fn();
    const reject = vi.fn();
    render(<PayrollReviewQueue adjustments={[{ _id: "a1", employeeId: "e1", employeeName: "Nguyen A", kind: "bonus", amount: 500000, reason: "Performance", status: "pending" }]} onApprove={approve} onReject={reject} />);
    expect(screen.getByText("Nguyen A")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Duyệt điều chỉnh"));
    fireEvent.click(screen.getByTitle("Từ chối điều chỉnh"));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledTimes(1);
  });

  it("renders other_deduction and advance labels with negative amounts and print button", () => {
    const print = vi.fn();
    render(
      <PayrollReviewQueue
        adjustments={[
          { _id: "a2", employeeId: "e2", employeeName: "Tran B", kind: "other_deduction", amount: 150000, reason: "Tien dong phuc", status: "pending" },
          { _id: "a3", employeeId: "e3", employeeName: "Le C", kind: "advance", amount: 2000000, reason: "Tam ung thang 8", status: "pending" },
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onPrintAdvance={print}
      />
    );

    expect(screen.getByText("Khấu trừ khác")).toBeTruthy();
    expect(screen.getByText("Tạm ứng lương")).toBeTruthy();
    expect(screen.getByText(/-150[,.]000 đ/)).toBeTruthy();
    expect(screen.getByText(/-2[,.]000[,.]000 đ/)).toBeTruthy();

    const printBtn = screen.getByTitle("In phiếu tạm ứng");
    expect(printBtn).toBeTruthy();
    fireEvent.click(printBtn);
    expect(print).toHaveBeenCalledTimes(1);
  });
});
