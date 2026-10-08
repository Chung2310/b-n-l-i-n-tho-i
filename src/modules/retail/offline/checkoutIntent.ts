import { verifyConfirmation } from "./confirmationEvidence";
import { prepareDraftCreation, prepareDraftUpdate, withDraftRequestLock } from "./draftCreationRequest";
import { createRetailOfflineOrder, type OfflineScope, type RetailOfflineQueue } from "./retailOfflineQueue";
import { confirmOfflineOrderLocked } from "./confirmOfflineOrder";
import type { RetailPaymentInput } from "../types";

export class PendingCheckoutError extends Error {
  constructor(message: string, readonly intentId: string) { super(message); this.name = "PendingCheckoutError"; }
}

export async function checkoutWithPersistedIntent(scope: OfflineScope, queue: RetailOfflineQueue, input: Record<string, unknown>, payments: RetailPaymentInput[], expectedGrandTotal: number, draft?: { _id: string; version: number } | null, posSessionId?: string) {
  return withDraftRequestLock(scope, scope.userId, async () => {
    if ((await queue.list(scope)).some(item => item.status !== "synced" && item.status !== "revoked")) throw new Error("Còn yêu cầu thanh toán chưa rõ kết quả. Xử lý tại mục đồng bộ trước khi thanh toán mới.");
    const draftCreation = draft ? undefined : prepareDraftCreation(scope, scope.userId, input);
    const draftUpdate = draft ? prepareDraftUpdate(scope, scope.userId, draft._id, { ...input, version: draft.version }) : undefined;
    const item = createRetailOfflineOrder(scope, JSON.parse(JSON.stringify({
      draftId: draft?._id, draftVersion: draft?.version, draftSaved: false,
      draftCreation, draftUpdate, input, expectedGrandTotal, payments, posSessionId,
    })), crypto.randomUUID());
    item.status = "syncing";
    await queue.put(item);
    try {
      const result = await confirmOfflineOrderLocked(scope, item, queue);
      verifyConfirmation(result);
      await queue.update(item.id, { status: "synced", lastError: undefined });
      return result;
    } catch (error) {
      // Retain the same intent even if recording this error fails or the tab closes.
      await queue.update(item.id, { status: "failed", lastError: error instanceof Error ? error.message : "Chưa rõ kết quả thanh toán." }).catch(() => undefined);
      throw new PendingCheckoutError(error instanceof Error ? error.message : "Chưa rõ kết quả thanh toán.", item.id);
    }
  });
}
