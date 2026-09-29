import React, { useEffect, useRef, useState } from "react";
import { inventoryTransferService, type InventoryTransfer, type TransferDestination } from "../../services/inventoryTransferService";
import { apiFetch } from "../../modules/shared/lib/apiFetch";
import type { InventoryBalance } from "../../services/inventoryReceivingService";
import { toast } from "../../pages/Toast";

type DraftLine = { key: string; variantId: string; quantity: string; codes: string };
const newLine = (): DraftLine => ({ key: crypto.randomUUID(), variantId: "", quantity: "1", codes: "" });
const labels = { in_transit: "Đang vận chuyển", received: "Đã nhận", cancelled: "Đã hủy" };
const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full";
const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50";
const currency = (value: number) => value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

export function InventoryTransferSection({ branchId, canManage }: { branchId: string; canManage: boolean }) {
  const [destinations, setDestinations] = useState<TransferDestination[]>([]);
  const [documents, setDocuments] = useState<InventoryTransfer[]>([]);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false), [fromWarehouseId, setFromWarehouseId] = useState(""), [toWarehouseId, setToWarehouseId] = useState("");
  const [balances, setBalances] = useState<InventoryBalance[]>([]), [balancesLoading, setBalancesLoading] = useState(false);
  const [reason, setReason] = useState(""), [lines, setLines] = useState<DraftLine[]>([]);
  const [cancelId, setCancelId] = useState(""), [cancelReason, setCancelReason] = useState("");
  const request = useRef<{ content: string; key: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    inventoryTransferService.destinations(branchId, controller.signal).then((data) => { if (!controller.signal.aborted) setDestinations(data); }).catch((error) => { if (!controller.signal.aborted) toast.error(error.message); });
    return () => controller.abort();
  }, [branchId]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    inventoryTransferService.list(branchId, page, status, controller.signal).then((data) => { if (!controller.signal.aborted) { setDocuments(data.items); setTotal(data.total); } }).catch((error) => { if (!controller.signal.aborted) { setDocuments([]); toast.error(error.message); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [branchId, page, status, revision]);
  useEffect(() => {
    const controller = new AbortController(); setBalances([]);
    if (!fromWarehouseId || !open) { setBalancesLoading(false); return () => controller.abort(); }
    setBalancesLoading(true);
    apiFetch<{ data: InventoryBalance[] }>("/inventory/warehouses/balances", { params: { warehouseId: fromWarehouseId }, headers: { "x-branch-id": branchId }, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setBalances(data.data.filter((item) => item.variantId && item.quantity > item.reservedQuantity && item.trackingMode !== "lot")); })
      .catch((error) => { if (!controller.signal.aborted) toast.error(error.message); })
      .finally(() => { if (!controller.signal.aborted) setBalancesLoading(false); });
    return () => controller.abort();
  }, [branchId, fromWarehouseId, open]);

  const run = async (work: () => Promise<unknown>, message: string) => {
    if (busy) return; setBusy(true);
    try { await work(); toast.success(message); setRevision((value) => value + 1); setCancelId(""); }
    catch (error: any) { toast.error(error.message || "Không thể xử lý điều chuyển."); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const target = destinations.find((item) => item._id === toWarehouseId);
    if (!target) return;
    const items = lines.map((line) => {
      const balance = balances.find((item) => item.variantId === line.variantId);
      return { productId: balance?.productId || "", variantId: line.variantId, sku: balance?.sku || "", quantity: Number(line.quantity), unitIdentifiers: line.codes.split(/[\s,;]+/).map((code) => code.trim()).filter(Boolean) };
    });
    const input = { fromWarehouseId, toBranchId: target.branchId, toWarehouseId, reason: reason.trim(), items };
    const content = JSON.stringify(input);
    if (request.current?.content !== content) request.current = { content, key: crypto.randomUUID() };
    void run(async () => { await inventoryTransferService.create(branchId, { ...input, idempotencyKey: request.current!.key }); setOpen(false); request.current = null; }, "Đã xuất hàng sang trạng thái đang vận chuyển.");
  };

  return <section className="space-y-4" aria-label="Điều chuyển kho">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-800">Điều chuyển kho</h2><p className="text-sm text-slate-500">Kho nhận xác nhận đủ nguyên phiếu. Hàng đang vận chuyển chưa thể bán.</p></div>
      {canManage && <button className={button} onClick={() => { setLines([newLine()]); setReason(""); setFromWarehouseId(""); setToWarehouseId(""); request.current = null; setOpen(true); }}>Tạo phiếu điều chuyển</button>}
    </div>
    {open && <form aria-label="Tạo phiếu điều chuyển" onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
      <fieldset disabled={busy} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Kho gửi<select required className={field} aria-label="Kho gửi" value={fromWarehouseId} onChange={(event) => { setFromWarehouseId(event.target.value); setLines([newLine()]); }}><option value="">Chọn kho gửi</option>{destinations.filter((item) => item.branchId === branchId).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
          <label>Kho nhận<select required className={field} aria-label="Kho nhận" value={toWarehouseId} onChange={(event) => setToWarehouseId(event.target.value)}><option value="">Chọn kho nhận</option>{destinations.filter((item) => item._id !== fromWarehouseId).map((item) => <option key={item._id} value={item._id}>{item.branchName} / {item.name}</option>)}</select></label>
        </div>
        {balancesLoading && <p role="status">Đang tải tồn kho gửi…</p>}
        {lines.map((line, index) => {
          const balance = balances.find((item) => item.variantId === line.variantId);
          const tracked = ["serial", "unit_barcode"].includes(balance?.trackingMode || "");
          const change = (patch: Partial<DraftLine>) => setLines((items) => items.map((item) => item.key === line.key ? { ...item, ...patch } : item));
          return <div key={line.key} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[2fr_1fr_auto]">
            <label>SKU {index + 1}<select required className={field} value={line.variantId} aria-label={`SKU ${index + 1}`} onChange={(event) => change({ variantId: event.target.value, codes: "" })}><option value="">Chọn hàng</option>{balances.filter((item) => !lines.some((other) => other.key !== line.key && other.variantId === item.variantId)).map((item) => <option key={item._id} value={item.variantId}>{item.sku} — {item.productName} (còn {item.quantity - item.reservedQuantity})</option>)}</select></label>
            <label>Số lượng<input required type="number" min={tracked ? 1 : 0.000001} step={tracked ? 1 : "any"} max={balance ? balance.quantity - balance.reservedQuantity : undefined} className={field} aria-label={`Số lượng ${index + 1}`} value={line.quantity} onChange={(event) => change({ quantity: event.target.value })} /></label>
            <button type="button" className={button} aria-label={`Xóa dòng ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((items) => items.filter((item) => item.key !== line.key))}>Xóa</button>
            {tracked && <label className="sm:col-span-3">IMEI hoặc mã nội bộ từng máy<textarea required className={field} aria-label={`Mã máy ${index + 1}`} placeholder="Mỗi mã một dòng; có thể dán nhiều mã." value={line.codes} onChange={(event) => change({ codes: event.target.value })} /></label>}
          </div>;
        })}
        <button type="button" className={button} disabled={lines.length >= 100} onClick={() => setLines((items) => [...items, newLine()])}>Thêm SKU</button>
        <label className="block">Lý do điều chuyển<textarea required className={field} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="flex gap-2"><button type="submit" disabled={balancesLoading} className={`${button} bg-cyan-700 text-white`}>{busy ? "Đang gửi…" : "Xuất chuyển kho"}</button><button type="button" className={button} onClick={() => setOpen(false)}>Đóng</button></div>
      </fieldset>
    </form>}
    <div className="flex gap-3"><select aria-label="Lọc trạng thái điều chuyển" className={field} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className={button} onClick={() => setRevision((value) => value + 1)}>Làm mới</button></div>
    {loading ? <p role="status">Đang tải phiếu điều chuyển…</p> : !documents.length ? <p>Chưa có phiếu điều chuyển phù hợp.</p> : documents.map((doc) => <details key={doc._id} className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold">{doc.transferCode} · {labels[doc.status]} · {doc.fromWarehouseName} → {doc.toWarehouseName}</summary>
      <p className="my-2 text-sm text-slate-600">{doc.reason} · {doc.createdByName} · {new Date(doc.createdAt).toLocaleString("vi-VN")}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>SKU / sản phẩm</th><th>Số lượng</th><th>Giá vốn chuyển</th><th>Mã máy</th></tr></thead><tbody>{doc.items.map((item) => <tr key={item.variantId}><td className="py-2">{item.sku} — {item.productName}</td><td>{item.quantity}</td><td>{currency(item.unitCost)}</td><td className="max-w-80 break-words">{item.unitIdentifiers.join(", ") || "—"}</td></tr>)}</tbody></table></div>
      {doc.receivedByName && <p className="text-sm">Người nhận: {doc.receivedByName}</p>}
      {doc.cancelReason && <p className="text-sm">Hủy bởi {doc.cancelledByName}: {doc.cancelReason}</p>}
      {canManage && doc.status === "in_transit" && <div className="mt-3 flex flex-wrap gap-2">
        {doc.toBranchId === branchId && <button disabled={busy} className={`${button} bg-emerald-700 text-white`} onClick={() => void run(() => inventoryTransferService.accept(branchId, doc._id), "Đã nhận đủ hàng vào kho đích.")}>Nhận đủ nguyên phiếu</button>}
        {doc.fromBranchId === branchId && <button disabled={busy} className={button} onClick={() => { setCancelId(doc._id); setCancelReason(""); }}>Hủy chuyển</button>}
      </div>}
      {cancelId === doc._id && <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void run(() => inventoryTransferService.cancel(branchId, doc._id, cancelReason), "Đã hoàn hàng về kho gửi."); }}><input required aria-label="Lý do hủy chuyển" className={field} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Lý do hủy chuyển" /><button disabled={busy} className={button}>Xác nhận hủy</button><button type="button" className={button} onClick={() => setCancelId("")}>Đóng</button></form>}
    </details>)}
    <div className="flex items-center gap-3 text-sm"><button className={button} disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>Trang {page} / {Math.max(1, Math.ceil(total / 20))} · {total} phiếu</span><button className={button} disabled={page * 20 >= total || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div>
  </section>;
}
