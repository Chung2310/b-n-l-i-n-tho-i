import React, { useEffect, useMemo, useState } from "react";
import { Package, RotateCw, Search, UserCheck } from "lucide-react";
import { Dropdown, type DropdownOption } from "../../components/common/Dropdown";
import { toast } from "../../pages/Toast";
import { authService } from "../../services/authService";
import { apiFetch } from "../shared/lib/apiFetch";
import {
  repairExtras,
  repairService,
  type RepairNotification,
  type RepairPart,
  type RepairPartBilling,
  type RepairRatingCriteria,
  type RepairTicket,
} from "../../services/repairService";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const date = (value?: string) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const BILLING_LABEL: Record<string, string> = {
  customer: "Khách trả",
  warranty_shop: "Bảo hành cửa hàng",
  warranty_supplier: "Bảo hành NCC",
};
const NOTIFY_LABEL: Record<string, string> = {
  received: "1. Nhận máy",
  technician_assigned: "2. Giao thợ",
  done: "3. Sửa xong",
  delivered: "4. Bàn giao & Cảm ơn",
};
const NOTIFY_STATUS: Record<string, string> = { sent: "Đã gửi", failed: "Lỗi", skipped: "Bỏ qua" };
const CRITERIA: Array<{ key: keyof RepairRatingCriteria; label: string }> = [
  { key: "skill", label: "Tay nghề" },
  { key: "attitude", label: "Thái độ" },
  { key: "speed", label: "Tốc độ" },
];

const BILLING_OPTIONS: DropdownOption<RepairPartBilling>[] = [
  { value: "customer", label: "Khách trả (sửa chữa)" },
  { value: "warranty_shop", label: "Bảo hành cửa hàng" },
  { value: "warranty_supplier", label: "Bảo hành NCC" },
];

const RATING_OPTIONS: DropdownOption<number>[] = [
  { value: 5, label: "5 sao (Rất hài lòng)" },
  { value: 4, label: "4 sao (Hài lòng)" },
  { value: 3, label: "3 sao (Bình thường)" },
  { value: 2, label: "2 sao (Chưa hài lòng)" },
  { value: 1, label: "1 sao (Kém)" },
];

const CRITERIA_OPTIONS: DropdownOption<string>[] = [
  { value: "", label: "— Chưa chấm —" },
  { value: "5", label: "5 sao" },
  { value: "4", label: "4 sao" },
  { value: "3", label: "3 sao" },
  { value: "2", label: "2 sao" },
  { value: "1", label: "1 sao" },
];

function Section({
  title,
  children,
  action,
  className = "",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2.5">
        <div className="font-bold text-slate-900 text-sm">{title}</div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Phân công kỹ thuật viên: tự động lưu khi chọn trong Dropdown */
function TechnicianPicker({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  const [people, setPeople] = useState<Array<{ uid: string; displayName?: string; email?: string }>>([]);
  const [currentTechId, setCurrentTechId] = useState(ticket.technicianId || "");
  const [currentTechName, setCurrentTechName] = useState(ticket.technicianName || "");
  const [currentAssignedAt, setCurrentAssignedAt] = useState(ticket.assignedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentTechId(ticket.technicianId || "");
    setCurrentTechName(ticket.technicianName || "");
    setCurrentAssignedAt(ticket.assignedAt);
  }, [ticket.technicianId, ticket.technicianName, ticket.assignedAt]);

  useEffect(() => {
    void authService
      .getColleagues()
      .then((items) => setPeople(items as any))
      .catch(() => setPeople([]));
  }, []);

  const handleSelectTechnician = async (techId: string) => {
    if (!techId) return;
    if (techId === currentTechId) return;

    // Optimistic update: instantly update UI
    const previousTechId = currentTechId;
    const previousTechName = currentTechName;
    const previousAssignedAt = currentAssignedAt;

    const matchedPerson = people.find((p) => String(p.uid || (p as any)._id) === techId);
    const newName = matchedPerson ? (matchedPerson.displayName || matchedPerson.email || matchedPerson.uid) : "";
    const newDate = new Date().toISOString();

    setCurrentTechId(techId);
    setCurrentTechName(newName);
    setCurrentAssignedAt(newDate);

    setBusy(true);
    setError("");
    try {
      const updatedTicket = await repairExtras.assignTechnician(ticket._id, techId);
      if (updatedTicket) {
        if (updatedTicket.technicianId !== undefined) setCurrentTechId(updatedTicket.technicianId || "");
        if (updatedTicket.technicianName !== undefined) setCurrentTechName(updatedTicket.technicianName || "");
        if (updatedTicket.assignedAt !== undefined) setCurrentAssignedAt(updatedTicket.assignedAt);
      }
      toast.success(`Đã phân công: ${newName || "Kỹ thuật viên"}`);
      onChanged();
    } catch (e) {
      // Revert on failure
      setCurrentTechId(previousTechId);
      setCurrentTechName(previousTechName);
      setCurrentAssignedAt(previousAssignedAt);
      const errMsg = e instanceof Error ? e.message : "Không thể phân công kỹ thuật viên.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setBusy(false);
    }
  };

  const technicianOptions: DropdownOption<string>[] = useMemo(() => [
    { value: "", label: "— Chọn kỹ thuật viên phụ trách —", disabled: true },
    ...people.map((person) => ({
      value: String(person.uid || (person as any)._id || ""),
      label: person.displayName || person.email || person.uid,
      sublabel: person.displayName && person.email ? person.email : undefined,
    })),
  ], [people]);

  return (
    <div className="relative z-20 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 text-sm">
              👨‍🔧
            </span>
            <b className="font-bold text-slate-900 text-sm">Kỹ thuật viên phụ trách</b>
          </div>
          {busy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 border border-cyan-200/70">
              <RotateCw className="h-3 w-3 animate-spin" />
              Đang lưu tự động...
            </span>
          ) : currentTechName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Đang phụ trách
            </span>
          ) : null}
        </div>

        {currentTechName && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 truncate">
              <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">
                Hiện tại: <strong className="text-slate-900 font-bold">{currentTechName}</strong>
              </span>
            </div>
            <span className="text-slate-400 text-[11px] shrink-0 ml-1">· {date(currentAssignedAt)}</span>
          </div>
        )}

        <div className="mt-3">
          <Dropdown<string>
            value={currentTechId}
            onChange={(val) => void handleSelectTechnician(val)}
            options={technicianOptions}
            placeholder="— Chọn kỹ thuật viên phụ trách —"
            variant="default"
            size="md"
            searchable={people.length > 4}
            searchPlaceholder="Tìm kỹ thuật viên..."
            className="w-full"
            triggerClassName="w-full justify-between py-2.5 px-3.5 rounded-xl border border-slate-300 bg-white hover:border-slate-400 text-slate-800 shadow-2xs font-normal"
            menuClassName="w-full min-w-[260px] shadow-xl"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>⚡ Tự động lưu ngay khi chọn</span>
            {busy && <span className="text-cyan-600 font-semibold animate-pulse">Đang đồng bộ...</span>}
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
}

const defaultBillingFor = (costBearer?: string): RepairPartBilling =>
  costBearer === "supplier" ? "warranty_supplier" : costBearer === "shop" ? "warranty_shop" : "customer";

type PartSearchHit = { _id: string; sku: string; name: string; price?: number; costPrice?: number; stock?: number };

const parseDigits = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/\D/g, "");
  return clean ? Number(clean) : 0;
};

const formatCurrencyInput = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "";
  const clean = String(val).replace(/\D/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("vi-VN");
};

const handleCurrencyChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (val: string) => void
) => {
  const input = e.target;
  const rawVal = input.value;
  const cursorPos = input.selectionStart ?? rawVal.length;

  const digitsBeforeCursor = rawVal.slice(0, cursorPos).replace(/\D/g, "").length;
  const formatted = formatCurrencyInput(rawVal);
  setter(formatted);

  if (typeof input.setSelectionRange === "function") {
    requestAnimationFrame(() => {
      let newPos = 0;
      let countedDigits = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          countedDigits++;
        }
        if (countedDigits === digitsBeforeCursor) {
          newPos = i + 1;
          break;
        }
      }
      if (countedDigits < digitsBeforeCursor) {
        newPos = formatted.length;
      }
      input.setSelectionRange(newPos, newPos);
    });
  }
};

function IssuePartForm({ ticket, onIssued }: { ticket: RepairTicket; onIssued: () => void }) {
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartSearchHit[]>([]);
  const [selected, setSelected] = useState<PartSearchHit | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [billing, setBilling] = useState<RepairPartBilling>(defaultBillingFor(ticket.coverage.costBearer));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleManual = (value: boolean) => {
    setManual(value);
    setSelected(null);
    setResults([]);
    setQuery("");
    setManualName("");
    setManualSku("");
    setUnitCost("0");
    setUnitPrice("0");
    setError("");
  };

  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (value: string) => {
    setQuery(value);
    setSelected(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch<{ success: boolean; data: PartSearchHit[] }>("/crud/products", {
          params: { search: value.trim(), limit: 10 },
        });
        setResults(res.data || []);
      } catch {
        setResults([]);
      }
    }, 1000);
  };

  const pick = (product: PartSearchHit) => {
    setSelected(product);
    setResults([]);
    setQuery(product.name);
    setUnitCost(formatCurrencyInput(product.costPrice ?? 0));
    setUnitPrice(formatCurrencyInput(product.price ?? 0));
  };

  const ready = manual ? manualName.trim().length > 0 : Boolean(selected);

  const submit = async () => {
    if (!ready) {
      setError(manual ? "Nhập tên linh kiện." : "Chọn linh kiện từ kho trước.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Số lượng không hợp lệ.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const key = `repair:${ticket._id}:part:${manual ? "manual" : selected!._id}:${Date.now()}`;
      await repairService.issuePart(ticket._id, {
        productId: manual ? key : selected!._id,
        sku: manual ? manualSku.trim() || "MANUAL" : selected!.sku,
        productName: manual ? manualName.trim() : selected!.name,
        quantity,
        unitCost: parseDigits(unitCost),
        unitPrice: parseDigits(unitPrice),
        billing,
        manual,
        idempotencyKey: key,
      });
      toggleManual(manual);
      setQuantity(1);
      onIssued();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xuất được linh kiện.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-3.5">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={manual}
          onChange={(e) => toggleManual(e.target.checked)}
          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
        />
        <span>Linh kiện không có trong kho (phụ kiện rời / 0đ) — cho phép nhập tay, không trừ tồn kho</span>
      </label>

      {manual ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            <span>Tên linh kiện <span className="text-rose-500">*</span></span>
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="VD: Ốc vít, keo dán, dây nguồn kèm theo..."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            <span>Mã (tuỳ chọn)</span>
            <input
              value={manualSku}
              onChange={(e) => setManualSku(e.target.value)}
              placeholder="VD: LK-PIN-01 (tùy chọn)"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
            />
          </label>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => void search(e.target.value)}
              placeholder="Tìm thiết bị thay thế trong kho theo tên hoặc SKU (VD: Màn hình, Pin...)..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm font-medium shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
            />
          </div>
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              {results.map((product) => (
                <button
                  type="button"
                  key={product._id}
                  onClick={() => pick(product)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <div>
                    <b className="text-slate-900 font-bold">{product.name}</b>
                    <div className="text-[11px] text-slate-400">SKU: {product.sku}</div>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      Tồn: {product.stock ?? 0}
                    </span>
                    {Number(product.price || 0) > 0 && (
                      <div className="text-[11px] font-bold text-cyan-700 mt-0.5">
                        {money(product.price || 0)} đ
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {ready && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="flex flex-col gap-1 text-xs font-bold text-slate-700">
            <label htmlFor="part-qty-input">Số lượng</label>
            <div className="flex items-center rounded-xl border border-slate-300 bg-white shadow-2xs overflow-hidden focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-2.5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer select-none"
                aria-label="Giảm số lượng"
              >
                −
              </button>
              <input
                id="part-qty-input"
                type="number"
                min={1}
                aria-label="Số lượng"
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setQuantity(isNaN(val) || val < 1 ? 1 : val);
                }}
                className="w-full text-center py-2 text-sm font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="px-2.5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer select-none"
                aria-label="Tăng số lượng"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs font-bold text-slate-700">
            <label htmlFor="part-cost-input">Giá vốn (VNĐ)</label>
            <div className="relative">
              <input
                id="part-cost-input"
                type="text"
                inputMode="numeric"
                aria-label="Giá vốn"
                value={unitCost}
                onChange={(e) => handleCurrencyChange(e, setUnitCost)}
                placeholder="VD: 150.000"
                className="w-full rounded-xl border border-slate-300 bg-white pl-3 pr-7 py-2 text-sm font-bold text-slate-900 shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                đ
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <button
                type="button"
                onClick={() => setUnitCost("0")}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                0đ
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs font-bold text-slate-700">
            <label htmlFor="part-price-input">Giá thu khách (VNĐ)</label>
            <div className="relative">
              <input
                id="part-price-input"
                type="text"
                inputMode="numeric"
                aria-label="Giá thu khách"
                value={unitPrice}
                onChange={(e) => handleCurrencyChange(e, setUnitPrice)}
                placeholder="VD: 250.000"
                className="w-full rounded-xl border border-slate-300 bg-white pl-3 pr-7 py-2 text-sm font-bold text-slate-900 shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                đ
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <button
                type="button"
                onClick={() => setUnitPrice("0")}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer border border-emerald-200"
              >
                0đ (Free / BH)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs font-bold text-slate-700">
            <span>Diện chi phí</span>
            <Dropdown<RepairPartBilling>
              value={billing}
              onChange={setBilling}
              options={BILLING_OPTIONS}
              variant="default"
              size="md"
              className="w-full"
              triggerClassName="w-full justify-between py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
              menuClassName="w-full min-w-[200px]"
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-700 font-medium">{error}</p>}

      <button
        type="button"
        disabled={busy || !ready}
        onClick={() => void submit()}
        className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-cyan-700 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
      >
        {busy ? (
          <>
            <RotateCw className="h-4 w-4 animate-spin" />
            <span>Đang xuất...</span>
          </>
        ) : (
          <>
            <Package className="h-4 w-4" />
            <span>{manual ? "Thêm linh kiện (không trừ kho)" : "Xuất linh kiện từ kho"}</span>
          </>
        )}
      </button>
    </div>
  );
}

function PartsSection({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  const [parts, setParts] = useState<RepairPart[]>([]);
  const [busyId, setBusyId] = useState("");
  const load = () =>
    repairService
      .parts(ticket._id)
      .then((items) => setParts(items as RepairPart[]))
      .catch(() => setParts([]));
  useEffect(() => {
    void load();
  }, [ticket._id]);
  const canIssue = ["approved", "repairing"].includes(ticket.status);

  const returnPart = async (part: RepairPart) => {
    const reason = window.prompt("Lý do hoàn linh kiện?", "");
    if (reason === null) return;
    setBusyId(part._id);
    try {
      await repairService.returnPart(ticket._id, part._id, reason);
      await load();
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không hoàn được linh kiện.");
    } finally {
      setBusyId("");
    }
  };

  const issuedParts = parts.filter((p) => p.status === "issued");
  const warrantyParts = issuedParts.filter((p) => !p.chargeable);
  const billableParts = issuedParts.filter((p) => p.chargeable);
  const totalWarrantyValue = warrantyParts.reduce(
    (sum, p) => sum + Number(p.unitPrice || 0) * Number(p.quantity || 0),
    0
  );
  const totalBillableValue = billableParts.reduce((sum, p) => sum + Number(p.lineTotal || 0), 0);

  return (
    <Section
      title={
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 text-sm">
            🔩
          </span>
          <span>Thiết bị thay thế (xuất từ kho)</span>
        </div>
      }
    >
      {parts.length ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3">Linh kiện</th>
                  <th className="py-2.5 px-2">SL</th>
                  <th className="py-2.5 px-2">Diện chi phí</th>
                  <th className="py-2.5 px-3 text-right">Khách trả</th>
                  <th className="py-2.5 px-2">Trạng thái</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.map((part) => (
                  <tr key={part._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-2 px-3">
                      <b className="text-slate-900 font-bold">{part.productName}</b>
                      {part.manual && (
                        <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 border border-amber-200">
                          Thủ công
                        </span>
                      )}
                      <div className="text-slate-400 text-[11px]">{part.sku}</div>
                    </td>
                    <td className="py-2 px-2 font-semibold text-slate-800">{part.quantity}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          part.chargeable ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700 font-semibold"
                        }`}
                      >
                        {BILLING_LABEL[part.billing] || part.billing}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {part.chargeable ? (
                        `${money(part.lineTotal)} đ`
                      ) : (
                        <span className="text-emerald-600 font-bold">0 đ (Bảo hành)</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {part.status === "issued" ? (
                        <span className="text-emerald-700 font-medium">Đã xuất</span>
                      ) : part.status === "returned" ? (
                        <span className="text-amber-700 font-medium">Đã hoàn</span>
                      ) : (
                        <span className="text-slate-500">Đã huỷ</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {part.status === "issued" && (
                        <button
                          type="button"
                          disabled={busyId === part._id}
                          onClick={() => void returnPart(part)}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition cursor-pointer"
                        >
                          Hoàn
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {issuedParts.length > 0 && (
            <div className="rounded-xl bg-slate-50/80 p-3 text-xs space-y-1.5 border border-slate-200/80">
              <p className="font-semibold text-slate-700 mb-1">Bóc tách chi phí linh kiện:</p>
              <div className="flex justify-between text-emerald-700">
                <span>• Linh kiện bảo hành ({warrantyParts.length} món - tính 0 đ):</span>
                <span className="font-semibold">
                  0 đ{" "}
                  {totalWarrantyValue > 0 && (
                    <span className="font-normal text-slate-500">(Giá trị: {money(totalWarrantyValue)} đ)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• Linh kiện dịch vụ / ngoài BH ({billableParts.length} món):</span>
                <span className="font-semibold">{money(totalBillableValue)} đ</span>
              </div>
              {ticket.loyaltyDiscount?.rate ? (
                <div className="flex justify-between text-purple-700">
                  <span>• Ưu đãi khách mua máy tại shop (-{ticket.loyaltyDiscount.rate}%):</span>
                  <span className="font-semibold">
                    -
                    {money(
                      ticket.loyaltyDiscount.amount ??
                        Math.round((totalBillableValue * ticket.loyaltyDiscount.rate) / 100)
                    )}{" "}
                    đ
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900 text-sm">
                <span>Tổng tiền linh kiện thu khách:</span>
                <span className="text-cyan-700">{money(ticket.partRevenue ?? totalBillableValue)} đ</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 p-3 text-xs text-slate-500">
          <Package className="h-4 w-4 text-slate-400 shrink-0" />
          <span>Chưa xuất linh kiện nào cho phiếu này.</span>
        </div>
      )}

      {canIssue ? (
        <IssuePartForm
          ticket={ticket}
          onIssued={() => {
            void load();
            onChanged();
          }}
        />
      ) : (
        <p className="mt-2 text-[11px] text-slate-400 italic">
          * Chỉ xuất được thiết bị thay thế khi phiếu đã được duyệt hoặc đang sửa.
        </p>
      )}
    </Section>
  );
}

function NotificationsSection({ ticket }: { ticket: RepairTicket }) {
  const [rows, setRows] = useState<RepairNotification[]>([]);
  const [busy, setBusy] = useState("");
  const load = () =>
    repairExtras
      .notifications(ticket._id)
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    void load();
  }, [ticket._id]);

  const resend = async (event: "received" | "technician_assigned" | "done" | "delivered") => {
    setBusy(event);
    try {
      const result = await repairExtras.resendNotification(ticket._id, event);
      if (result.status !== "sent") window.alert(`Không gửi được: ${result.reason || result.status}`);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không gửi lại được thông báo.");
    } finally {
      setBusy("");
    }
  };

  const openCskhChat = () => {
    window.dispatchEvent(
      new CustomEvent("cskh:open-chat", {
        detail: {
          ticketId: ticket._id,
          ticketCode: ticket.ticketCode,
          customerName: ticket.customerName,
          customerPhone: ticket.customerPhone,
          deviceName: ticket.device?.name,
        },
      })
    );
  };

  return (
    <div className="relative z-10 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 text-sm">
                📢
              </span>
              <b className="font-bold text-slate-900 text-sm">Thông báo 4 bước</b>
            </div>
            <button
              type="button"
              onClick={openCskhChat}
              className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-sky-600 to-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:from-sky-700 hover:to-cyan-700 transition cursor-pointer"
              title="Mở màn hình Chat 1-1 CSKH với khách"
            >
              <span>💬</span> Nhắn tin CSKH
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <button
              type="button"
              disabled={busy === "received"}
              onClick={() => void resend("received")}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50 truncate"
              title="Gửi lại thông báo: 1. Tiếp nhận máy"
            >
              {busy === "received" ? "Đang gửi..." : "1. Nhận máy"}
            </button>
            <button
              type="button"
              disabled={busy === "technician_assigned" || !ticket.technicianId}
              onClick={() => void resend("technician_assigned")}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50 truncate"
              title="Gửi lại thông báo: 2. Đã phân công KTV"
            >
              {busy === "technician_assigned" ? "Đang gửi..." : "2. Giao thợ"}
            </button>
            <button
              type="button"
              disabled={busy === "done" || !["done", "delivered"].includes(ticket.status)}
              onClick={() => void resend("done")}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-2xs cursor-pointer truncate"
              title="Gửi lại thông báo: 3. Sửa xong máy & QR đánh giá"
            >
              {busy === "done" ? "Đang gửi..." : "3. Sửa xong"}
            </button>
            <button
              type="button"
              disabled={busy === "delivered" || ticket.status !== "delivered"}
              onClick={() => void resend("delivered")}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-2xs cursor-pointer truncate"
              title="Gửi lại thông báo: 4. Bàn giao & Cảm ơn"
            >
              {busy === "delivered" ? "Đang gửi..." : "4. Bàn giao"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          {rows.length ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {rows.map((row) => (
                <div
                  key={row._id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-800">{NOTIFY_LABEL[row.event] || row.event}:</span>
                    <span className="text-slate-500 truncate">{row.recipient || row.channel || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        row.status === "sent"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : row.status === "failed"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {NOTIFY_STATUS[row.status] || row.status}
                    </span>
                    <span className="text-[11px] text-slate-400">{date(row.sentAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center text-xs text-slate-400">
              Chưa gửi thông báo SMS/Zalo nào cho phiếu này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Chấm điểm tại quầy khi khách nhận máy. Mỗi phiếu chỉ nhận một đánh giá. */
function RatingSection({ ticket }: { ticket: RepairTicket }) {
  const [rating, setRating] = useState(5);
  const [criteria, setCriteria] = useState<RepairRatingCriteria>({});
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  if (!["done", "delivered"].includes(ticket.status)) return null;

  const submit = async () => {
    setState("busy");
    setError("");
    try {
      await repairExtras.rate(ticket._id, { rating, comment, criteria });
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được đánh giá.");
      setState("idle");
    }
  };

  return (
    <Section
      title={
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 text-sm">
            ⭐
          </span>
          <span>Chấm điểm kỹ thuật (tại quầy)</span>
        </div>
      }
    >
      {state === "done" ? (
        <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          ✓ Đã ghi nhận đánh giá tại quầy. Cảm ơn quý khách!
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 min-w-[200px]">
              <span className="text-xs font-bold text-slate-700">Điểm tổng</span>
              <Dropdown<number>
                value={rating}
                onChange={setRating}
                options={RATING_OPTIONS}
                variant="default"
                size="sm"
                className="w-full"
                triggerClassName="w-full justify-between"
              />
            </div>
            {CRITERIA.map((item) => (
              <div key={item.key} className="flex flex-col gap-1 min-w-[130px]">
                <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                <Dropdown<string>
                  value={String(criteria[item.key] ?? "")}
                  onChange={(val) =>
                    setCriteria({ ...criteria, [item.key]: val ? Number(val) : undefined })
                  }
                  options={CRITERIA_OPTIONS}
                  variant="default"
                  size="sm"
                  className="w-full"
                  triggerClassName="w-full justify-between"
                />
              </div>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Nhận xét của khách tại quầy (VD: Kỹ thuật viên nhiệt tình, thay đồ nhanh, máy dùng tốt...)..."
            className="mt-3 min-h-16 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none shadow-2xs"
          />
          <button
            type="button"
            disabled={state === "busy"}
            onClick={() => void submit()}
            className="mt-2.5 min-h-11 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
          >
            {state === "busy" ? "Đang lưu..." : "Lưu đánh giá"}
          </button>
          {error && <p className="mt-2 text-xs text-rose-700 font-medium">{error}</p>}
        </>
      )}
    </Section>
  );
}

export default function RepairTicketExtras({
  ticket,
  onChanged,
}: {
  ticket: RepairTicket;
  onChanged: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      {/* 2-Column Responsive Layout: Phân công kỹ thuật & Thông báo gửi khách */}
      <div className="relative z-30 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TechnicianPicker ticket={ticket} onChanged={onChanged} />
        <NotificationsSection ticket={ticket} />
      </div>

      {/* Thiết bị thay thế (xuất từ kho) */}
      <div className="relative z-20">
        <PartsSection ticket={ticket} onChanged={onChanged} />
      </div>

      {/* Chấm điểm kỹ thuật tại quầy (khi đã hoàn thành) */}
      <div className="relative z-10">
        <RatingSection ticket={ticket} />
      </div>
    </div>
  );
}
