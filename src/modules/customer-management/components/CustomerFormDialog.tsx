import React from "react";
import { X, Camera, UploadCloud, Trash2, Loader2 } from "lucide-react";
import type { Customer, CustomerInput } from "../types";
import { Dropdown } from "../../../components/common/Dropdown";
import { customerApi } from "../customerApi";

const empty: CustomerInput = {
  name: "",
  phone: "",
  type: "regular",
  email: "",
  avatarUrl: "",
  dateOfBirth: "",
  address: "",
  notes: "",
};

const PLACEHOLDERS: Partial<Record<keyof CustomerInput, string>> = {
  name: "Nhập họ và tên khách hàng (VD: Nguyễn Văn A)...",
  phone: "Nhập số điện thoại liên hệ (VD: 0912 345 678)...",
  email: "Nhập địa chỉ email (VD: an@example.com)...",
  dateOfBirth: "Chọn ngày sinh",
  gender: "Chọn giới tính",
  address: "Nhập địa chỉ nhận hàng / cư trú...",
  notes: "Nhập ghi chú sở thích, lưu ý đặc biệt về khách hàng...",
  type: "Chọn loại khách hàng",
};

export default function CustomerFormDialog({
  customer,
  onClose,
  onSave,
}: {
  customer?: Customer;
  onClose: () => void;
  onSave: (input: CustomerInput) => Promise<void>;
}) {
  const [form, setForm] = React.useState<CustomerInput>({
    ...empty,
    ...customer,
    dateOfBirth: customer?.dateOfBirth?.slice(0, 10) || "",
    avatarUrl: customer?.avatarUrl || "",
  });
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError("");
    try {
      const url = await customerApi.uploadAvatar(file);
      setForm((curr) => ({ ...curr, avatarUrl: url }));
    } catch (err: any) {
      setError(err.message || "Không tải được ảnh đại diện.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    setForm((curr) => ({ ...curr, avatarUrl: "" }));
  };

  const field = (
    key: keyof CustomerInput,
    label: string,
    type = "text",
    required = false
  ) => (
    <label className="block text-sm font-semibold text-slate-700">
      <span className="flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={String(form[key] || "")}
        placeholder={PLACEHOLDERS[key]}
        onChange={(event) =>
          setForm((current) => ({ ...current, [key]: event.target.value }))
        }
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          void onSave(form)
            .catch((cause) =>
              setError(
                cause instanceof Error ? cause.message : "Không lưu được khách hàng."
              )
            )
            .finally(() => setSaving(false));
        }}
        className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {customer ? "Sửa hồ sơ khách hàng" : "Thêm khách hàng mới"}
          </h2>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Avatar Upload Section (Optional) */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
          <div className="relative shrink-0">
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt="Avatar khách hàng"
                className="h-16 w-16 rounded-2xl object-cover border border-slate-200 shadow-2xs"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 border border-cyan-200/80 text-cyan-600 shadow-2xs">
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Camera className="h-6 w-6" />
                )}
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 text-white">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800">
              Ảnh đại diện khách hàng <span className="text-slate-400 font-normal">(tùy chọn)</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hỗ trợ JPG, PNG, WEBP. Ảnh hiển thị trong danh sách và hồ sơ chi tiết.
            </p>

            <div className="flex items-center gap-2 mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-cyan-700 transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="h-3.5 w-3.5 text-slate-400" />
                <span>{form.avatarUrl ? "Đổi ảnh khác" : "Chọn ảnh từ máy"}</span>
              </button>

              {form.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Gỡ ảnh</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Họ và tên", "text", true)}
          {field("phone", "Số điện thoại", "tel", true)}
          {field("email", "Email", "email")}
          {field("dateOfBirth", "Ngày sinh", "date")}

          <div className="block text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-1">Loại khách</span>
            <Dropdown<CustomerInput["type"]>
              aria-label="Loại khách"
              name="type"
              value={form.type}
              onChange={(val) => setForm((curr) => ({ ...curr, type: val }))}
              options={[
                { value: "regular", label: "Khách thường" },
                { value: "vat", label: "Khách xuất VAT" },
              ]}
              placeholder={PLACEHOLDERS.type}
              variant="form"
              size="md"
              className="mt-1 w-full block"
              triggerClassName="w-full h-[38px] justify-between font-normal"
              menuClassName="w-full min-w-full"
            />
          </div>

          {field("address", "Địa chỉ")}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Ghi chú
          </label>
          <textarea
            rows={2}
            value={form.notes || ""}
            placeholder={PLACEHOLDERS.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition disabled:opacity-60 cursor-pointer"
          >
            {saving ? "Đang lưu..." : customer ? "Cập nhật" : "Tạo khách hàng"}
          </button>
        </div>
      </form>
    </div>
  );
}
