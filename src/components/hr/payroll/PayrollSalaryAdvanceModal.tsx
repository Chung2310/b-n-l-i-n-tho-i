import React, { useState, useId } from "react";
import { HandCoins, Printer, X, FileText, Check } from "lucide-react";

export type AdvanceEmployee = {
  employeeId: string;
  employeeName: string;
  monthlySalary?: number;
  advances?: number;
};

export type AdvancePayload = {
  employeeId: string;
  amount: number;
  date: string;
  method: string;
  reason: string;
  note?: string;
};

export function numberToVietnameseWords(n: number): string {
  if (!n || n <= 0) return "Không đồng";
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const units = ["", "nghìn", "triệu", "tỷ"];

  const readGroup = (group: number, showZeroHundred: boolean) => {
    const h = Math.floor(group / 100);
    const t = Math.floor((group % 100) / 10);
    const o = group % 10;
    let res = "";
    if (h > 0 || showZeroHundred) {
      res += `${digits[h]} trăm `;
    }
    if (t > 1) {
      res += `${digits[t]} mươi `;
      if (o === 1) res += "mốt";
      else if (o === 5) res += "lăm";
      else if (o > 0) res += digits[o];
    } else if (t === 1) {
      res += "mười ";
      if (o === 5) res += "lăm";
      else if (o > 0) res += digits[o];
    } else if (t === 0) {
      if (h > 0 && o > 0) res += "lẻ ";
      if (o > 0) res += digits[o];
    }
    return res.trim();
  };

  let num = Math.floor(n);
  const groups: number[] = [];
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }
  let str = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const gStr = readGroup(g, i < groups.length - 1);
      str += `${gStr} ${units[i]} `;
    }
  }
  str = str.trim() + " đồng";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function PayrollSalaryAdvanceModal({
  open,
  periodKey,
  employees,
  initialEmployeeId,
  initialAmount,
  initialReason,
  initialPreviewPrint = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  periodKey: string;
  employees: AdvanceEmployee[];
  initialEmployeeId?: string;
  initialAmount?: number;
  initialReason?: string;
  initialPreviewPrint?: boolean;
  onClose: () => void;
  onSubmit: (payload: AdvancePayload) => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || employees[0]?.employeeId || "");
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Chuyển khoản ngân hàng");
  const [reason, setReason] = useState(initialReason || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewPrint, setPreviewPrint] = useState(initialPreviewPrint);

  const dialogTitleId = useId();

  if (!open) return null;

  const selectedEmployee = employees.find((e) => e.employeeId === employeeId);
  const numericAmount = Number(amount) || 0;
  const wordsAmount = numberToVietnameseWords(numericAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || numericAmount <= 0 || !reason.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        employeeId,
        amount: numericAmount,
        date,
        method,
        reason: reason.trim(),
        note: note.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-100">
              <HandCoins size={18} />
            </div>
            <div>
              <h3 id={dialogTitleId} className="text-base font-bold text-slate-900">
                {previewPrint ? "Xem trước phiếu tạm ứng lương" : "Tạo phiếu tạm ứng lương"}
              </h3>
              <p className="text-xs text-slate-500">Kỳ lương {periodKey}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewPrint(!previewPrint)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 cursor-pointer"
            >
              {previewPrint ? <FileText size={14} /> : <Printer size={14} />}
              {previewPrint ? "Quay lại nhập liệu" : "Xem mẫu in"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {previewPrint ? (
          /* MẪU IN PHIẾU TẠM ỨNG CHUẨN KẾ TOÁN */
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto print:p-0 print:overflow-visible">
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 print:border-none print:bg-transparent">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Đơn vị: CÔNG TY TNHH BÁN LẺ IGEN</div>
                  <div className="text-xs text-slate-500">Bộ phận: Quản lý nhân sự & Tiền lương</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Mẫu số: 03-LĐTL</div>
                  <div>Mã phiếu: PTU-{periodKey.replace("-", "")}</div>
                </div>
              </div>

              <div className="text-center my-5">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 uppercase">PHIẾU TẠM ỨNG LƯƠNG</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ngày lập: {date} · Áp dụng kỳ lương: {periodKey}</p>
              </div>

              <div className="space-y-3 text-sm text-slate-800">
                <div className="flex">
                  <span className="w-44 text-slate-500 shrink-0">Họ và tên người nhận:</span>
                  <strong className="text-slate-900">{selectedEmployee?.employeeName || employeeId || "—"}</strong>
                </div>
                <div className="flex">
                  <span className="w-44 text-slate-500 shrink-0">Mã nhân viên:</span>
                  <span>{employeeId || "—"}</span>
                </div>
                <div className="flex">
                  <span className="w-44 text-slate-500 shrink-0">Số tiền tạm ứng:</span>
                  <strong className="text-indigo-700 text-base">{numericAmount.toLocaleString()} VNĐ</strong>
                </div>
                <div className="flex">
                  <span className="w-44 text-slate-500 shrink-0">Viết bằng chữ:</span>
                  <em className="text-slate-700">{wordsAmount}</em>
                </div>
                <div className="flex">
                  <span className="w-44 text-slate-500 shrink-0">Hình thức nhận:</span>
                  <span>{method}</span>
                </div>
                <div className="flex">
                  <span className="w-44 text-slate-500 shrink-0">Lý do tạm ứng:</span>
                  <span>{reason || "Tạm ứng tiền lương kỳ " + periodKey}</span>
                </div>
                {note && (
                  <div className="flex">
                    <span className="w-44 text-slate-500 shrink-0">Ghi chú bổ sung:</span>
                    <span>{note}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mt-8 pt-4 border-t border-slate-200 text-xs">
                <div>
                  <div className="font-bold text-slate-800">Người đề nghị tạm ứng</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">(Ký, họ tên)</div>
                  <div className="h-16 flex items-end justify-center font-medium text-slate-700">
                    {selectedEmployee?.employeeName}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">Kế toán thanh toán</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">(Ký, họ tên)</div>
                  <div className="h-16 flex items-end justify-center font-medium text-slate-700">
                    Xác nhận
                  </div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">Giám đốc / Phê duyệt</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">(Ký, đóng dấu)</div>
                  <div className="h-16 flex items-end justify-center font-medium text-slate-700">
                    Phê duyệt
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewPrint(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
              >
                <Printer size={15} /> In phiếu này
              </button>
            </div>
          </div>
        ) : (
          /* FORM NHẬP LIỆU TẠO PHIẾU TẠM ỨNG */
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Nhân viên tạm ứng <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500"
              >
                {employees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.employeeName || emp.employeeId}
                  </option>
                ))}
              </select>
              {selectedEmployee && (
                <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                  {selectedEmployee.monthlySalary !== undefined && (
                    <span>Lương cơ sở: <strong>{selectedEmployee.monthlySalary.toLocaleString()} đ</strong></span>
                  )}
                  {selectedEmployee.advances !== undefined && selectedEmployee.advances > 0 && (
                    <span className="text-amber-600">Đã tạm ứng kỳ này: <strong>{selectedEmployee.advances.toLocaleString()} đ</strong></span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Số tiền tạm ứng (đ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  autoFocus
                  placeholder="Ví dụ: 2000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 font-semibold text-slate-800"
                />
                {numericAmount > 0 && (
                  <p className="mt-1 text-[11px] text-indigo-600 italic">
                    {wordsAmount}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Ngày chi tạm ứng
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Hình thức chi
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500"
              >
                <option value="Chuyển khoản ngân hàng">Chuyển khoản ngân hàng</option>
                <option value="Tiền mặt">Tiền mặt</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Lý do tạm ứng <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Nhập lý do tạm ứng lương (ví dụ: Tạm ứng sinh hoạt, chi phí gia đình...)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Ghi chú thêm (tùy chọn)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Đã chuyển khoản qua STK VCB"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900 flex items-start gap-2">
              <Check size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Quy trình tự động:</p>
                <p className="text-slate-600 mt-0.5">
                  Phiếu tạm ứng sẽ được gửi vào hàng đợi duyệt của kỳ lương <b>{periodKey}</b> và tự động khấu trừ vào tiền thực nhận khi được phê duyệt.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || numericAmount <= 0 || !reason.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu & Tạo phiếu tạm ứng"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
