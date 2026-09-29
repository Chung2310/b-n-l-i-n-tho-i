// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../modules/shared/lib/apiFetch";
import { inventoryCountService } from "./inventoryCountService";

vi.mock("../modules/shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const key = "igen.inventory-count.pending";
const entry = { id: "c", itemId: "i", countedQuantity: 7, expectedVersion: 3 };
const queued = () => JSON.parse(localStorage.getItem(key) || "[]");

describe("versioned inventory count edits", () => {
  beforeEach(() => { vi.restoreAllMocks(); fetchMock.mockReset(); localStorage.clear(); vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); });
  it("sends the displayed version with quantity and rejects a missing version locally", async () => {
    fetchMock.mockResolvedValue({ data: { _id: "c", version: 4 } });
    await inventoryCountService.updateItem("c", "i", 7, 3);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ countedQuantity: 7, expectedVersion: 3 });
    await expect(inventoryCountService.updateItem("c", "i", 7, undefined as any)).rejects.toThrow(/tải lại/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("retains the original version offline and never rebases a conflicting replay", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(inventoryCountService.updateItem("c", "i", 7, 3)).rejects.toThrow();
    expect(queued()).toEqual([entry]);
    fetchMock.mockClear().mockRejectedValue({ status: 409 });
    expect(await inventoryCountService.syncPending()).toEqual({ remaining: 1, conflicts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).expectedVersion).toBe(3);
    expect(queued()).toEqual([entry]);
  });
  it("keeps legacy unversioned queued edits for manual reconciliation without sending", async () => {
    localStorage.setItem(key, JSON.stringify([{ id: "c", itemId: "i", countedQuantity: 7 }]));
    expect(await inventoryCountService.syncPending()).toEqual({ remaining: 1, conflicts: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("coalesces sync calls and preserves a newer queued edit while replay is in flight", async () => {
    localStorage.setItem(key, JSON.stringify([entry]));
    let resolve!: (value: any) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const first = inventoryCountService.syncPending();
    const second = inventoryCountService.syncPending();
    localStorage.setItem(key, JSON.stringify([{ ...entry, countedQuantity: 8 }]));
    resolve({ data: { _id: "c", version: 4 } });
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queued()).toEqual([{ ...entry, countedQuantity: 8 }]);
  });
  it("removes a successful replay and keeps other failed entries", async () => {
    localStorage.setItem(key, JSON.stringify([entry, { ...entry, itemId: "other" }]));
    fetchMock.mockResolvedValueOnce({ data: { _id: "c", version: 4 } }).mockRejectedValueOnce({ status: 409 });
    expect(await inventoryCountService.syncPending()).toEqual({ remaining: 1, conflicts: 1 });
    expect(queued()[0].itemId).toBe("other");
  });
  it("reloads before discarding only the selected count's pending edits", async () => {
    localStorage.setItem(key, JSON.stringify([entry, { ...entry, id: "other" }]));
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(inventoryCountService.reload("c")).rejects.toThrow();
    expect(queued()).toHaveLength(2);
    fetchMock.mockResolvedValueOnce({ data: { _id: "c", version: 9 } });
    expect(await inventoryCountService.reload("c")).toMatchObject({ version: 9 });
    expect(queued()).toEqual([{ ...entry, id: "other" }]);
  });
});
