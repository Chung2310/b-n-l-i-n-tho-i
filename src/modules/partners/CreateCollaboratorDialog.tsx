import React, { useState, useEffect, useRef } from "react";
import { X, UserPlus, RefreshCw, AlertCircle, Loader2, Phone, Mail, MapPin, Tag, User, FileText } from "lucide-react";
import { partnerRequest, type Partner } from "./partnerApi";
import { getApiErrorMessage } from "../../utils/errorMessage";

export interface CreateCollaboratorDialogProps {
  initialName?: string;
  initialPhone?: string;
  onClose: () => void;
  onCreated: (partner: Partner) => void;
}

function generateCollaboratorCode(): string {
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `CTV-${randomSuffix}`;
}

export default function CreateCollaboratorDialog({
  initialName = "",
  initialPhone = "",
  onClose,
  onCreated,
}: CreateCollaboratorDialogProps) {
  const [code, setCode] = useState(() => generateCollaboratorCode());
  const [name, setName] = useState(initialName.trim());
  const [phone, setPhone] = useState(initialPhone.trim());
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedAddress = address.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedCode) {
      setError("Vui lòng nhập hoặc tạo mã CTV.");
      return;
    }
    if (!trimmedName) {
      setError("Vui lòng nhập họ tên cộng tác viên.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        code: trimmedCode,
        name: trimmedName,
        roles: ["collaborator"],
        status: "active",
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
        address: trimmedAddress || undefined,
        notes: trimmedNotes || undefined,
      };

      const createdPartner = await partnerRequest<Partner>("/", "POST", payload);
      onCreated(createdPartner);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Không tạo được cộng tác viên. Vui lòng kiểm tra lại."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-collaborator-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-md shadow-cyan-500/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="create-collaborator-title" className="text-base font-bold text-slate-900">
                Tạo trực tiếp cộng tác viên (CTV)
              </h2>
              <p className="text-xs text-slate-500">
                Thêm nhanh CTV giới thiệu và tự động chọn vào đơn hàng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng hộp thoại"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 font-medium animate-in fade-in duration-150"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mã CTV & Họ tên */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <label htmlFor="collab-code" className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-slate-400" />
                  <span>Mã CTV</span>
                  <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setCode(generateCollaboratorCode())}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-600 hover:text-cyan-700 hover:underline cursor-pointer"
                  title="Tạo mã ngẫu nhiên mới"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Đổi mã</span>
                </button>
              </div>
              <input
                id="collab-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: CTV-001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm font-semibold text-slate-900 uppercase placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </div>

            <div>
              <label htmlFor="collab-name" className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                <User className="h-3 w-3 text-slate-400" />
                <span>Họ và tên CTV</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                id="collab-name"
                ref={nameInputRef}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nguyễn Văn Nam"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </div>
          </div>

          {/* Điện thoại & Email */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="collab-phone" className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                <Phone className="h-3 w-3 text-slate-400" />
                <span>Số điện thoại</span>
              </label>
              <input
                id="collab-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912 345 678"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </div>

            <div>
              <label htmlFor="collab-email" className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                <Mail className="h-3 w-3 text-slate-400" />
                <span>Email (tùy chọn)</span>
              </label>
              <input
                id="collab-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: ctv@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </div>
          </div>

          {/* Địa chỉ */}
          <div>
            <label htmlFor="collab-address" className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
              <MapPin className="h-3 w-3 text-slate-400" />
              <span>Địa chỉ</span>
            </label>
            <input
              id="collab-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: 123 Cầu Giấy, Hà Nội"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
            />
          </div>

          {/* Ghi chú */}
          <div>
            <label htmlFor="collab-notes" className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
              <FileText className="h-3 w-3 text-slate-400" />
              <span>Ghi chú</span>
            </label>
            <input
              id="collab-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú CTV, nguồn giới thiệu..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-cyan-600/30 hover:from-cyan-700 hover:to-sky-700 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Lưu & Chọn CTV</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
