import React from "react";
import { socketService } from "../../../services/socketService";
import { LoaderCircle, RefreshCw, X } from "lucide-react";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailPaymentInput, RetailScope, RetailShift, RetailShiftOrderDetail, RetailShiftDetail } from "../types";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { TablePagination } from "../../../components/common/TablePagination";

type Props = { scope: RetailScope; shift: RetailShift; onClose: () => void };
type PaymentMethod = RetailPaymentInput["method"];

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const methodLabels: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};
const scheduleSourceLabels = { custom: "Giờ làm riêng của nhân viên", employee: "Ca được phân công", company: "Ca mặc định công ty", legacy: "Giờ làm chung của công ty" };
const dateTime = (value?: string | Date) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
};

export default function RetailShiftDetailDialog({ scope, shift, onClose }: Props) {
  const [detail, setDetail] = React.useState<RetailShiftDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [adjustmentsPage, setAdjustmentsPage] = React.useState(1);
  const [afterSalesPage, setAfterSalesPage] = React.useState(1);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void retailShiftsApi.detail(scope, shift._id, { page, adjustmentsPage, afterSalesPage }).then((result) => {
      if (active) setDetail(result);
    }).catch((cause) => {
      if (active) setError(getApiErrorMessage(cause, "Không tải được chi tiết phiên POS."));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId, scope.terminalId, shift._id, attempt, page, adjustmentsPage, afterSalesPage]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = (event: any) => {
      if (event?.companyCode !== scope.companyCode || event?.branchId !== scope.branchId || event?.sessionId !== shift._id) return;
      clearTimeout(timer); timer = setTimeout(() => setAttempt((value) => value + 1), 300);
    };
    const off = ["updated", "closed", "reconciled", "device-changed"].map((event) => socketService.on(`pos:session:${event}`, sync));
    off.push(socketService.onStatusChange((connected) => { if (connected) setAttempt((value) => value + 1); }));
    return () => { clearTimeout(timer); off.forEach((dispose) => dispose()); };
  }, [scope.companyCode, scope.branchId, shift._id]);
  const session = detail?.shift || shift;
  const orders = detail?.orders || [];
  const sessionOrders = orders.filter((order) => order.shiftId === shift._id);
  const soldOrders = sessionOrders.filter((order) => order.status !== "cancelled");
  const grossSales = session.grossSales ?? soldOrders.reduce((total, order) => total + Number(order.grandTotal || 0), 0);
  const collected = new Map<PaymentMethod, number>();
  const refunded = new Map<PaymentMethod, number>();
  for (const order of orders) {
    for (const payment of order.payments || []) {
      if (payment.shiftId === shift._id) collected.set(payment.method, (collected.get(payment.method) || 0) + Number(payment.amount || 0));
    }
    for (const refund of order.refunds || []) {
      if (refund.shiftId === shift._id) refunded.set(refund.method, (refunded.get(refund.method) || 0) + Number(refund.amount || 0));
    }
  }
  if (session.methodTotals) for (const row of session.methodTotals) { collected.set(row.method, row.collectedAmount); refunded.set(row.method, row.refundedAmount); }
  const buybacks = new Map<PaymentMethod, number>((detail?.buybackMethodTotals || []).map((row) => [row.method, row.amount]));
  const paymentMethods = [...new Set([...collected.keys(), ...refunded.keys(), ...buybacks.keys()])];
  const totalCollected = [...collected.values()].reduce((sum, value) => sum + value, 0);
  const totalRefunded = [...refunded.values()].reduce((sum, value) => sum + value, 0);

  const productMap = new Map<string, { sku: string; name: string; quantity: number; sales: number }>();
  for (const order of soldOrders) {
    for (const item of order.items || []) {
      const key = `${item.productId}:${item.variantId || item.sku}`;
      const row = productMap.get(key) || { sku: item.sku, name: item.productName, quantity: 0, sales: 0 };
      row.quantity += Number(item.quantity || 0);
      row.sales += Number(item.lineTotal || 0);
      productMap.set(key, row);
    }
  }
  const products = (detail?.products || [...productMap.values()]).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "vi"));

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="retail-shift-detail-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b bg-white px-5 py-4 sm:px-6">
        <div>
          <h2 id="retail-shift-detail-title" className="text-lg font-black text-slate-900">Chi tiết phiên {shift.shiftCode}</h2>
          <p className="mt-1 text-sm text-slate-500">{shift.cashierName} · {shift.businessDate} · Mở lúc {dateTime(shift.openedAt)} · {session.drawerName || "Két cũ chưa gán"}</p>
          {session.workShiftName && <p className="mt-1 text-xs text-slate-500">Ca HR: {session.workShiftName} ({session.workShiftCode}) · {session.workShiftSource ? scheduleSourceLabels[session.workShiftSource] : ""} · Ngày công {session.workShiftBusinessDate || session.businessDate} · {dateTime(session.scheduledStartAt)} – {dateTime(session.scheduledEndAt)}</p>}
        </div>
        <button type="button" aria-label="Đóng chi tiết phiên" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
      </header>

      <div className="overflow-y-auto p-4 sm:p-6">
        {loading && <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Đang tải chi tiết phiên…</div>}
        {!loading && error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 font-semibold"><RefreshCw className="h-4 w-4" />Thử tải lại</button></div>}
        {!loading && !error && detail && <>
          {detail.legacySnapshot && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Phiên cũ chưa có bản chốt chi tiết. Tổng tiền giữ theo số đã chốt; chi tiết đơn được dựng từ dữ liệu hiện tại.</p>}
          {session.status !== "open" && session.closingSnapshot && <p className="mb-4 text-sm text-slate-500">Số liệu chốt lúc {dateTime(session.closingSnapshot.capturedAt)}. Phát sinh sau đó hiển thị riêng bên dưới.</p>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Summary label="Doanh số bán" value={money(grossSales)} hint={`${detail.soldOrderCount ?? soldOrders.length} đơn bán trong phiên`} />
            <Summary label="Tiền đã thu trong phiên" value={money(totalCollected)} />
            <Summary label="Tiền đã hoàn trong phiên" value={money(totalRefunded)} />
            <Summary label="Tiền thu ròng" value={money(totalCollected - totalRefunded)} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-xl border bg-white p-4">
              <h3 className="font-bold text-slate-900">Sản phẩm đã bán</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="text-xs text-slate-500"><tr><th className="pb-2 text-left font-semibold">Sản phẩm</th><th className="pb-2 text-right font-semibold">Số lượng</th><th className="pb-2 text-right font-semibold">Tiền hàng</th></tr></thead>
                  <tbody>{products.map((product) => <tr key={`${product.sku}-${product.name}`} className="border-t"><td className="py-2 pr-3"><p className="font-semibold text-slate-800">{product.name}</p><p className="text-xs text-slate-500">{product.sku}</p></td><td className="py-2 text-right">{product.quantity}</td><td className="py-2 text-right font-semibold">{money(product.sales)}</td></tr>)}</tbody>
                </table>
                {!products.length && <p className="py-6 text-center text-sm text-slate-500">Phiên này chưa có sản phẩm bán.</p>}
              </div>
              <p className="mt-3 border-t pt-3 text-xs text-slate-500">Tiền hàng cộng theo dòng sản phẩm; doanh số phía trên lấy theo tổng giá trị đơn.</p>
            </section>

            <section className="rounded-xl border bg-white p-4">
              <h3 className="font-bold text-slate-900">Thanh toán theo phương thức</h3>
              {paymentMethods.length ? <div className="mt-3 divide-y">{paymentMethods.map((method) => <div key={method} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-3 text-sm"><span className="font-semibold text-slate-700">{methodLabels[method]}</span><span className="text-right"><span className="block text-xs text-slate-500">Đã thu</span><b>{money(collected.get(method) || 0)}</b></span><span className="text-right"><span className="block text-xs text-slate-500">Đã hoàn</span><b>{money(refunded.get(method) || 0)}</b></span><span className="text-right"><span className="block text-xs text-slate-500">Chi thu mua</span><b>{money(buybacks.get(method) || 0)}</b></span></div>)}</div> : <p className="py-6 text-center text-sm text-slate-500">Phiên này chưa ghi nhận thanh toán hoặc hoàn tiền.</p>}
              <p className="mt-3 border-t pt-3 text-xs text-slate-500">Doanh số tính theo giá trị đơn được tạo trong phiên. Tiền thu và hoàn được tính theo giao dịch thực hiện trong phiên này.</p>
            </section>
          </div>

          <section className="mt-5 rounded-xl border bg-white p-4">
            <h3 className="font-bold text-slate-900">Đơn hàng liên quan ({detail.total ?? orders.length})</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="text-xs text-slate-500"><tr><th className="pb-2 text-left font-semibold">Mã đơn / thời gian</th><th className="pb-2 text-left font-semibold">Khách hàng</th><th className="pb-2 text-left font-semibold">Nội dung phiên</th><th className="pb-2 text-right font-semibold">Doanh số</th><th className="pb-2 text-right font-semibold">Thu / hoàn</th><th className="pb-2 text-left font-semibold">Trạng thái</th></tr></thead>
                <tbody>{orders.map((order) => <OrderRow key={order._id} order={order} shiftId={shift._id} />)}</tbody>
              </table>
              {!orders.length && <p className="py-8 text-center text-sm text-slate-500">Phiên này chưa có đơn hàng.</p>}
            </div>
          </section>
          <TablePagination currentPage={page} totalPages={Math.ceil((detail.total || 0) / 20)} pageSize={20} pageSizeOptions={[20]} totalItems={detail.total || 0} itemLabel="đơn liên quan" onPageChange={setPage} onPageSizeChange={() => undefined} />
          <section className="mt-5 rounded-xl border bg-white p-4">
            <h3 className="font-bold">Phiếu trả hàng / thu mua trong phiên ({detail.afterSalesTotal || 0})</h3>
            {(detail.afterSales || []).map((receipt) => <details key={receipt._id} className="mt-3 border-t pt-3 text-sm">
              <summary className="cursor-pointer"><b>{receipt.code}</b> · {receipt.type === "return" ? "Trả hàng" : "Thu mua"} · {money(receipt.totalAmount)} · {methodLabels[receipt.paymentMethod]} · Đơn {receipt.orderCode}</summary>
              <p className="mt-2 text-slate-500">{dateTime(receipt.createdAt)} · {receipt.createdByName} · {receipt.customerName} · {receipt.reason}</p>
              {receipt.items.map((item, index) => <p key={index} className="mt-2">{item.productName} · {item.sku} · SL {item.quantity} · {money(item.lineAmount)}{item.serialNumbers?.length ? ` · IMEI: ${item.serialNumbers.join(", ")}` : ""}{item.internalBarcodes?.length ? ` · Mã máy: ${item.internalBarcodes.join(", ")}` : ""}</p>)}
            </details>)}
            {!detail.afterSalesTotal && <p className="mt-3 text-sm text-slate-500">Chưa có phiếu trả hàng hoặc thu mua.</p>}
            <TablePagination currentPage={afterSalesPage} totalPages={Math.ceil((detail.afterSalesTotal || 0) / 20)} pageSize={20} pageSizeOptions={[20]} totalItems={detail.afterSalesTotal || 0} itemLabel="phiếu trả hàng / thu mua" onPageChange={setAfterSalesPage} onPageSizeChange={() => undefined} />
            <p className="mt-3 text-xs text-slate-500">Tiền trả hàng nằm trong tổng đã hoàn. Thu mua tiền mặt được ghi thành khoản chi két, hiển thị ở phần thu/chi bên dưới.</p>
          </section>
          <section className="mt-5 rounded-xl border bg-white p-4">
            <h3 className="font-bold">Két tiền và đối soát</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><Summary label="Quỹ đầu phiên" value={money(session.openingFloat)} /><Summary label="Tiền mặt kỳ vọng" value={money(session.expectedCash || 0)} /><Summary label="Tổng còn phải thu tại phiên" value={money(session.newDebtAmount || 0)} /><Summary label="Công nợ khách" value={money(session.customerDebtAmount ?? session.newDebtAmount ?? 0)} /><Summary label="Chờ đối tác trả góp" value={money(session.financingDebtAmount || 0)} /><Summary label="Tiền thực đếm" value={session.countedCash == null ? "Chưa kiểm đếm" : money(session.countedCash)} /><Summary label="Chênh lệch" value={session.varianceAmount == null ? "—" : money(session.varianceAmount)} /><Summary label="Người duyệt" value={session.approvedByName || "Chưa duyệt"} /></div>
            {session.varianceReason && <p className="mt-3 text-sm">Lý do chênh lệch: {session.varianceReason}</p>}
            <div className="mt-3 divide-y text-sm">{(session.cashMovements || []).map((movement, index) => <p key={index} className="py-2">{dateTime(movement.at)} · {movement.byName} · {movement.type === "in" ? "Bổ sung" : "Rút"} {money(movement.amount)} · {movement.reason}</p>)}</div>
          </section>
          <section className="mt-5 rounded-xl border bg-white p-4"><h3 className="font-bold">Phát sinh sau đóng phiên ({detail.adjustmentsTotal || 0})</h3>
            {(detail.adjustments || []).map((event, index) => <div key={`${event.orderId}:${index}`} className="mt-3 border-t pt-3 text-sm"><b>{event.orderCode}</b> · {event.type === "payment" ? "Thu thêm" : event.type === "refund" ? "Hoàn tiền" : "Hủy đơn"} {money(event.amount)}{event.method && ` · ${methodLabels[event.method]}`}<p className="text-xs text-slate-500">{dateTime(event.at)} · {event.byName || "Hệ thống"}{event.needsReview && " · Cần kiểm tra khoản thu ngoài phiên"}</p></div>)}
            {!detail.adjustmentsTotal && <p className="mt-3 text-sm text-slate-500">Chưa có phát sinh sau đóng.</p>}
            <TablePagination currentPage={adjustmentsPage} totalPages={Math.ceil((detail.adjustmentsTotal || 0) / 20)} pageSize={20} pageSizeOptions={[20]} totalItems={detail.adjustmentsTotal || 0} itemLabel="phát sinh sau đóng phiên" onPageChange={setAdjustmentsPage} onPageSizeChange={() => undefined} />
          </section>
          <section className="mt-5 rounded-xl border bg-white p-4"><h3 className="font-bold">Nhật ký phiên</h3>{(session.auditLog || []).map((event, index) => <p key={index} className="mt-3 text-sm">{dateTime(event.at)} · {event.byName} · {actionLabels[event.action] || event.action}{event.detail && ` · ${event.detail}`}</p>)}</section>
        </>}
      </div>
    </section>
  </div>;
}

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>;
}

function OrderRow({ order, shiftId }: { order: RetailShiftOrderDetail; shiftId: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const soldInSession = order.shiftId === shiftId;
  const payments = (order.payments || []).filter((payment) => payment.shiftId === shiftId);
  const refunds = (order.refunds || []).filter((refund) => refund.shiftId === shiftId);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refunded = refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const methods = [...new Set([...payments.map((payment) => payment.method), ...refunds.map((refund) => refund.method)])].map((method) => methodLabels[method]).join(", ");
  const status = order.status === "cancelled" ? "Đã hủy" : order.status === "draft" ? "Đang giữ" : order.paymentStatus === "paid" ? "Đã thanh toán" : order.paymentStatus === "partial" ? "Thanh toán một phần" : order.paymentStatus === "refunded" ? "Đã hoàn tiền" : "Chưa thanh toán";
  return <><tr className="border-t align-top">
    <td className="py-3 pr-3"><button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="font-semibold text-cyan-700 underline">{order.orderCode || order._id}</button><p className="text-xs text-slate-500">{dateTime(order.createdAt)}</p></td>
    <td className="py-3 pr-3">{order.customerName || order.customerSnapshot?.name || "Khách lẻ"}</td>
    <td className="py-3 pr-3"><p>{soldInSession ? "Bán trong phiên" : "Thu/hoàn trong phiên"}</p>{methods && <p className="text-xs text-slate-500">{methods}</p>}</td>
    <td className="py-3 text-right font-semibold">{soldInSession ? money(order.status === "cancelled" ? 0 : Number(order.grandTotal || 0)) : "—"}</td>
    <td className="py-3 text-right"><p>{paid ? `+${money(paid)}` : "—"}</p>{refunded > 0 && <p className="text-xs text-rose-600">−{money(refunded)}</p>}</td>
    <td className="py-3 pl-3">{status}</td>
  </tr>{expanded && <tr><td colSpan={6} className="bg-slate-50 p-4"><div className="space-y-2 text-sm">
    {order.items.map((item, index) => <p key={index}><b>{item.productName}</b> · {item.sku} · {item.quantity} · {money(item.unitPrice)} · Giảm {money(item.discountAmount)} · Thành tiền {money(item.lineTotal)}{item.serialNumbers?.length ? ` · IMEI/serial: ${item.serialNumbers.join(", ")}` : ""}{item.internalBarcodes?.length ? ` · Mã máy: ${item.internalBarcodes.join(", ")}` : ""}</p>)}
    {(order.payments || []).map((payment, index) => <p key={`p${index}`}>Thu {money(payment.amount)} · {methodLabels[payment.method]} · {dateTime(payment.paidAt)} · {payment.receivedByName || "—"} · {payment.reference || "Không có tham chiếu"}</p>)}
    {(order.refunds || []).map((refund, index) => <p key={`r${index}`}>Hoàn {money(refund.amount)} · {methodLabels[refund.method]} · {dateTime(refund.refundedAt)} · {refund.refundedByName} · {refund.reason}</p>)}
    {order.note && <p>Ghi chú: {order.note}</p>}
    {order.installment && <p>Trả góp: {order.installment.partner} · {order.installment.months} tháng · Trả trước {order.installment.prepayPercent}% · Khoản đối tác tài trợ {money(order.installment.financedAmount || 0)}</p>}
  </div></td></tr>}</>;
}

const actionLabels: Record<string, string> = { open: "Mở phiên", close: "Đóng phiên", "midnight-close": "Tự đóng lúc 00:00", resume: "Tiếp tục/chuyển thiết bị", pause: "Đăng xuất thiết bị", "cash-movement": "Thu/chi két", "transfer-drawer": "Chuyển két", reconcile: "Duyệt đối soát", migration: "Bổ sung dữ liệu phiên cũ", "movement-revoke": "Thu hồi yêu cầu thu/chi chưa ghi nhận" };
