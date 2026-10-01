export type RepairRefundRequest = { amount: number; laborAmount: number; reason: string; reference: string; idempotencyKey: string };

export function readRefundRequest(storageKey: string): RepairRefundRequest | null {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return null;
  const row = JSON.parse(raw);
  if (!row || !Number.isSafeInteger(row.amount) || row.amount <= 0 || !Number.isSafeInteger(row.laborAmount) || row.laborAmount < 0 || row.laborAmount > row.amount || ["reason", "reference", "idempotencyKey"].some(k => typeof row[k] !== "string" || !row[k].trim()) || row.idempotencyKey.length > 100) throw new Error("Yêu cầu hoàn tiền đã lưu bị lỗi. Cần đối soát, không tạo yêu cầu thay thế.");
  return { amount: row.amount, laborAmount: row.laborAmount, reason: row.reason, reference: row.reference, idempotencyKey: row.idempotencyKey };
}

export function sameRefundRequest(a: RepairRefundRequest, b: RepairRefundRequest) {
  return a.idempotencyKey === b.idempotencyKey && a.amount === b.amount && a.laborAmount === b.laborAmount && a.reason === b.reason && a.reference === b.reference;
}

export async function withRefundRequestLock<T>(storageKey: string, work: () => Promise<T>) {
  if (!navigator.locks?.request) throw new Error("Không khóa được thao tác giữa các tab. Hãy mở ứng dụng qua HTTPS bằng trình duyệt được hỗ trợ trước khi gửi khoản hoàn.");
  return navigator.locks.request(storageKey, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Khoản hoàn đang được xử lý ở tab khác. Chờ tab đó hoàn tất rồi đối chiếu.");
    return work();
  });
}
