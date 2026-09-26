import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, Boxes, CheckCircle2, Clock, Coins, Edit3, Eye, Landmark, MoveRight, Plus, Search, Trash2, X } from "lucide-react";
import { Stats, money } from "../components/ManagementUI";
import {
  financeAssetsApi,
  type DepreciationScheduleLine,
  type FixedAsset,
} from "../api/financeAssets.api";
import { toast } from "../../../pages/Toast";

const STATUS_LABELS: Record<string, string> = {
  in_use: "Đang dùng",
  idle: "Tạm ngưng",
  repairing: "Đang sửa",
  lost: "Mất",
  damaged: "Hỏng",
  disposed: "Đã thanh lý",
};

export const canManageAssets = (permissions: readonly string[]) =>
  permissions.includes("*") || permissions.includes("asset:manage");

const vnd = (value: number) => value.toLocaleString("vi-VN") + " ₫";
const toIso = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString();
const message = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

const EMPTY_FORM = {
  assetCode: "",
  barcode: "",
  name: "",
  group: "",
  originalCost: "",
  salvageValue: "",
  inServiceDate: "",
  usefulLifeMonths: "",
  supplierName: "", department: "", purchaseDate: "",
  location: "",
};

type CreateForm = typeof EMPTY_FORM;
type CreateFormField = keyof CreateForm;
type CreateFormErrors = Partial<Record<CreateFormField, string>>;

export const validateCreateForm = (form: Omit<CreateForm, "supplierName" | "department" | "purchaseDate"> & Partial<Pick<CreateForm, "supplierName" | "department" | "purchaseDate">>): CreateFormErrors => {
  const errors: CreateFormErrors = {};
  if (!form.assetCode.trim()) errors.assetCode = "Vui lòng nhập mã tài sản.";
  if (!form.barcode.trim()) errors.barcode = "Vui lòng nhập mã vạch.";
  if (!form.name.trim()) errors.name = "Vui lòng nhập tên tài sản.";
  if (!form.group.trim()) errors.group = "Vui lòng nhập nhóm tài sản.";

  const originalCost = Number(form.originalCost);
  if (!Number.isSafeInteger(originalCost) || originalCost <= 0) {
    errors.originalCost = "Nguyên giá phải là số nguyên lớn hơn 0.";
  }

  const salvageValue = Number(form.salvageValue || 0);
  if (!Number.isSafeInteger(salvageValue) || salvageValue < 0) {
    errors.salvageValue = "Giá trị thu hồi phải là số nguyên không âm.";
  } else if (Number.isSafeInteger(originalCost) && originalCost > 0 && salvageValue > originalCost) {
    errors.salvageValue = "Giá trị thu hồi không được lớn hơn nguyên giá.";
  }
  if (!form.inServiceDate) errors.inServiceDate = "Vui lòng chọn ngày đưa vào sử dụng.";

  const usefulLifeMonths = Number(form.usefulLifeMonths);
  if (!Number.isSafeInteger(usefulLifeMonths) || usefulLifeMonths <= 0) {
    errors.usefulLifeMonths = "Số tháng khấu hao phải là số nguyên lớn hơn 0.";
  }
  return errors;
};

const EDITABLE_FIELDS = ["name", "group", "location", "custodianName", "supplierName", "department"] as const;

const editFormFrom = (asset: FixedAsset) => ({
  supplierName: asset.supplierName || "", department: asset.department || "",
  name: asset.name,
  group: asset.group,
  location: asset.location || "",
  custodianName: asset.custodianName || "",
  status: asset.status === "disposed" ? "in_use" : asset.status,
  note: "",
});

const EMPTY_TRANSFER = { branchId: "", location: "", custodianName: "", reason: "" };

export default function FixedAssetsPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [items, setItems] = useState<FixedAsset[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FixedAsset>();
  const [schedule, setSchedule] = useState<DepreciationScheduleLine[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<CreateFormErrors>({});
  const [creating, setCreating] = useState(false);
  const [panel, setPanel] = useState<"edit" | "transfer">();
  const [editForm, setEditForm] = useState(() => editFormFrom({} as FixedAsset));
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
  const [busy, setBusy] = useState(false);
  const canManage = canManageAssets(permissions);

  const closeCreateDialog = () => {
    setCreating(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  useEffect(() => {
    if (!creating) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCreateDialog();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [creating]);

  const load = async () => {
    try {
      setItems(await financeAssetsApi.list({ status: status || undefined, search: search || undefined }));
    } catch (reason) {
      toast.error(message(reason, "Không tải được danh sách tài sản."));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const open = async (asset: FixedAsset) => {
    setSelected(asset);
    setPanel(undefined);
    setEditForm(editFormFrom(asset));
    setTransferForm(EMPTY_TRANSFER);
    try {
      setSchedule(await financeAssetsApi.schedule(asset._id));
    } catch (reason) {
      toast.error(message(reason, "Không tải được lịch khấu hao."));
    }
  };

  const refresh = async (id: string) => {
    const fresh = await financeAssetsApi.detail(id);
    setSelected(fresh);
    setEditForm(editFormFrom(fresh));
    setPanel(undefined);
    await load();
  };

  const create = async () => {
    const validationErrors = validateCreateForm(form);
    const firstValidationError = Object.values(validationErrors)[0];
    if (firstValidationError) {
      setFormErrors(validationErrors);
      toast.warning(firstValidationError);
      return;
    }
    setBusy(true);
    try {
      await financeAssetsApi.create({
        assetCode: form.assetCode.trim(),
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        group: form.group.trim(),
        supplierName: form.supplierName, department: form.department,
        ...(form.purchaseDate ? { purchaseDate: toIso(form.purchaseDate) } : {}),
        originalCost: Number(form.originalCost),
        salvageValue: Number(form.salvageValue || 0),
        inServiceDate: toIso(form.inServiceDate),
        usefulLifeMonths: Number(form.usefulLifeMonths),
        ...(form.location.trim() ? { location: form.location.trim() } : {}),
      });
      closeCreateDialog();
      await load();
      toast.success("Đã thêm tài sản cố định thành công.");
    } catch (reason) {
      toast.error(message(reason, "Không tạo được tài sản."));
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!selected) return;
    const current = editFormFrom(selected);
    const patch: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) if (editForm[field] !== current[field]) patch[field] = editForm[field];
    if (editForm.status !== current.status) patch.status = editForm.status;
    if (!Object.keys(patch).length) {
      toast.warning("Chưa có thay đổi nào để lưu.");
      return;
    }
    setBusy(true);
    try {
      await financeAssetsApi.update(selected._id, { ...patch, ...(editForm.note ? { note: editForm.note } : {}) });
      await refresh(selected._id);
      toast.success("Đã cập nhật tài sản thành công.");
    } catch (reason) {
      toast.error(message(reason, "Không cập nhật được tài sản."));
    } finally {
      setBusy(false);
    }
  };

  const submitTransfer = async () => {
    if (!selected) return;
    if (!transferForm.branchId.trim() || !transferForm.reason.trim()) {
      toast.warning("Vui lòng nhập chi nhánh đến và lý do điều chuyển.");
      return;
    }
    setBusy(true);
    try {
      await financeAssetsApi.transfer(selected._id, {
        branchId: transferForm.branchId.trim(),
        reason: transferForm.reason.trim(),
        ...(transferForm.location ? { location: transferForm.location } : {}),
        ...(transferForm.custodianName ? { custodianName: transferForm.custodianName } : {}),
      });
      setTransferForm(EMPTY_TRANSFER);
      await refresh(selected._id);
      toast.success("Đã điều chuyển tài sản thành công.");
    } catch (reason) {
      toast.error(message(reason, "Không điều chuyển được tài sản."));
    } finally {
      setBusy(false);
    }
  };

  const dispose = async (asset: FixedAsset) => {
    const reason = window.prompt("Lý do thanh lý?");
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.warning("Vui lòng nhập lý do thanh lý.");
      return;
    }
    setBusy(true);
    try {
      await financeAssetsApi.dispose(asset._id, {
        disposedAt: new Date().toISOString(),
        disposalAmount: 0,
        reason: trimmedReason,
      });
      setSelected(undefined);
      await load();
      toast.success("Đã thanh lý tài sản thành công.");
    } catch (failure) {
      toast.error(message(failure, "Không thanh lý được tài sản."));
    } finally {
      setBusy(false);
    }
  };

  const active = selected && selected.status !== "disposed";

  const kpis = useMemo(() => {
    const inUse = items.filter((item) => item.status === "in_use").length;
    const idle = items.filter((item) => item.status === "idle").length;
    const disposed = items.filter((item) => item.status === "disposed").length;
    const totalOriginal = items.reduce((sum, item) => sum + (item.originalCost || 0), 0);
    const totalNet = items.reduce((sum, item) => sum + (item.netBookValue || 0), 0);
    return { inUse, idle, disposed, totalOriginal, totalNet };
  }, [items]);

  return (
    <section className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Tài sản cố định</h1>
              <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                {items.length} tài sản
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Danh mục tài sản cố định, nguyên giá, khấu hao lũy kế và giá trị còn lại theo chi nhánh.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-cyan-600/25 transition-all hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Thêm tài sản
          </button>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng tài sản</span>
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 transition-transform duration-200 group-hover:scale-105">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5 min-w-0">
            <p className="text-base sm:text-lg font-bold text-slate-900">{items.length}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="text-emerald-700 font-semibold">{kpis.inUse} đang dùng</span>
              <span>·</span>
              <span className="text-amber-700 font-semibold">{kpis.idle} chờ dùng</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-cyan-700">Tổng nguyên giá</span>
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-cyan-50 border border-cyan-100 text-cyan-600 transition-transform duration-200 group-hover:scale-105">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5 min-w-0">
            <p className="text-base sm:text-lg font-bold text-cyan-700">{vnd(kpis.totalOriginal)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Giá trị đầu tư ban đầu</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700">Giá trị còn lại</span>
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 transition-transform duration-200 group-hover:scale-105">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5 min-w-0">
            <p className="text-base sm:text-lg font-bold text-slate-900">{vnd(kpis.totalNet)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Chưa trích khấu hao</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-rose-600">Đã thanh lý</span>
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-rose-600 transition-transform duration-200 group-hover:scale-105">
              <Archive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5 min-w-0">
            <p className="text-base sm:text-lg font-bold text-rose-600">{kpis.disposed}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Đã hết vòng đời sử dụng</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm tài sản"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void load()}
            placeholder="Mã, mã vạch hoặc tên tài sản (Enter để tìm)..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
          />
        </label>
        <select
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 sm:w-56"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Create Dialog Modal */}
      {creating && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fixed-asset-create-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/75 px-6 py-4">
              <div>
                <h2 id="fixed-asset-create-title" className="text-lg font-bold text-slate-900">
                  Thêm tài sản cố định
                </h2>
                <p className="text-xs text-slate-500">Khai báo thông tin tài sản và phương pháp trích khấu hao ban đầu</p>
              </div>
              <button
                type="button"
                aria-label="Đóng popup"
                onClick={closeCreateDialog}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["assetCode", "Mã tài sản", "text", "VD: TS-001"],
                  ["barcode", "Mã vạch", "text", "Mã barcode dán trên thiết bị"],
                  ["name", "Tên tài sản", "text", "VD: Máy in nhiệt Xprinter"],
                  ["group", "Nhóm", "text", "VD: Thiết bị văn phòng"],
                  ["originalCost", "Nguyên giá", "number", "Giá mua thực tế (₫)"],
                  ["salvageValue", "Giá trị thu hồi", "number", "Giá trị ước tính khi thanh lý (₫)"],
                  ["inServiceDate", "Ngày đưa vào dùng", "date", ""],
                  ["usefulLifeMonths", "Số tháng khấu hao", "number", "VD: 24 (tháng)"],
                  ["location", "Vị trí", "text", "VD: Quầy thu ngân tầng 1"],
                  ["supplierName", "Nhà cung cấp", "text", "VD: Công ty TNHH Phân Phối"],
                  ["department", "Bộ phận sử dụng", "text", "VD: Kế toán"],
                  ["purchaseDate", "Ngày mua", "date", ""],
                ].map(([field, label, type, placeholder]) => (
                  <label key={field} className="block text-xs font-semibold text-slate-700">
                    <span>{label}</span>
                    <input
                      type={type}
                      aria-label={label}
                      placeholder={placeholder}
                      aria-invalid={Boolean(formErrors[field as CreateFormField])}
                      value={(form as Record<string, string>)[field] || ""}
                      onChange={(event) => {
                        const formField = field as CreateFormField;
                        setForm((current) => ({ ...current, [formField]: event.target.value }));
                        setFormErrors((current) => {
                          if (!current[formField]) return current;
                          const next = { ...current };
                          delete next[formField];
                          return next;
                        });
                      }}
                      className={`mt-1.5 w-full rounded-xl border px-3.5 py-2 text-sm font-medium outline-none transition-all ${
                        formErrors[field as CreateFormField]
                          ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                          : "border-slate-200 bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      }`}
                    />
                    {formErrors[field as CreateFormField] && (
                      <span className="mt-1 block text-[11px] font-normal text-red-600">
                        {formErrors[field as CreateFormField]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                disabled={busy}
                onClick={closeCreateDialog}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void create()}
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-cyan-600/20 transition-all hover:shadow-md disabled:opacity-50"
              >
                {busy ? "Đang lưu..." : "Lưu tài sản"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <div className="border-b border-slate-200/80 bg-slate-50/75 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-800">Danh sách tài sản cố định</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((asset) => (
            <button
              key={asset._id}
              type="button"
              aria-label={`Tài sản ${asset.assetCode}`}
              onClick={() => void open(asset)}
              className="grid w-full grid-cols-2 items-center gap-3 p-5 text-left text-sm transition-colors hover:bg-cyan-50/40 sm:grid-cols-5"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Mã tài sản</span>
                <b className="font-bold text-cyan-700">{asset.assetCode}</b>
                <p className="text-xs text-slate-400">{asset.barcode}</p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Tên tài sản</span>
                <span className="font-semibold text-slate-900">{asset.name}</span>
                <p className="text-xs text-slate-500">{asset.group}</p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Trạng thái</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  asset.status === "in_use"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    : asset.status === "idle"
                    ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {STATUS_LABELS[asset.status] || asset.status}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Nguyên giá</span>
                <span className="text-xs text-slate-500 block">Nguyên giá: {vnd(asset.originalCost)}</span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Còn lại</span>
                <span className="font-bold text-slate-900 block">Còn lại: {vnd(asset.netBookValue)}</span>
              </div>
            </button>
          ))}

          {!items.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Boxes className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có tài sản nào.</p>
              <p className="mt-1 text-xs text-slate-400">Nhấn nút "Thêm tài sản" để thêm tài sản mới vào hệ thống.</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Asset Details Panel */}
      {selected && (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/75 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800">
                  {selected.assetCode}
                </span>
                <span className="text-sm text-slate-400">·</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  selected.status === "in_use" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                }`}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                {selected.assetCode} · {selected.name}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManage && active && (
                <>
                  <button
                    type="button"
                    onClick={() => setPanel((value) => (value === "edit" ? undefined : "edit"))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-cyan-700 transition-colors hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel((value) => (value === "transfer" ? undefined : "transfer"))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-cyan-700 transition-colors hover:bg-slate-50"
                  >
                    <MoveRight className="h-3.5 w-3.5" />
                    Điều chuyển
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void dispose(selected)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Thanh lý
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelected(undefined)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>

          {/* Edit Form Panel */}
          {panel === "edit" && canManage && (
            <div className="border-b border-slate-200/80 bg-slate-50/40 p-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Chỉnh sửa thông tin tài sản</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["name", "Tên tài sản"],
                  ["group", "Nhóm"],
                  ["location", "Vị trí"],
                  ["custodianName", "Người giữ"],
                  ["supplierName", "Nhà cung cấp"],
                  ["department", "Bộ phận sử dụng"],
                  ["note", "Ghi chú thay đổi"],
                ].map(([field, label]) => (
                  <label key={field} className="text-xs font-semibold text-slate-700">
                    <span>{label}</span>
                    <input
                      aria-label={label}
                      value={(editForm as Record<string, string>)[field] || ""}
                      onChange={(event) => setEditForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </label>
                ))}
                <label className="text-xs font-semibold text-slate-700">
                  <span>Trạng thái</span>
                  <select
                    aria-label="Trạng thái"
                    value={editForm.status}
                    onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as any }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  >
                    <option value="in_use">Đang dùng</option>
                    <option value="idle">Tạm ngưng</option>
                    <option value="repairing">Đang sửa</option>
                    <option value="lost">Mất</option>
                    <option value="damaged">Hỏng</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitEdit()}
                  className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 disabled:opacity-50"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          )}

          {/* Transfer Form Panel */}
          {panel === "transfer" && canManage && (
            <div className="border-b border-slate-200/80 bg-slate-50/40 p-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Điều chuyển tài sản sang chi nhánh / vị trí khác</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["branchId", "Chi nhánh đến"],
                  ["location", "Vị trí mới"],
                  ["custodianName", "Người giữ mới"],
                  ["reason", "Lý do điều chuyển"],
                ].map(([field, label]) => (
                  <label key={field} className="text-xs font-semibold text-slate-700">
                    <span>{label}</span>
                    <input
                      aria-label={label}
                      value={(transferForm as Record<string, string>)[field]}
                      onChange={(event) => setTransferForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitTransfer()}
                  className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 disabled:opacity-50"
                >
                  Xác nhận điều chuyển
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid gap-3 border-b border-slate-200/80 p-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
              <span className="text-xs text-slate-500">Chi nhánh: {selected.branchId}</span>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
              <span className="text-xs text-slate-500">Đã khấu hao: {vnd(selected.accumulatedDepreciation)}</span>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
              <span className="text-xs text-slate-500">Giá trị còn lại: {vnd(selected.netBookValue)}</span>
            </div>
          </div>

          {/* Lifecycle events */}
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-900">Lịch sử biến động</h3>
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white">
              {selected.lifecycleEvents?.map((event, index) => (
                <div key={`${event.at}-${index}`} className="grid grid-cols-3 gap-2 p-4 text-xs">
                  <span className="font-semibold text-slate-800">{event.type}</span>
                  <span className="text-slate-500">{event.at?.slice(0, 10)}</span>
                  <span className="text-slate-600">{event.note || ""}</span>
                </div>
              ))}
              {!selected.lifecycleEvents?.length && (
                <p className="p-4 text-xs text-slate-500">Chưa có biến động nào.</p>
              )}
            </div>
          </div>

          {/* Depreciation Schedule */}
          <div className="border-t border-slate-200/80 p-6">
            <h3 className="text-sm font-bold text-slate-900">Lịch khấu hao</h3>
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white">
              {schedule.map((line) => (
                <div key={line.period} className="grid grid-cols-3 gap-2 p-4 text-xs">
                  <span className="font-semibold text-slate-800">{line.period}</span>
                  <span className="text-cyan-700 font-bold">{vnd(line.amount)}</span>
                  <span className="text-slate-500">Còn: {vnd(line.netBookValueAfter)}</span>
                </div>
              ))}
              {!schedule.length && (
                <p className="p-4 text-xs text-slate-500">Chưa có lịch khấu hao.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
