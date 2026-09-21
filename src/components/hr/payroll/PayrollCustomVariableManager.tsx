import { useEffect, useState } from "react";
import { Plus, Columns, EyeOff, Eye, Zap, Calculator, Edit3, Sparkles, Check, AlertCircle } from "lucide-react";
import { payrollService } from "../../../services/payrollService";
import { toast } from "../../../pages/Toast";
import {
  evaluateFormulaExpression,
  tokenizeFormula,
  validateFormulaExpression,
} from "../../../../server/service/payroll-custom-column-calculator.service";

const SOURCE_OPTIONS: Array<{ value: string; label: string; group: string; shortLabel: string }> = [
  { value: "monthlySalary", label: "Lương cơ bản / thỏa thuận", shortLabel: "Lương cơ bản", group: "Lương & Thù lao" },
  { value: "commission", label: "Hoa hồng doanh số", shortLabel: "Hoa hồng", group: "Lương & Thù lao" },
  { value: "workedDays", label: "Số ngày công thực tế", shortLabel: "Ngày công", group: "Công & Giờ làm" },
  { value: "standardDays", label: "Số ngày công chuẩn", shortLabel: "Công chuẩn", group: "Công & Giờ làm" },
  { value: "overtimeHours", label: "Số giờ tăng ca", shortLabel: "Giờ tăng ca", group: "Công & Giờ làm" },
  { value: "workedHours", label: "Số giờ làm thực tế", shortLabel: "Giờ làm TT", group: "Công & Giờ làm" },
  { value: "standardHours", label: "Số giờ làm chuẩn", shortLabel: "Giờ làm chuẩn", group: "Công & Giờ làm" },
];

const PRESETS = [
  {
    name: "Lương theo ngày công thực tế",
    desc: "(Lương cơ bản ÷ Công chuẩn) × Ngày công",
    expr: "(monthlySalary / standardDays) * workedDays",
  },
  {
    name: "Lương tăng ca (hệ số 150%)",
    desc: "(Lương cơ bản ÷ Công chuẩn ÷ 8) × Giờ tăng ca × 1.5",
    expr: "(monthlySalary / standardDays / 8) * overtimeHours * 1.5",
  },
  {
    name: "Hoa hồng 5% doanh số",
    desc: "Doanh số × 5%",
    expr: "sales * 5%",
  },
  {
    name: "Phụ cấp cơm trưa theo công",
    desc: "Ngày công × 30.000 đ",
    expr: "workedDays * 30000",
  },
];

const ROUNDING_OPTIONS = [
  { value: "none", label: "Không làm tròn", unit: 1 },
  { value: "round_1000", label: "Làm tròn đến 1.000 đ", unit: 1000 },
  { value: "round_10000", label: "Làm tròn đến 10.000 đ", unit: 10000 },
  { value: "round_100", label: "Làm tròn đến 100 đ", unit: 100 },
  { value: "floor_1000", label: "Làm tròn xuống (1.000 đ)", unit: 1000 },
  { value: "ceil_1000", label: "Làm tròn lên (1.000 đ)", unit: 1000 },
];

const SAMPLE_CONTEXT = {
  monthlySalary: 26_000_000,
  agreedSalary: 26_000_000,
  standardDays: 26,
  workedDays: 22,
  overtimeHours: 4,
  commission: 2_000_000,
  workedHours: 176,
  standardHours: 208,
  sales: 50_000_000,
  custom: { sales: 50_000_000 },
};

export function PayrollCustomVariableManager({ onChanged }: { onChanged?: () => void } = {}) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState("(monthlySalary / standardDays) * workedDays");
  const [form, setForm] = useState({
    code: "",
    name: "",
    unit: "money",
    defaultValue: "",
    columnType: "manual" as "manual" | "calculated",
    calculation: {
      leftSource: "monthlySalary",
      operator: "divide" as "add" | "subtract" | "multiply" | "divide" | "percent",
      rightType: "source" as "value" | "source",
      rightValue: "26",
      rightSource: "standardDays",
      roundingMode: "round_1000" as "none" | "round_1000" | "round_10000" | "round_100" | "floor_1000" | "ceil_1000",
    },
  });

  const load = async () => {
    try {
      const res = await payrollService.getPeriodInputVariables();
      setItems(Array.isArray(res) ? res : []);
    } catch {}
  };

  useEffect(() => {
    void load();
  }, []);

  const getSourceLabel = (src: string) => {
    const builtin = SOURCE_OPTIONS.find((s) => s.value === src);
    if (builtin) return builtin.label;
    if (src.startsWith("custom.")) {
      const code = src.slice("custom.".length);
      const customCol = items.find((i) => i.code === code);
      return customCol ? `[Cột] ${customCol.name}` : `[Cột] ${code}`;
    }
    return src;
  };

  // Convert technical codes in formula into human-readable labels for visual preview
  const formatExpressionPretty = (rawExpr: string) => {
    let text = rawExpr.replace(/\//g, " ÷ ").replace(/\*/g, " × ");
    for (const opt of SOURCE_OPTIONS) {
      const regex = new RegExp(`\\b${opt.value}\\b`, "g");
      text = text.replace(regex, `[${opt.shortLabel}]`);
    }
    for (const col of items) {
      const regex = new RegExp(`\\b(custom\\.)?${col.code}\\b`, "g");
      text = text.replace(regex, `[${col.name}]`);
    }
    return text.replace(/\s+/g, " ").trim();
  };

  const validation = validateFormulaExpression(expression);

  // Live simulation value
  let simulatedValue = 0;
  if (validation.valid) {
    try {
      simulatedValue = evaluateFormulaExpression(expression, SAMPLE_CONTEXT);
    } catch {
      simulatedValue = 0;
    }
  }

  const insertToken = (token: string) => {
    setExpression((curr) => {
      const trimmed = curr.trim();
      if (!trimmed) return token;
      // Add space around operators or append cleanly
      if (["+", "-", "*", "/", "÷", "×", "%"].includes(token)) {
        return `${trimmed} ${token} `;
      }
      return `${trimmed} ${token}`;
    });
  };

  const create = async () => {
    const trimmedCode = form.code.trim().toLowerCase().replace(/\s+/g, "_");
    const trimmedName = form.name.trim();

    if (!trimmedCode || !trimmedName) {
      toast.error("Vui lòng nhập đầy đủ mã cột và tên cột");
      return;
    }

    if (form.columnType === "calculated") {
      if (!validation.valid) {
        toast.error(validation.error || "Công thức tính không hợp lệ");
        return;
      }
    }

    try {
      const roundingUnit = ROUNDING_OPTIONS.find((r) => r.value === form.calculation.roundingMode)?.unit ?? 1;

      const payload: any = {
        code: trimmedCode,
        name: trimmedName,
        unit: form.unit,
        columnType: form.columnType,
        ...(form.defaultValue !== "" ? { defaultValue: Number(form.defaultValue) } : {}),
      };

      if (form.columnType === "calculated") {
        payload.calculation = {
          expression: expression.trim(),
          leftSource: form.calculation.leftSource,
          operator: form.calculation.operator,
          rightType: form.calculation.rightType,
          rightSource: form.calculation.rightSource,
          rightValue: Number(form.calculation.rightValue || 0),
          roundingMode: form.calculation.roundingMode,
          roundingUnit,
        };
      }

      const created: any = await payrollService.createPeriodInputVariable(payload);
      const createdId = created?._id || created?.data?._id;
      if (createdId) {
        try {
          await payrollService.activatePeriodInputVariable(createdId);
        } catch {}
      }

      setOpen(false);
      setForm({
        code: "",
        name: "",
        unit: "money",
        defaultValue: "",
        columnType: "manual",
        calculation: {
          leftSource: "monthlySalary",
          operator: "divide",
          rightType: "source",
          rightValue: "26",
          rightSource: "standardDays",
          roundingMode: "round_1000",
        },
      });
      await load();
      onChanged?.();
      toast.success(form.columnType === "calculated" ? "Đã thêm cột tự động tính mới vào bảng lương" : "Đã thêm cột mới vào bảng lương");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể tạo cột");
    }
  };

  const toggleStatus = async (item: any) => {
    try {
      if (item.status === "active") {
        await payrollService.retirePeriodInputVariable(item._id);
        toast.success(`Đã ẩn cột "${item.name}"`);
      } else {
        await payrollService.activatePeriodInputVariable(item._id);
        toast.success(`Đã hiển thị cột "${item.name}" trên bảng lương`);
      }
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể cập nhật trạng thái cột");
    }
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case "money": return "Tiền (đ)";
      case "number": return "Số lượng";
      case "days": return "Ngày";
      case "hours": return "Giờ";
      case "minutes": return "Phút";
      case "percent": return "%";
      default: return unit;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Columns size={16} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800">Thêm cột trong bảng</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer shadow-xs transition-colors"
        >
          <Plus size={14} />
          {open ? "Đóng" : "+ Thêm cột"}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/80 pb-2.5">
            <span className="text-xs font-bold text-indigo-900">Thêm cột</span>
            {/* Toggle loại cột */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setForm({ ...form, columnType: "manual" })}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  form.columnType === "manual"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Edit3 size={13} />
                Cột nhập tay
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, columnType: "calculated" })}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  form.columnType === "calculated"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Zap size={13} className={form.columnType === "calculated" ? "fill-amber-300 text-amber-300" : "text-amber-500"} />
                Cột tự động tính
              </button>
            </div>
          </div>

          {/* Hàng thông tin cơ bản */}
          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mã cột</label>
              <input
                aria-label="Mã biến"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 font-mono"
                placeholder="vd: luong_ngay, hoa_hong"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tên cột</label>
              <input
                aria-label="Tên biến"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                placeholder="vd: Lương 1 ngày công"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đơn vị tính</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option value="money">Tiền (đ)</option>
                <option value="number">Số lượng / Hệ số</option>
                <option value="percent">Tỷ lệ (%)</option>
                <option value="days">Ngày công</option>
                <option value="hours">Giờ</option>
                <option value="minutes">Phút</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Giá trị mặc định</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                type="number"
                placeholder="0"
                value={form.defaultValue}
                onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
              />
            </div>
          </div>

          {/* Khu vực thiết lập công thức tính toán */}
          {form.columnType === "calculated" && (
            <div className="rounded-xl border border-indigo-200/80 bg-white p-4 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Calculator size={15} className="text-indigo-600" />
                  <span>Công thức tính</span>
                </div>
                {/* Lựa chọn làm tròn */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[11px] font-semibold">Làm tròn:</span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                    value={form.calculation.roundingMode}
                    onChange={(e) => setForm({
                      ...form,
                      calculation: { ...form.calculation, roundingMode: e.target.value as any },
                    })}
                  >
                    {ROUNDING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gợi ý mẫu công thức */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5 flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" />
                  Mẫu gợi ý:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setExpression(p.expr)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                        expression === p.expr
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800 font-bold shadow-2xs"
                          : "border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      title={p.desc}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bàn phím nhanh chèn chỉ số và phép tính */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600 mr-1">Chèn biến:</span>
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => insertToken(opt.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-800 transition-colors cursor-pointer shadow-2xs"
                    >
                      +{opt.shortLabel}
                    </button>
                  ))}
                  {items.filter((i) => i.code !== form.code.trim().toLowerCase()).map((col) => (
                    <button
                      key={col.code}
                      type="button"
                      onClick={() => insertToken(`custom.${col.code}`)}
                      className="rounded-md border border-amber-200 bg-amber-50/60 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
                    >
                      +[{col.name}]
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-600 mr-1">Toán tử:</span>
                  {["+", "-", "×", "÷", "(", ")", "%"].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => insertToken(op === "×" ? "*" : op === "÷" ? "/" : op)}
                      className="h-6 min-w-6 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all cursor-pointer shadow-2xs flex items-center justify-center font-mono"
                    >
                      {op}
                    </button>
                  ))}
                  <div className="h-4 w-px bg-slate-300 mx-1" />
                  {["26", "8", "1.5", "2.0", "50000"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => insertToken(num)}
                      className="h-6 rounded-md border border-slate-200 bg-white px-2 text-xs font-mono text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExpression("")}
                    className="ml-auto text-[11px] font-medium text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>

              {/* Ô soạn thảo công thức */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Biểu thức:
                </label>
                <div className="relative">
                  <input
                    aria-label="Công thức toán học"
                    type="text"
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="vd: (monthlySalary / standardDays) * workedDays + 500000"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs font-mono font-medium outline-none transition-all ${
                      validation.valid
                        ? "border-indigo-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-200 text-slate-900"
                        : "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 text-rose-900 bg-rose-50/20"
                    }`}
                  />
                </div>
                {!validation.valid && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                    <AlertCircle size={12} />
                    {validation.error}
                  </p>
                )}
              </div>

              {/* Hộp xem trước trực quan và giả lập tính toán */}
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-3 space-y-1 text-xs text-amber-900 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Zap size={14} className="fill-amber-400 text-amber-500 shrink-0" />
                  <span>Công thức trực quan:</span>
                  <span className="font-mono bg-white/90 px-2 py-0.5 rounded border border-amber-200 font-bold text-slate-900 text-xs">
                    {formatExpressionPretty(expression) || "(Chưa có công thức)"}
                  </span>
                </div>

                {validation.valid && (
                  <div className="text-[11px] text-amber-800/90 pt-1 border-t border-amber-200/60 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-600">
                      Giả lập mẫu:
                    </span>
                    <span className="font-bold text-indigo-900 font-mono bg-white px-2 py-0.5 rounded border border-amber-200">
                      = {simulatedValue.toLocaleString("vi-VN")} {form.unit === "money" ? "đ" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => void create()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer shadow-xs transition-colors"
            >
              Lưu và áp dụng cột
            </button>
          </div>
        </div>
      )}

      {/* Danh sách các cột hiện có */}
      <div className="mt-3 flex flex-wrap gap-2.5">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Chưa có cột tùy chỉnh nào.</p>
        ) : (
          items.map((item) => {
            const isActive = item.status === "active";
            const isCalculated = item.columnType === "calculated";
            const formulaSummary = item.calculation?.expression
              ? formatExpressionPretty(item.calculation.expression)
              : null;

            return (
              <div
                key={item._id}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs transition-all ${
                  isActive
                    ? isCalculated
                      ? "border-amber-200 bg-amber-50/40 text-slate-800 shadow-xs"
                      : "border-indigo-200 bg-indigo-50/50 text-indigo-900 shadow-xs"
                    : "border-slate-200 bg-slate-50 text-slate-500 opacity-70"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    {isCalculated && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        <Zap size={10} className="fill-amber-500 text-amber-600" />
                        Tự tính
                      </span>
                    )}
                    <span>{item.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                      custom.{item.code}
                    </span>
                  </div>

                  {isCalculated && formulaSummary ? (
                    <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                      <span className="text-slate-400">Công thức:</span>
                      <span className="font-mono font-medium text-indigo-700 bg-white/80 px-1 rounded border border-slate-100">
                        {formulaSummary}
                      </span>
                    </p>
                  ) : null}

                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đơn vị: <span className="font-medium text-slate-700">{getUnitLabel(item.unit)}</span> · Trạng thái:{" "}
                    <span className={isActive ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {isActive ? "Đang hiển thị trên bảng lương" : "Đã ẩn"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleStatus(item)}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-slate-200/80 text-slate-700 hover:bg-slate-300"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                  {isActive ? "Ẩn cột" : "Hiện trên bảng"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
