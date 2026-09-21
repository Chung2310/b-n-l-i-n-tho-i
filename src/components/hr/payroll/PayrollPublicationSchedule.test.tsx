// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({ getReconciliationSchedule: vi.fn(), saveReconciliationSchedule: vi.fn() }));
vi.mock("../../../services/payrollService", () => ({ payrollService: service }));
import { PayrollPublicationSchedule } from "./PayrollPublicationSchedule";
const config = { enabled: false, day: 15, hour: 9, minute: 0, periodOffset: 0, version: 2 };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("payroll publication schedule settings", () => {
  it("saves the selected day, time and salary month with the loaded version", async () => {
    service.getReconciliationSchedule.mockResolvedValue(config);
    service.saveReconciliationSchedule.mockImplementation(async value => ({ ...value, version: 3 }));
    render(<PayrollPublicationSchedule canManage />);
    fireEvent.click(await screen.findByLabelText("Tự động phát hành hằng tháng"));
    fireEvent.change(screen.getByLabelText("Ngày trong tháng"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Giờ phát hành"), { target: { value: "08:45" } });
    fireEvent.change(screen.getByLabelText("Kỳ lương được phát hành"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu lịch phát hành" }));
    await waitFor(() => expect(service.saveReconciliationSchedule).toHaveBeenCalledWith({ enabled: true, day: 20, hour: 8, minute: 45, periodOffset: -1, version: 2 }));
    await screen.findByText("Đã lưu lịch phát hành.");
  });
  it("shows save conflicts and lets accounting reload the current version", async () => {
    service.getReconciliationSchedule.mockResolvedValue(config);
    service.saveReconciliationSchedule.mockRejectedValue(new Error("Lịch vừa được thay đổi"));
    render(<PayrollPublicationSchedule canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Lưu lịch phát hành" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Lịch vừa được thay đổi");
    fireEvent.click(screen.getByRole("button", { name: "Tải lại lịch phát hành" }));
    await waitFor(() => expect(service.getReconciliationSchedule).toHaveBeenCalledTimes(2));
  });
  it("does not offer saving to readers", async () => {
    service.getReconciliationSchedule.mockResolvedValue(config);
    render(<PayrollPublicationSchedule canManage={false} />);
    await screen.findByLabelText("Ngày trong tháng");
    expect(screen.queryByRole("button", { name: "Lưu lịch phát hành" })).toBeNull();
  });
});
