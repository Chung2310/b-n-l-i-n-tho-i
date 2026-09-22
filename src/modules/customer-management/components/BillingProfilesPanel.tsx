import React from "react";
import { customerApi } from "../customerApi";
import type { BillingProfileInput } from "../types";

const empty: BillingProfileInput = {
  legalName: "",
  taxId: "",
  address: "",
  invoiceEmail: "",
  contactName: "",
};

const FIELD_PLACEHOLDERS: Partial<Record<keyof BillingProfileInput, string>> = {
  legalName: "Tên pháp nhân công ty / tổ chức (VD: Công ty TNHH ABC)...",
  taxId: "Mã số thuế doanh nghiệp (VD: 0101234567)...",
  address: "Địa chỉ xuất hóa đơn theo đăng ký kinh doanh...",
  invoiceEmail: "Email nhận hóa đơn điện tử (VD: ketoan@abc.vn)...",
  contactName: "Họ tên người liên hệ / phụ trách hóa đơn (tùy chọn)...",
};

export default function BillingProfilesPanel({
  customerId,
  companyCode,
  canManage,
}: {
  customerId: string;
  companyCode: string;
  canManage: boolean;
}) {
  const [items, setItems] = React.useState<any[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState(empty);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(
    () => customerApi.billingProfiles(customerId, companyCode).then(setItems),
    [customerId, companyCode]
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Thông tin xuất VAT</h3>
        {canManage && (
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            className="text-xs font-bold text-cyan-700 hover:text-cyan-800 transition cursor-pointer"
          >
            {adding ? "Đóng biểu mẫu" : "+ Thêm hồ sơ VAT"}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item._id}
            className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs"
          >
            <p className="font-bold text-slate-800">
              {item.legalName}
              {item.isDefault ? (
                <span className="ml-2 rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
                  Mặc định
                </span>
              ) : (
                ""
              )}
            </p>
            <p className="mt-1 text-slate-600 font-mono">MST: {item.taxId}</p>
            <p className="text-slate-500">{item.address}</p>
            <p className="text-slate-400">{item.invoiceEmail}</p>
          </div>
        ))}
        {!items.length && (
          <p className="text-xs text-slate-400 py-2">
            Chưa có hồ sơ xuất VAT nào được lưu.
          </p>
        )}
      </div>

      {adding && (
        <form
          className="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs animate-in fade-in duration-150"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage("");
            void customerApi
              .createBillingProfile(customerId, form, companyCode)
              .then((result) => {
                setMessage(result.warnings[0]?.message || "Đã thêm hồ sơ VAT thành công.");
                setForm(empty);
                setAdding(false);
                return load();
              })
              .catch((error) =>
                setMessage(
                  error instanceof Error ? error.message : "Không thêm được hồ sơ VAT."
                )
              );
          }}
        >
          {(
            [
              "legalName",
              "taxId",
              "address",
              "invoiceEmail",
              "contactName",
            ] as const
          ).map((key) => (
            <input
              key={key}
              aria-label={key}
              required={key !== "contactName"}
              value={form[key] || ""}
              onChange={(event) =>
                setForm((value) => ({ ...value, [key]: event.target.value }))
              }
              placeholder={FIELD_PLACEHOLDERS[key]}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
            />
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition cursor-pointer"
            >
              Lưu hồ sơ VAT
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
          {message}
        </p>
      )}
    </section>
  );
}
