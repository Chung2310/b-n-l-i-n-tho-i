import React from "react";
import { CheckCircle2, X } from "lucide-react";
import type { RetailOrderResult, RetailSettings } from "../../types";
import ReceiptPrintView from "./ReceiptPrintViewSerial";

export default function CheckoutSuccessDialog({ result, paperSize = "80mm", onNewOrder, onClose }: { result: RetailOrderResult; paperSize?: RetailSettings["invoicePaperSize"]; onNewOrder: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4"><div role="dialog" aria-label="Thanh toán thành công" className="mx-auto max-w-lg rounded-3xl bg-white p-5"><div className="retail-no-print flex items-start justify-between"><div><CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" /><h2 className="text-xl font-bold">Thanh toán thành công</h2><p className="text-sm text-slate-500">{result.order.orderCode}</p><p className="mt-1 text-xs text-slate-500">POS chỉ in hóa đơn này một lần.</p></div><button aria-label="Đóng kết quả" onClick={onClose}><X /></button></div><ReceiptPrintView invoice={result.invoice} paperSize={paperSize} /><div className="retail-no-print mt-4"><button className="w-full rounded-xl bg-cyan-600 px-3 py-3 font-bold text-white" onClick={onNewOrder}>Đơn mới</button></div></div></div>;
}
