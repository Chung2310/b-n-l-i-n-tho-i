// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryCountingModal } from "./InventoryCountingSection";
import { inventoryCountService } from "../../services/inventoryCountService";
import { toast } from "../../pages/Toast";

vi.mock("../../services/inventoryCountService", () => ({ inventoryCountService: { list: vi.fn(), syncPending: vi.fn(), updateItem: vi.fn(), reload: vi.fn(), get: vi.fn(), recreate: vi.fn(), approve: vi.fn() } }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: { id: "approver" }, hasPermission: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
const fixture = { _id: "c", version: 3, countCode: "KK-1", warehouseId: "w", status: "counting" as const, createdAt: "2026-09-29", items: [{ _id: "i", productId: "p", sku: "SKU-1", productName: "Phone", systemQuantity: 10, countedQuantity: 10, quantityDelta: 0 }] };
beforeEach(() => {
  vi.clearAllMocks();
  auth.user.id = "approver";
  auth.hasPermission.mockReturnValue(false);
  vi.mocked(inventoryCountService.list).mockResolvedValue([fixture]);
  vi.mocked(inventoryCountService.syncPending).mockResolvedValue({ remaining: 0, conflicts: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("count edit conflict UI", () => {
  it("requires discrepancy confirmation and every unexpected-code reason before approval", async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "pending_approval", createdById: "creator", items: [{ ...fixture.items[0], countedQuantity: 8, quantityDelta: -2 }], unexpectedScans: [{ code: "EXTRA", reason: "unknown", scannedAt: "2026-09-29" }] }]);
    vi.mocked(inventoryCountService.approve).mockResolvedValue({ ...fixture, status: "completed", version: 4 });
    auth.hasPermission.mockReturnValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const approve = await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Lý do chênh lệch"), "Recount verified");
    await user.click(screen.getByRole("checkbox", { name: /Tôi đã đối chiếu/ }));
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Kết quả đối chiếu mã ngoài dự kiến EXTRA"), "Customer equipment");
    expect((approve as HTMLButtonElement).disabled).toBe(false);
    await user.click(approve);
    await waitFor(() => expect(inventoryCountService.approve).toHaveBeenCalledWith("c", { expectedVersion: 3, discrepancyConfirmed: true, reason: "Recount verified", unexpectedScanResolutions: [{ code: "EXTRA", reason: "Customer equipment" }] }));
  });
  it("confirms recreation and opens the new empty count with a link to its source", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "conflict" }]);
    vi.mocked(inventoryCountService.recreate).mockResolvedValue({ ...fixture, _id: "new", countCode: "KK-NEW", status: "draft", recreatedFromId: "c", items: [{ ...fixture.items[0], countedQuantity: 0, quantityDelta: -10 }] });
    auth.hasPermission.mockImplementation((permission) => permission === "inventory:manage");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const button = await screen.findByRole("button", { name: "Tạo lại phiếu kiểm kê" });
    fireEvent.click(button);
    expect(inventoryCountService.recreate).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); fireEvent.click(button);
    await waitFor(() => expect(inventoryCountService.recreate).toHaveBeenCalledWith("c"));
    await screen.findByRole("button", { name: "Xem phiếu xung đột gốc" });
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("0");
  });
  it("disables recreation without inventory management permission", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "conflict" }]);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const button = await screen.findByRole("button", { name: "Tạo lại phiếu kiểm kê" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
  it("refreshes the conflict state after failed approval so recreation becomes available", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "pending_approval", createdById: "creator" }]);
    vi.mocked(inventoryCountService.approve).mockRejectedValue({ status: 409, message: "Stock changed" });
    vi.mocked(inventoryCountService.get).mockResolvedValue({ ...fixture, status: "conflict" });
    auth.hasPermission.mockReturnValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" }));
    await screen.findByRole("button", { name: "Tạo lại phiếu kiểm kê" });
    expect(inventoryCountService.get).toHaveBeenCalledWith("c");
    expect(inventoryCountService.recreate).not.toHaveBeenCalled();
  });
  it("only enables approval for an independently identified approver with the dedicated permission", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "pending_approval", createdById: "creator", submittedById: "submitter" }]);
    const { rerender } = render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const button = await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    auth.hasPermission.mockImplementation((permission) => permission === "inventory-count-approval:manage");
    rerender(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    expect((button as HTMLButtonElement).disabled).toBe(false);
    auth.user.id = "creator";
    rerender(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    auth.user.id = "submitter";
    rerender(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
  it("submits the displayed version and reports a stale edit without silently retrying", async () => {
    vi.mocked(inventoryCountService.updateItem).mockRejectedValue(new Error("Phiếu đã thay đổi, hãy tải lại"));
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const input = await screen.findByRole("spinbutton");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);
    await waitFor(() => expect(inventoryCountService.updateItem).toHaveBeenCalledWith("c", "i", 7, 3));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Phiếu đã thay đổi, hãy tải lại"));
    expect(inventoryCountService.updateItem).toHaveBeenCalledTimes(1);
    expect(inventoryCountService.reload).not.toHaveBeenCalled();
  });
  it("requires confirmation before replacing edits with the reloaded count", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(inventoryCountService.reload).mockResolvedValue({ ...fixture, version: 9, items: [{ ...fixture.items[0], countedQuantity: 12 }] });
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const reload = await screen.findByRole("button", { name: "Tải lại phiếu" });
    fireEvent.click(reload);
    expect(inventoryCountService.reload).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(reload);
    await waitFor(() => expect(inventoryCountService.reload).toHaveBeenCalledWith("c"));
    await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("12"));
  });
});
