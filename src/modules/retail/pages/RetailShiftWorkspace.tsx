import { lockCollection } from "../components/orders/collectionRequest";
import React from "react";
import { retailShiftsApi } from "../api/retailShifts.api";
import { CurrencyInput as SharedCurrencyInput } from "../../../components/common/CurrencyInput";
import { Dropdown } from "../../../components/common/Dropdown";
import { TablePagination } from "../../../components/common/TablePagination";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailPosDrawer, RetailShift } from "../types";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { authService } from "../../../services/authService";
import { socketService } from "../../../services/socketService";
import RetailShiftDetailDialog from "./RetailShiftDetailDialog";
import RetailSettlementPanel from "./RetailSettlementPanel";
import { ShiftScheduleNotice } from "../components/ShiftScheduleNotice";

const money = (value = 0) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const statuses = { open: "Đang mở", closed: "Chờ đối soát", reconciled: "Đã đối soát" };
export default function RetailShiftWorkspace() {
  const { scope, userProfile } = useRetailScope();
  const [cashiers, setCashiers] = React.useState<Array<{ id: string; name: string }>>([]);
  const [drawers, setDrawers] = React.useState<RetailPosDrawer[]>([]);
  const [cashierId, setCashierId] = React.useState("");
  const [openingFloat, setOpeningFloat] = React.useState(0);
  const [drawerCode, setDrawerCode] = React.useState("");
  const [drawerName, setDrawerName] = React.useState("");
  const [openScheduleError, setOpenScheduleError] = React.useState<unknown>(null);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [items, setItems] = React.useState<RetailShift[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [filters, setFilters] = React.useState({ businessDate: "", cashierId: "", status: "", page: 1 });
  const [detail, setDetail] = React.useState<RetailShift | null>(null);
  const [operation, setOperation] = React.useState<{ shift: RetailShift; type: "close" | "cash" | "drawer" } | null>(null);
  const [countedCash, setCountedCash] = React.useState(0);
  const [deferCount, setDeferCount] = React.useState(false);
  const [movementType, setMovementType] = React.useState<"in" | "out">("in");
  const [amount, setAmount] = React.useState(0);
  const [reversesKey, setReversesKey] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [targetDrawer, setTargetDrawer] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const request = React.useRef(0);
  const movementRequest = React.useRef<{ reversesKey?: string; idempotencyKey: string; type: "in" | "out"; amount: number; reason: string } | null>(null);
  const showError = React.useCallback((cause: unknown) => setError(getApiErrorMessage(cause, "Không xử lý được phiên POS.")), []);
  const refresh = React.useCallback(async () => {
    if (!scope) return;
    const id = ++request.current;
    try {
      const result = await retailShiftsApi.list(scope, { ...filters, businessDate: filters.businessDate || undefined, cashierId: filters.cashierId || undefined, status: filters.status || undefined, limit: pageSize });
      if (request.current === id) { setItems(result.items); setTotal(result.total); }
    } catch (cause) { if (request.current === id) showError(cause); }
  }, [scope?.companyCode, scope?.branchId, filters, pageSize, showError]);
  const refreshOptions = React.useCallback(async () => {
    if (!scope) return;
    setOptionsLoading(true);
    try {
      const [employees, posCashiers, cashDrawers] = await Promise.all([
        authService.getUsersByCompany(scope.companyCode, scope.branchId),
        retailShiftsApi.cashiers(scope),
        retailShiftsApi.drawers(scope),
      ]);
      const posCashierIds = new Set(posCashiers.map((cashier) => cashier.id));
      setCashiers(employees
        .filter((employee) => employee.isActive !== false && posCashierIds.has(employee.uid))
        .map((employee) => ({ id: employee.uid, name: employee.displayName || employee.email })));
      setDrawers(cashDrawers);
    }
    catch (cause) { showError(cause); }
    finally { setOptionsLoading(false); }
  }, [scope?.companyCode, scope?.branchId, showError]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => { setCashierId(""); setOperation(null); setDetail(null); void refreshOptions(); }, [refreshOptions]);
  React.useEffect(() => {
    const sync = (event: any) => { if (event?.companyCode === scope?.companyCode && event?.branchId === scope?.branchId) void refresh(); };
    const off = ["opened", "closed", "reconciled", "updated", "device-changed"].map((event) => socketService.on(`pos:session:${event}`, sync));
    off.push(socketService.onStatusChange((value) => { if (value) void refresh(); }));
    return () => off.forEach((dispose) => dispose());
  }, [scope?.companyCode, scope?.branchId, refresh]);

  const open = async (event: React.FormEvent) => {
    event.preventDefault(); if (!scope || busy || !cashierId || !Number.isSafeInteger(openingFloat) || openingFloat < 0) return; setBusy(true); setOpenScheduleError(null); setError("");
    try { await retailShiftsApi.open(scope, { cashierId, openingFloat }); setOpeningFloat(0); setCashierId(""); await refresh(); }
    catch (cause) { setOpenScheduleError(cause); } finally { setBusy(false); }
  };
  const createDrawer = async (event: React.FormEvent) => {
    event.preventDefault(); if (!scope || busy) return; setBusy(true); setError("");
    try { await retailShiftsApi.createDrawer(scope, { code: drawerCode, name: drawerName }); setDrawerCode(""); setDrawerName(""); await refreshOptions(); }
    catch (cause) { showError(cause); } finally { setBusy(false); }
  };
  const operate = async (event: React.FormEvent) => {
    event.preventDefault(); if (!scope || !operation || busy) return; setBusy(true); setError("");
    try {
      if (operation.type === "close") await retailShiftsApi.close(scope, operation.shift._id, { countedCash: deferCount ? undefined : countedCash, varianceReason: reason || undefined });
      else if (operation.type === "drawer") await retailShiftsApi.transferDrawer(scope, operation.shift._id, { drawerId: targetDrawer, reason });
      else {
        if (!movementRequest.current && (!Number.isSafeInteger(amount) || amount <= 0 || !reason.trim())) throw new Error("Nhập số tiền nguyên dương và lý do thu/chi.");
        const key = `retail-pos-movement:v1:${JSON.stringify([scope.companyCode, scope.branchId, userProfile?.uid, operation.shift._id])}`;
        await lockCollection(key, async () => {
          const raw = localStorage.getItem(key);
          if (raw && !movementRequest.current) {
            const saved = JSON.parse(raw);
            movementRequest.current = saved; setMovementType(saved.type); setAmount(saved.amount); setReason(saved.reason); setReversesKey(saved.reversesKey || "");
            throw new Error("Đã tìm thấy giao dịch đang chờ ở tab khác. Kiểm tra rồi thử lại yêu cầu đã lưu.");
          }
          movementRequest.current ||= { idempotencyKey: crypto.randomUUID(), type: movementType, amount, reason, ...(reversesKey ? { reversesKey } : {}) };
          const body = JSON.stringify(movementRequest.current);
          if (raw && raw !== body) throw new Error("Giao dịch đã thay đổi ở tab khác. Đóng rồi mở lại để kiểm tra.");
          localStorage.setItem(key, body);
          if (localStorage.getItem(key) !== body) throw new Error("Không lưu được giao dịch két. Chưa gửi giao dịch.");
          await retailShiftsApi.moveCash(scope, operation.shift._id, movementRequest.current);
          localStorage.removeItem(key); movementRequest.current = null;
        });
      }
      setOperation(null); await refresh();
    } catch (cause) { showError(cause); } finally { setBusy(false); }
  };
  const begin = (shift: RetailShift, type: "close" | "cash" | "drawer") => {
    setOperation({ shift, type }); setCountedCash(0); setDeferCount(false); setReason(""); setAmount(0); setReversesKey(""); setTargetDrawer(""); setError(""); movementRequest.current = null;
    if (type === "cash" && scope) {
      try {
        const raw = localStorage.getItem(`retail-pos-movement:v1:${JSON.stringify([scope.companyCode, scope.branchId, userProfile?.uid, shift._id])}`);
        if (raw) {
          const saved = JSON.parse(raw);
          if (!saved.idempotencyKey || !["in", "out"].includes(saved.type) || !Number.isSafeInteger(saved.amount) || saved.amount <= 0 || typeof saved.reason !== "string") throw new Error("Bản lưu giao dịch két bị lỗi. Giữ bản lưu để đối chiếu.");
          movementRequest.current = saved; setMovementType(saved.type); setAmount(saved.amount); setReason(saved.reason); setReversesKey(saved.reversesKey || "");
        }
      } catch (cause) { setOperation(null); showError(cause); }
    }
  };
  const hasPendingMovement = (id: string) => {
    try { return Boolean(localStorage.getItem(`retail-pos-movement:v1:${JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, id])}`)); }
    catch { return false; }
  };
  const reconcileMovement = async (revoke: boolean) => {
    if (!scope || !operation || !movementRequest.current || busy) return;
    setBusy(true); setError("");
    try {
      const key = `retail-pos-movement:v1:${JSON.stringify([scope.companyCode, scope.branchId, userProfile?.uid, operation.shift._id])}`;
      await lockCollection(key, async () => {
        const saved = movementRequest.current!;
        if (localStorage.getItem(key) !== JSON.stringify(saved)) throw new Error("Bản lưu thay đổi. Đóng và mở lại giao dịch để kiểm tra.");
        const result = await retailShiftsApi.reconcileMovement(scope, operation.shift._id, saved, revoke);
        if (result.status === "completed" || result.status === "revoked") { localStorage.removeItem(key); movementRequest.current = null; setOperation(null); await refresh(); }
        else setError(result.message);
      });
    } catch (cause) { showError(cause); } finally { setBusy(false); }
  };
  const setFilter = (key: "businessDate" | "cashierId" | "status", value: string) => setFilters((old) => ({ ...old, [key]: value, page: 1 }));
  if (!scope) return <p>Vui lòng chọn chi nhánh.</p>;
  return <section className="mx-auto max-w-7xl space-y-5">
    <header><h1 className="text-xl font-bold">Phiên POS và két tiền</h1><p className="text-sm text-slate-500">Giao phiên cho nhân viên, quản lý két và theo dõi bán hàng. Phiên tự đóng lúc 00:00.</p></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <form onSubmit={(event) => void open(event)} className="rounded-2xl border bg-white p-5">
      <h2 className="font-bold">Mở phiên cho nhân viên</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select label="Nhân viên bán hàng" placeholder="Chọn nhân viên" value={cashierId} onChange={(value) => { setCashierId(value); setOpenScheduleError(null); }} options={cashiers.map((user) => ({ value: user.id, label: user.name }))} />
        <MoneyField label="Tiền nhận đầu ca" value={openingFloat} onChange={setOpeningFloat} />
      </div>
      {!optionsLoading && !error && cashiers.length === 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Chưa có nhân viên POS ở chi nhánh này. Trong Nhân sự, chọn vai trò “Nhân viên bán hàng POS” và gán đúng chi nhánh cho tài khoản.</p>}
      {openScheduleError && <ShiftScheduleNotice error={openScheduleError} subject="employee" />}
      <button disabled={busy || !cashierId || !Number.isSafeInteger(openingFloat) || openingFloat < 0} className="mt-4 rounded-xl bg-cyan-700 px-5 py-2.5 font-bold text-white disabled:opacity-50">Mở phiên</button>
    </form>
    <details className="rounded-2xl border bg-white p-5" open={!drawers.length}><summary className="cursor-pointer font-bold">Thiết lập quầy / két</summary>
      <form onSubmit={(event) => void createDrawer(event)} className="mt-4 flex flex-wrap items-end gap-3"><Field label="Mã két" value={drawerCode} onChange={setDrawerCode} /><Field label="Tên két" value={drawerName} onChange={setDrawerName} /><button disabled={busy || !drawerCode.trim() || !drawerName.trim()} className="rounded-xl border px-4 py-2 disabled:opacity-50">Thêm két</button></form>
    </details>
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex justify-between"><h2 className="font-bold">Phiên bán hàng</h2><button type="button" onClick={() => void refresh()} className="rounded-lg border px-3 py-1 text-sm">Làm mới</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Ngày kinh doanh" type="date" value={filters.businessDate} onChange={(value) => setFilter("businessDate", value)} /><Select label="Lọc nhân viên" value={filters.cashierId} onChange={(value) => setFilter("cashierId", value)} options={cashiers.map((user) => ({ value: user.id, label: user.name }))} /><Select label="Trạng thái phiên" value={filters.status} onChange={(value) => setFilter("status", value)} options={Object.entries(statuses).map(([value, label]) => ({ value, label }))} /></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr>{["Nhân viên / phiên", "Ngày / két", "Trạng thái", "Đơn / doanh số", "Đã thu / nợ", "Kiểm đếm / lệch", "Thao tác"].map((text) => <th key={text} className="p-2 text-left">{text}</th>)}</tr></thead>
        <tbody>{items.map((shift) => <tr key={shift._id} className="border-t align-top"><td className="p-2"><b>{shift.cashierName}</b><p className="text-xs text-slate-500">{shift.shiftCode}</p></td><td className="p-2">{shift.businessDate}<p>{shift.drawerName || "Két cũ chưa được gán"}</p>{shift.workShiftName && <p className="text-xs text-slate-500">{shift.workShiftName} ({shift.workShiftCode})</p>}</td><td className="p-2">{statuses[shift.status]}{shift.closingMode === "midnight" && <p className="text-xs text-amber-700">Tự đóng 00:00</p>}</td><td className="p-2">{money(shift.grossSales)}{(shift.soldOrderCount ?? shift.closingSnapshot?.soldOrderCount) != null && <p>{shift.soldOrderCount ?? shift.closingSnapshot?.soldOrderCount} đơn</p>}</td><td className="p-2">{money(shift.collectedAmount)}<p className="text-xs">Nợ tại phiên: {money(shift.newDebtAmount)}</p></td><td className="p-2">{shift.countedCash == null ? "Chưa kiểm đếm" : money(shift.countedCash)}<p>{shift.varianceAmount == null ? "—" : money(shift.varianceAmount)}</p></td><td className="p-2"><div className="flex flex-wrap gap-2"><Action onClick={() => setDetail(shift)}>Chi tiết</Action>{hasPendingMovement(shift._id) && <Action onClick={() => begin(shift, "cash")}>Đối chiếu thu/chi</Action>}{shift.status === "open" && <><Action onClick={() => begin(shift, "cash")}>Thu / chi két</Action><Action onClick={() => begin(shift, "drawer")}>Chuyển két</Action><Action onClick={() => begin(shift, "close")}>Đóng phiên</Action></>}</div></td></tr>)}</tbody>
      </table>{!items.length && <p className="py-8 text-center text-slate-500">Chưa có phiên phù hợp.</p>}</div>
      <TablePagination currentPage={filters.page} totalPages={Math.ceil(total / pageSize)} pageSize={pageSize} totalItems={total} itemLabel="phiên POS" onPageChange={(page) => setFilters((old) => ({ ...old, page }))} onPageSizeChange={setPageSize} />
    </div>
    <RetailSettlementPanel scope={scope} />
    {detail && <RetailShiftDetailDialog scope={scope} shift={detail} onClose={() => setDetail(null)} />}
    {operation && <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 p-4"><form role="dialog" aria-modal="true" aria-label="Quản lý phiên" onSubmit={(event) => void operate(event)} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5">
      <h2 className="font-bold">{operation.type === "close" ? "Đóng phiên" : operation.type === "cash" ? "Thu / chi két" : "Chuyển két"} · {operation.shift.cashierName}</h2>
      {operation.type === "close" ? <><label className="flex gap-2 text-sm"><input type="checkbox" checked={deferCount} onChange={(event) => setDeferCount(event.target.checked)} />Đóng phiên trước, kiểm đếm sau</label>{!deferCount && <MoneyField label="Tiền thực đếm" value={countedCash} onChange={setCountedCash} />}</> : operation.type === "drawer" ? <><p className="text-sm text-slate-500">Chuyển toàn bộ quỹ hiện có của phiên sang két được chọn.</p><Select label="Két mới" placeholder="Chọn két" value={targetDrawer} onChange={setTargetDrawer} options={drawers.map((drawer) => ({ value: drawer._id, label: drawer.name }))} /></> : <><Select label="Điều chỉnh giao dịch gốc (nếu có)" placeholder="Không điều chỉnh giao dịch gốc" value={reversesKey} onChange={(value) => { if (movementRequest.current) return; setReversesKey(value); const source = operation.shift.cashMovements?.find((movement) => movement.key === value); if (source) { setMovementType(source.type === "in" ? "out" : "in"); setAmount(source.amount); setReason(`Điều chỉnh: ${source.reason}`); } }} options={(operation.shift.cashMovements || []).filter((movement) => movement.key && !movement.reversesKey && !operation.shift.cashMovements?.some((row) => row.reversesKey === movement.key)).map((movement) => ({ value: movement.key!, label: `${movement.type === "in" ? "Bổ sung" : "Rút"} ${money(movement.amount)} · ${movement.reason}` }))} /><Select label="Loại phát sinh" value={movementType} onChange={(value) => { if (!movementRequest.current && !reversesKey) setMovementType(value as "in" | "out"); }} options={[{ value: "in", label: "Bổ sung tiền" }, { value: "out", label: "Rút tiền" }]} /><MoneyField label="Số tiền" value={amount} onChange={(value) => { if (!movementRequest.current && !reversesKey) setAmount(value); }} />{movementRequest.current && <p className="text-xs text-amber-700">Đã giữ nguyên giao dịch để thử lại. Nội dung gửi lại giữ nguyên lần đầu.</p>}</>}
      <Field label={operation.type === "close" ? "Lý do chênh lệch (nếu có)" : "Lý do"} value={reason} onChange={(value) => { if (!movementRequest.current) setReason(value); }} />
      {operation.type === "cash" && movementRequest.current && <div className="flex flex-wrap gap-2 text-sm"><button type="button" disabled={busy} onClick={() => void reconcileMovement(false)} className="rounded-lg border px-3 py-2">Đối chiếu giao dịch</button><button type="button" disabled={busy} onClick={() => void reconcileMovement(true)} className="rounded-lg border px-3 py-2">Thu hồi yêu cầu chưa ghi nhận</button></div>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOperation(null)} className="rounded-xl border px-4 py-2">Đóng</button><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Xác nhận"}</button></div>
    </form></div>}
  </section>;
}
function Action({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-lg border px-2 py-1 text-xs font-semibold">{children}</button>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block text-sm font-medium">{label}<input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>; }
function Select({ label, placeholder, value, options, onChange }: { label: string; placeholder?: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) { return <Dropdown label={label} value={value} onChange={onChange} options={options} placeholder={placeholder || "Chọn…"} variant="form" size="md" className="w-full" searchable />; }
function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="block min-w-0"><span className="block text-xs font-bold text-slate-700">{label}</span><SharedCurrencyInput aria-label={label} value={value} onChange={(next) => onChange(next)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20" /></label>; }
