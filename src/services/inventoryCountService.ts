import { apiFetch } from "../modules/shared/lib/apiFetch";
export type CountStatus = "draft" | "counting" | "pending_approval" | "completed" | "cancelled" | "conflict";
export type CountTrackingMode = "none" | "quantity" | "unit_barcode" | "lot" | "serial";
export type CountExpectedUnit = { serialUnitId: string; internalBarcode?: string; serialNumber?: string };
export type CountItem = { _id: string; productId: string; variantId?: string; sku: string; barcode?: string; productName: string; systemQuantity: number; countedQuantity: number; quantityDelta: number; trackingMode?: CountTrackingMode; expectedUnits?: CountExpectedUnit[]; scannedUnitIds?: string[]; note?: string };
export type UnexpectedScanReason = "other_warehouse" | "sold" | "unknown" | "wrong_status";
export type UnexpectedScan = { code: string; reason: UnexpectedScanReason; serialUnitId?: string; sku?: string; productName?: string; warehouseId?: string; status?: string; scannedAt: string };
export type ScanResult = { outcome: "counted" | "duplicate" | "unexpected"; reason?: UnexpectedScanReason; sku?: string; productName?: string; count: InventoryCount };
export type InventoryCount = { _id: string; version: number; countCode: string; warehouseId: string; status: CountStatus; items: CountItem[]; unexpectedScans?: UnexpectedScan[]; createdAt: string; createdById?: string; submittedBy?: string; submittedById?: string; approvedById?: string };
type Envelope<T> = { status: string; data: T };
const root = "/inventory/counts";
const queueKey = "igen.inventory-count.pending";
type PendingUpdate = { id: string; itemId: string; countedQuantity: number; expectedVersion?: number };
function readQueue(): PendingUpdate[] { try { const value = JSON.parse(localStorage.getItem(queueKey) || "[]"); return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.itemId === "string") : []; } catch { return []; } }
function writeQueue(items: PendingUpdate[]) { localStorage.setItem(queueKey, JSON.stringify(items)); }
const validVersion = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
async function sendUpdate(item: PendingUpdate) {
  if (!validVersion(item.expectedVersion)) throw new Error("Hãy tải lại phiếu kiểm kê trước khi lưu số lượng.");
  return (await apiFetch<Envelope<InventoryCount>>(root + "/" + item.id + "/items/" + item.itemId, { method: "PATCH", body: JSON.stringify({ countedQuantity: item.countedQuantity, expectedVersion: item.expectedVersion }) })).data;
}
let syncing: Promise<{ remaining: number; conflicts: number }> | undefined;
export const inventoryCountService = {
  async list(warehouseId?: string) { return (await apiFetch<Envelope<InventoryCount[]>>(root, { params: warehouseId ? { warehouseId } : {} })).data; },
  async get(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id)).data; },
  async reload(id: string) {
    // Finish an already running replay before reading the replacement snapshot.
    if (syncing) await syncing;
    const latest = await this.get(id);
    this.discardPending(id);
    return latest;
  },
  async create(warehouseId: string) { return (await apiFetch<Envelope<InventoryCount>>(root, { method: "POST", body: JSON.stringify({ warehouseId }) })).data; },
  async updateItem(id: string, itemId: string, countedQuantity: number, expectedVersion: number) {
    try { return await sendUpdate({ id, itemId, countedQuantity, expectedVersion }); }
    catch (error) { if (!navigator.onLine && validVersion(expectedVersion)) { const queue = readQueue().filter((item) => !(item.id === id && item.itemId === itemId)); queue.push({ id, itemId, countedQuantity, expectedVersion }); writeQueue(queue); } throw error; }
  },
  async scan(id: string, code: string) { return (await apiFetch<Envelope<ScanResult>>(root + "/" + id + "/scan", { method: "POST", body: JSON.stringify({ code }) })).data; },
  async syncPending() {
    if (syncing) return syncing;
    syncing = (async () => {
      let conflicts = 0;
      for (const item of readQueue()) {
        // Legacy entries without a version need human reconciliation; never
        // fetch the latest version and silently apply the old quantity to it.
        if (!validVersion(item.expectedVersion)) { conflicts += 1; continue; }
        try {
          await sendUpdate(item);
          const signature = JSON.stringify(item);
          writeQueue(readQueue().filter((current) => JSON.stringify(current) !== signature));
        } catch (error: any) { if (error?.status === 409 || error?.statusCode === 409) conflicts += 1; }
      }
      return { remaining: readQueue().length, conflicts };
    })();
    try { return await syncing; } finally { syncing = undefined; }
  },
  discardPending(id: string) { writeQueue(readQueue().filter((item) => item.id !== id)); },
  async start(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/start", { method: "POST" })).data; },
  async submit(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/submit", { method: "POST" })).data; },
  async approve(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/approve", { method: "POST" })).data; },
  async cancel(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/cancel", { method: "POST" })).data; },
};
