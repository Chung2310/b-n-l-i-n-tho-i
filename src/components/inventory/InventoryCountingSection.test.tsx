// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InventoryCountingModal } from "./InventoryCountingSection";
import { inventoryCountService } from "../../services/inventoryCountService";
import { toast } from "../../pages/Toast";

vi.mock("../../services/inventoryCountService", () => ({ inventoryCountService: { list: vi.fn(), syncPending: vi.fn(), updateItem: vi.fn(), reload: vi.fn() } }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const fixture = { _id: "c", version: 3, countCode: "KK-1", warehouseId: "w", status: "counting" as const, createdAt: "2026-09-29", items: [{ _id: "i", productId: "p", sku: "SKU-1", productName: "Phone", systemQuantity: 10, countedQuantity: 10, quantityDelta: 0 }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryCountService.list).mockResolvedValue([fixture]);
  vi.mocked(inventoryCountService.syncPending).mockResolvedValue({ remaining: 0, conflicts: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("count edit conflict UI", () => {
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
