import React from "react";
import PaymentDialog from "../pos/PaymentDialog";
import { retailOrdersApi } from "../../api/retailOrders.api";
import { useRetailScope } from "../../hooks/useRetailScope";
import { ApiClientError } from "../../../../services/apiClientError";
import { getApiErrorMessage } from "../../../../utils/errorMessage";
import type { RetailOrder, RetailPaymentInput } from "../../types";

type Pending = { payments: RetailPaymentInput[]; idempotencyKey: string; expectedVersion: number };
export default function CollectionDialog({ order, close, done }: { order: RetailOrder; close: () => void; done: (order: RetailOrder) => void }) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, order._id]);
  const initialIdentity = React.useRef(identity);
  const currentIdentity = React.useRef(identity);
  currentIdentity.current = identity;
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const storageKey = `retail-collection-pending:v1:${identity}`;
  const [initial] = React.useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const pending: Pending | null = raw ? JSON.parse(raw) : null;
      if (pending && (!pending.idempotencyKey || !Number.isSafeInteger(pending.expectedVersion) || !Array.isArray(pending.payments))) throw new Error();
      return { pending, error: "" };
    } catch { return { pending: null, error: "Không đọc được yêu cầu thu tiền đang chờ. Vui lòng đối chiếu công nợ trước khi tiếp tục." }; }
  });
  const [pending, setPending] = React.useState(initial.pending);
  const pendingRef = React.useRef(initial.pending);
  const inFlight = React.useRef(false);
  const completed = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(initial.error);
  const blocked = identity !== initialIdentity.current || Boolean(initial.error) || !scope || !userProfile?.uid;

  async function submit(payments: RetailPaymentInput[]) {
    if (blocked || inFlight.current || completed.current || !scope) return;
    const retry = Boolean(pendingRef.current);
    const request: Pending = pendingRef.current || JSON.parse(JSON.stringify({ payments, expectedVersion: order.version, idempotencyKey: crypto.randomUUID() }));
    try { sessionStorage.setItem(storageKey, JSON.stringify(request)); }
    catch { setError("Không lưu được yêu cầu để thử lại an toàn. Chưa gửi khoản thu."); return; }
    inFlight.current = true;
    pendingRef.current = request;
    setPending(request);
    setBusy(true);
    setError("");
    try {
      const updated = await retailOrdersApi.collect(scope, order._id, request.payments, { idempotencyKey: request.idempotencyKey, expectedVersion: request.expectedVersion });
      completed.current = true;
      try { sessionStorage.removeItem(storageKey); } catch { /* retain safe replay */ }
      if (mounted.current && currentIdentity.current === identity) done(updated);
    } catch (cause) {
      if (!retry && cause instanceof ApiClientError && cause.status === 400 && cause.code === "COLLECTION_INVALID") {
        try { sessionStorage.removeItem(storageKey); pendingRef.current = null; setPending(null); } catch { /* retain original request */ }
      }
      setError(getApiErrorMessage(cause, "Chưa xác định được kết quả thu tiền. Hãy thử lại yêu cầu cũ."));
    } finally { inFlight.current = false; setBusy(false); }
  }

  if (pending || blocked) return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
    <div role="dialog" aria-label="Khoản thu đang chờ" className="w-full max-w-lg rounded-2xl bg-white p-5">
      <h2 className="text-lg font-bold">Kiểm tra kết quả thu công nợ</h2>
      <p className="mt-3">Yêu cầu đã lưu được giữ nguyên để tránh ghi nhận tiền thu hai lần. Đóng cửa sổ không hủy khoản thu đã gửi.</p>
      {pending && <ul className="mt-3">{pending.payments.map((payment, index) => <li key={index}>{({ cash: "Tiền mặt", card: "Thẻ", transfer: "Chuyển khoản", ewallet: "Ví điện tử" })[payment.method]}: {new Intl.NumberFormat("vi-VN").format(payment.amount)} ₫{payment.reference ? ` · ${payment.reference}` : ""}</li>)}</ul>}
      {blocked && <p role="alert">Phạm vi đã thay đổi hoặc không đọc được yêu cầu. Vui lòng mở lại đúng đơn để đối chiếu.</p>}
      {error && <p role="alert" className="mt-3 text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3"><button onClick={close}>Đóng</button><button disabled={busy || blocked} onClick={() => void submit([])}>{busy ? "Đang xử lý..." : "Thử lại khoản thu cũ"}</button></div>
    </div>
  </div>;
  return <><PaymentDialog total={order.dueAmount} busy={busy} customerId={order.customerId} onClose={close} onSubmit={submit} />{error && <div role="alert" className="fixed bottom-4 left-4 z-[70] rounded-xl bg-white p-4 text-red-600">{error}</div>}</>;
}
