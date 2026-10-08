// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentDialog from "./PaymentDialog";

afterEach(cleanup);

describe("PaymentDialog", () => {
  it("blocks full payment without a customer and exposes the guidance", async () => {
    const onSubmit = vi.fn();
    render(<PaymentDialog total={500_000} busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Vui lòng chọn khách hàng trước khi thanh toán.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("defaults to full payment and exposes three explicit modes", () => {
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Thanh toán đủ" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Thanh toán một phần" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ghi nợ toàn bộ" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Số tiền thu" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Tiền khách đưa" }) as HTMLInputElement).value).toBe("500.000");
    expect(screen.getByText("Nguồn tiền 1")).toBeTruthy();
    expect(screen.getByText("Dùng để tính tiền trả lại.")).toBeTruthy();
  });

  it("submits actual collections and due date in partial mode", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán một phần" }));
    const amount = screen.getByRole("textbox", { name: "Số tiền thu" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "200000");
    await userEvent.clear(screen.getByRole("textbox", { name: "Tiền khách đưa" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Tiền khách đưa" }), "200000");
    expect((screen.getByRole("textbox", { name: "Số tiền thu" }) as HTMLInputElement).value).toBe("200.000");
    await userEvent.type(screen.getByLabelText("Hạn thanh toán công nợ"), "2026-09-30");
    expect(screen.getByText("Ngày khách hàng cần thanh toán phần công nợ còn lại.")).toBeTruthy();
    expect(screen.getByText("300.000 ₫")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ method: "cash", amount: 200_000, tenderedAmount: 200_000 }], "2026-09-30"));
  });

  it("requires customer and due date for debt modes", async () => {
    const onSubmit = vi.fn();
    render(<PaymentDialog total={500_000} busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Ghi nợ toàn bộ" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/khách hàng/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides payment rows and submits an empty list for full debt", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Ghi nợ toàn bộ" }));
    expect(screen.queryByRole("textbox", { name: "Số tiền thu" })).toBeNull();
    await userEvent.type(screen.getByLabelText("Hạn thanh toán công nợ"), "2026-09-30");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([], "2026-09-30"));
  });

  it("resets to a valid full cash payment when switching back to full", async () => {
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Ghi nợ toàn bộ" }));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán đủ" }));
    expect(screen.queryByRole("textbox", { name: "Số tiền thu" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Tiền khách đưa" }) as HTMLInputElement).value).toBe("500.000");
  });

  it("exposes collection amount when multiple payment sources are added", async () => {
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Thêm phương thức" }));
    expect(screen.getAllByRole("textbox", { name: "Số tiền thu" }).length).toBe(2);
  });

  it("automatically balances payment sources in full payment mode", async () => {
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Thêm phương thức" }));
    const amountInputs = screen.getAllByRole("textbox", { name: "Số tiền thu" });
    expect((amountInputs[0] as HTMLInputElement).value).toBe("500.000");
    expect((amountInputs[1] as HTMLInputElement).value).toBe("");

    // Typing 300.000 into Row 2 automatically reduces Row 1 to 200.000
    await userEvent.type(amountInputs[1], "300000");
    expect((amountInputs[0] as HTMLInputElement).value).toBe("200.000");
    expect((amountInputs[1] as HTMLInputElement).value).toBe("300.000");

    // Typing 100.000 into Row 1 automatically balances Row 2 to 400.000
    await userEvent.clear(amountInputs[0]);
    await userEvent.type(amountInputs[0], "100000");
    expect((amountInputs[0] as HTMLInputElement).value).toBe("100.000");
    expect((amountInputs[1] as HTMLInputElement).value).toBe("400.000");
  });

  it("labels non-cash references and uses overflow-safe responsive layouts", async () => {
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Phương thức thanh toán" }), "transfer");
    expect(screen.getByRole("textbox", { name: "Mã giao dịch" })).toBeTruthy();
    const dialog = screen.getByRole("dialog", { name: "Thanh toán" });
    expect(dialog.className).toContain("overflow-x-hidden");
    expect(screen.getByTestId("payment-source-1").className).toContain("min-w-0");
    expect(screen.getByTestId("payment-summary").className).toContain("grid-cols-1");
    expect(screen.getByTestId("payment-summary").className).toContain("sm:grid-cols-3");
  });
});
