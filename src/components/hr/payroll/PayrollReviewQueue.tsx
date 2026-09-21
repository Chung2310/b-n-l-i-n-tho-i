import { Check, Printer, X } from "lucide-react";

type Adjustment = {
  _id: string;
  employeeName?: string;
  employeeId: string;
  kind: string;
  amount: number;
  reason: string;
  status: string;
};

export function PayrollReviewQueue({ adjustments, onApprove, onReject, onPrintAdvance }: {
  adjustments: Adjustment[];
  onApprove: (adjustment: Adjustment) => void;
  onReject: (adjustment: Adjustment) => void;
  onPrintAdvance?: (adjustment: Adjustment) => void;
}) {
  if (!adjustments.length) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Không có điều chỉnh nào trong kỳ.</p>;

  // Sort: pending first
  const sorted = [...adjustments].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  const getKindLabel = (kind: string) => {
    if (kind === "bonus") return "Thưởng / Cộng thêm";
    if (kind === "deduction") return "Khấu trừ / Phạt";
    if (kind === "other_deduction") return "Khấu trừ khác";
    if (kind === "advance") return "Tạm ứng lương";
    return kind;
  };

  const isDeduction = (kind: string) => kind === "deduction" || kind === "other_deduction" || kind === "advance";

  return (
    <div className="space-y-2">
      {sorted.map((item) => (
        <div key={item._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{item.employeeName || item.employeeId}</p>
            <p className="text-xs text-slate-500">
              <span className={`inline-block font-medium ${item.kind === "advance" ? "text-indigo-600 font-semibold" : ""}`}>
                {getKindLabel(item.kind)}
              </span> · {item.reason}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <strong className={isDeduction(item.kind) ? "text-rose-600" : "text-slate-850"}>
              {isDeduction(item.kind) ? "-" : ""}{item.amount.toLocaleString()} đ
            </strong>
            {onPrintAdvance && item.kind === "advance" && (
              <button
                type="button"
                title="In phiếu tạm ứng"
                onClick={() => onPrintAdvance(item)}
                className="rounded-md p-1.5 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
              >
                <Printer size={16} />
              </button>
            )}
            {item.status === "pending" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Duyệt điều chỉnh"
                  onClick={() => onApprove(item)}
                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  title="Từ chối điều chỉnh"
                  onClick={() => onReject(item)}
                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            ) : item.status === "approved" ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                Đã duyệt
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                Đã từ chối
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
