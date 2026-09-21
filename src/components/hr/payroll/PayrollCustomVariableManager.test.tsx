// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { PayrollCustomVariableManager } from "./PayrollCustomVariableManager";
import { payrollService } from "../../../services/payrollService";

vi.mock("../../../services/payrollService", () => ({
  payrollService: {
    getPeriodInputVariables: vi.fn(),
    createPeriodInputVariable: vi.fn(),
    activatePeriodInputVariable: vi.fn(),
    retirePeriodInputVariable: vi.fn(),
  },
}));

vi.mock("../../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PayrollCustomVariableManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders existing custom columns with complex calculated formula", async () => {
    (payrollService.getPeriodInputVariables as any).mockResolvedValue([
      {
        _id: "var-1",
        code: "sales",
        name: "Doanh số",
        unit: "money",
        status: "active",
        columnType: "manual",
      },
      {
        _id: "var-2",
        code: "real_wage",
        name: "Lương theo ngày công",
        unit: "money",
        status: "active",
        columnType: "calculated",
        calculation: {
          expression: "(monthlySalary / standardDays) * workedDays",
        },
      },
    ]);

    render(<PayrollCustomVariableManager />);

    await waitFor(() => {
      expect(screen.getByText("Doanh số")).toBeTruthy();
      expect(screen.getByText("Lương theo ngày công")).toBeTruthy();
      expect(screen.getByText("Tự tính")).toBeTruthy();
      expect(screen.getByText(/Lương cơ bản.*Công chuẩn.*Ngày công/)).toBeTruthy();
    });
  });

  it("creates a complex calculated custom column with multi-term formula", async () => {
    (payrollService.getPeriodInputVariables as any).mockResolvedValue([]);
    (payrollService.createPeriodInputVariable as any).mockResolvedValue({ _id: "new-var-1" });
    (payrollService.activatePeriodInputVariable as any).mockResolvedValue({});

    const onChanged = vi.fn();
    render(<PayrollCustomVariableManager onChanged={onChanged} />);

    // Click "+ Thêm cột"
    fireEvent.click(screen.getByText("+ Thêm cột"));

    // Switch to "Cột tự động tính"
    fireEvent.click(screen.getByText("Cột tự động tính"));

    // Enter code and name
    fireEvent.change(screen.getByLabelText("Mã biến"), { target: { value: "ot_pay" } });
    fireEvent.change(screen.getByLabelText("Tên biến"), { target: { value: "Tiền tăng ca" } });

    // Click preset "Lương tăng ca (hệ số 150%)"
    fireEvent.click(screen.getByText("Lương tăng ca (hệ số 150%)"));

    // Check expression field value
    const input = screen.getByLabelText("Công thức toán học") as HTMLInputElement;
    expect(input.value).toBe("(monthlySalary / standardDays / 8) * overtimeHours * 1.5");

    // Expect formula preview and simulator to be visible
    expect(screen.getByText(/Công thức trực quan:/)).toBeTruthy();
    expect(screen.getByText(/Giả lập mẫu/)).toBeTruthy();

    // Click "Lưu và áp dụng cột"
    fireEvent.click(screen.getByText("Lưu và áp dụng cột"));

    await waitFor(() => {
      expect(payrollService.createPeriodInputVariable).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ot_pay",
          name: "Tiền tăng ca",
          columnType: "calculated",
          calculation: expect.objectContaining({
            expression: "(monthlySalary / standardDays / 8) * overtimeHours * 1.5",
          }),
        })
      );
      expect(payrollService.activatePeriodInputVariable).toHaveBeenCalledWith("new-var-1");
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("toggles active/retired state and notifies onChanged", async () => {
    (payrollService.getPeriodInputVariables as any).mockResolvedValue([
      {
        _id: "var-1",
        code: "sales",
        name: "Doanh số",
        unit: "money",
        status: "active",
        columnType: "manual",
      },
    ]);
    (payrollService.retirePeriodInputVariable as any).mockResolvedValue({});

    const onChanged = vi.fn();
    render(<PayrollCustomVariableManager onChanged={onChanged} />);

    const button = await screen.findByText("Ẩn cột");
    expect(button).toBeTruthy();

    fireEvent.click(button);

    await waitFor(() => {
      expect(payrollService.retirePeriodInputVariable).toHaveBeenCalledWith("var-1");
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
