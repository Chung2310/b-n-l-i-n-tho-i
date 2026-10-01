export type PendingRepairPayment = { amount: number; idempotencyKey: string; expectedPaidAmount: number; expectedTotalAmount: number };

function parse(raw: string | null): PendingRepairPayment | null {
  if (raw === null) return null;
  const row = JSON.parse(raw);
  if (!row || typeof row.idempotencyKey !== "string" || !row.idempotencyKey.trim() || row.idempotencyKey.trim().length > 200 || !Number.isSafeInteger(row.amount) || row.amount <= 0 || !Number.isSafeInteger(row.expectedPaidAmount) || row.expectedPaidAmount < 0 || !Number.isSafeInteger(row.expectedTotalAmount) || row.expectedTotalAmount < row.expectedPaidAmount) throw new Error("Yêu cầu thu tiền đã lưu bị lỗi. Cần đối soát trước khi tiếp tục.");
  return { amount: row.amount, idempotencyKey: row.idempotencyKey, expectedPaidAmount: row.expectedPaidAmount, expectedTotalAmount: row.expectedTotalAmount };
}
export function samePaymentRequest(a: PendingRepairPayment, b: PendingRepairPayment) {
  return a.amount === b.amount && a.idempotencyKey === b.idempotencyKey && a.expectedPaidAmount === b.expectedPaidAmount && a.expectedTotalAmount === b.expectedTotalAmount;
}
export function readPaymentRequest(key: string) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (shared && legacy && !samePaymentRequest(shared, legacy)) throw new Error("Khoản thu của tab cũ không khớp bản lưu chung. Giữ cả hai yêu cầu để đối soát.");
  return shared || legacy;
}
export function paymentRequestCandidates(key: string): PendingRepairPayment[] {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  return shared && legacy && !samePaymentRequest(shared, legacy) ? [shared, legacy] : shared ? [shared] : legacy ? [legacy] : [];
}
/** Only after server completion/revocation, under the browser lock. */
export function clearResolvedPaymentCandidate(key: string, request: PendingRepairPayment) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (legacy && samePaymentRequest(legacy, request)) sessionStorage.removeItem(key);
  if (shared && samePaymentRequest(shared, request)) localStorage.removeItem(key);
}
/** Caller holds the browser lock. Persist and verify before removing legacy data. */
export function persistPaymentRequest(key: string, request: PendingRepairPayment) {
  const prior = readPaymentRequest(key);
  if (prior && !samePaymentRequest(prior, request)) throw new Error("Khoản thu đã lưu thay đổi. Không ghi đè yêu cầu khác.");
  localStorage.setItem(key, JSON.stringify(request));
  const saved = parse(localStorage.getItem(key));
  if (!saved || !samePaymentRequest(saved, request)) throw new Error("Không lưu được nguyên yêu cầu thu tiền. Chưa gửi.");
  sessionStorage.removeItem(key);
}
export function clearPaymentRequest(key: string, request: PendingRepairPayment) {
  const prior = readPaymentRequest(key);
  if (prior && !samePaymentRequest(prior, request)) throw new Error("Khoản thu đã ghi nhận nhưng bản lưu đã thay đổi. Không xóa yêu cầu khác.");
  // A failure leaves a safe exact replay in whichever store remains.
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
export async function withPaymentRequestLock<T>(key: string, work: () => Promise<T>) {
  if (!navigator.locks?.request) throw new Error("Không khóa được thao tác giữa các tab. Hãy mở ứng dụng qua HTTPS bằng trình duyệt được hỗ trợ.");
  return navigator.locks.request(key, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Khoản thu đang được xử lý ở tab khác. Chờ rồi đối chiếu, không thu thêm tiền.");
    return work();
  });
}
