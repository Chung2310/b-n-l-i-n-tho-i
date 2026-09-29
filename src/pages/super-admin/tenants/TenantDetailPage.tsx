import React from "react";
import { UserPlus, Pencil, Trash2, X, AlertTriangle, Shield, UserCheck, UserX } from "lucide-react";
import { superAdminTenantService, type Tenant, type TenantSummary, type TenantUser, type TenantCreateUserInput, type TenantUpdateUserInput } from "../../../services/superAdminTenantService";
import { TenantLifecycleDialog } from "./TenantLifecycleDialog";
import { MODULE_OPTIONS, type ModuleKey } from "../../../config/modules";
import { resolveBusinessType, type BusinessType } from "../../../config/businessTypes";

const ROLE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  admin: { label: "Quản trị viên", badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/30" },
  manager: { label: "Quản lý", badgeClass: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  branch_owner: { label: "Chủ chi nhánh", badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  teacher: { label: "Giáo viên", badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
  user: { label: "Nhân viên", badgeClass: "bg-slate-700/60 text-slate-300 border border-slate-600/40" },
};

function TenantUserCreateModal({
  code,
  companyName,
  onClose,
  onSaved,
}: {
  code: string;
  companyName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("admin");
  const [phone, setPhone] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError("Vui lòng nhập họ và tên"); return; }
    if (!email.trim()) { setError("Vui lòng nhập địa chỉ email"); return; }
    if (!password || password.length < 6) { setError("Mật khẩu phải có ít nhất 6 ký tự"); return; }

    setError("");
    setSubmitting(true);
    try {
      await superAdminTenantService.createUser(code, {
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        phone: phone.trim(),
        department: department.trim(),
        jobTitle: jobTitle.trim(),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể tạo tài khoản");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-100 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Thêm tài khoản mới</h3>
              <p className="text-xs text-slate-400">Doanh nghiệp: {companyName} ({code})</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-400">
              Họ và tên <span className="text-red-400">*</span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Email đăng nhập <span className="text-red-400">*</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-400">
              Mật khẩu <span className="text-red-400">*</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Vai trò <span className="text-red-400">*</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              >
                <option value="admin">Quản trị viên (admin)</option>
                <option value="manager">Quản lý (manager)</option>
                <option value="branch_owner">Chủ chi nhánh (branch_owner)</option>
                <option value="user">Nhân viên (user)</option>
                <option value="teacher">Giáo viên / Giảng viên (teacher)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-400">
              Số điện thoại
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Phòng ban
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ban Giám Đốc, Kinh Doanh..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Chức vụ / Vị trí
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Giám đốc, Kế toán..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-40"
            >
              {submitting ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TenantUserEditModal({
  code,
  user,
  onClose,
  onSaved,
}: {
  code: string;
  user: TenantUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = React.useState(user.displayName || "");
  const [email, setEmail] = React.useState(user.email || "");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState(user.role || "user");
  const [phone, setPhone] = React.useState(user.phone || "");
  const [department, setDepartment] = React.useState(user.department || "");
  const [jobTitle, setJobTitle] = React.useState(user.jobTitle || "");
  const [isDisabled, setIsDisabled] = React.useState(Boolean(user.disabledAt));
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError("Vui lòng nhập họ và tên"); return; }
    if (!email.trim()) { setError("Vui lòng nhập địa chỉ email"); return; }
    if (password && password.length < 6) { setError("Mật khẩu mới phải có ít nhất 6 ký tự"); return; }

    setError("");
    setSubmitting(true);
    try {
      const updatePayload: TenantUpdateUserInput = {
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        role,
        phone: phone.trim(),
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        disabledAt: isDisabled ? (user.disabledAt || new Date().toISOString()) : null,
      };
      if (password.trim()) {
        updatePayload.password = password.trim();
      }

      await superAdminTenantService.updateUser(code, user._id, updatePayload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể cập nhật tài khoản");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-100 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Chỉnh sửa tài khoản</h3>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-400">
              Họ và tên <span className="text-red-400">*</span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Email đăng nhập <span className="text-red-400">*</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-400">
              Mật khẩu mới
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Để trống nếu giữ nguyên"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Vai trò <span className="text-red-400">*</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              >
                <option value="admin">Quản trị viên (admin)</option>
                <option value="manager">Quản lý (manager)</option>
                <option value="branch_owner">Chủ chi nhánh (branch_owner)</option>
                <option value="user">Nhân viên (user)</option>
                <option value="teacher">Giáo viên / Giảng viên (teacher)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-400">
              Số điện thoại
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Phòng ban
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ban Giám Đốc, Kinh Doanh..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-400">
              Chức vụ / Vị trí
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Giám đốc, Kế toán..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400">
              Trạng thái tài khoản
              <select
                value={isDisabled ? "disabled" : "active"}
                onChange={(e) => setIsDisabled(e.target.value === "disabled")}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              >
                <option value="active">Hoạt động (Active)</option>
                <option value="disabled">Vô hiệu hoá (Disabled)</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-40"
            >
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TenantUserDeleteModal({
  code,
  user,
  onClose,
  onDeleted,
}: {
  code: string;
  user: TenantUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    setError("");
    setDeleting(true);
    try {
      await superAdminTenantService.deleteUser(code, user._id);
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể xóa tài khoản");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-red-500/20 p-2 text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Xác nhận xóa tài khoản</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-xs leading-relaxed text-slate-300">
            Bạn có chắc chắn muốn xóa tài khoản <strong className="text-white">{user.displayName}</strong> (<span className="font-mono text-cyan-300">{user.email}</span>) khỏi doanh nghiệp này?
          </p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
            Hành động này không thể hoàn tác. Các cấp dưới trực thuộc (nếu có) sẽ được tự động điều chuyển lên cấp cha.
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/20 p-2 text-xs text-red-200">{error}</p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-40"
          >
            {deleting ? "Đang xóa..." : "Xác nhận xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModulesEditor({ code, current, businessType, onSaved }: { code: string; current: string[]; businessType: BusinessType; onSaved: () => void }) {
  const [selected, setSelected] = React.useState<ModuleKey[]>(() => (current as ModuleKey[]) || []);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setSelected((current as ModuleKey[]) || []);
  }, [current]);

  const toggle = (moduleKeys: readonly ModuleKey[]) => {
    setSelected((prev) => moduleKeys.every((key) => prev.includes(key))
      ? prev.filter((key) => !moduleKeys.includes(key))
      : [...new Set([...prev, ...moduleKeys])]);
  };

  const save = async () => {
    setError(""); setSaving(true);
    try {
      await superAdminTenantService.updateModules(code, { enabledModules: selected, businessType, reason });
      setReason("");
      onSaved();
    } catch (e: any) {
      setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {MODULE_OPTIONS.map((option) => (
          <label key={option.key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-200 cursor-pointer hover:bg-slate-750">
            <input type="checkbox" checked={option.moduleKeys.some((key) => selected.includes(key))} onChange={() => toggle(option.moduleKeys)} />
            {option.label}
          </label>
        ))}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do thay đổi module" className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs outline-none focus:border-cyan-400 text-slate-100" />
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
      <button disabled={!reason.trim() || saving} onClick={save} className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
        {saving ? "Đang lưu..." : "Lưu module"}
      </button>
    </div>
  );
}

function StatusToggle({ code, current, onSaved }: { code: string; current?: string; onSaved: () => void }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const setStatus = async (lifecycleStatus: "active" | "suspended") => {
    setError(""); setSaving(true);
    try {
      await superAdminTenantService.transition(code, { lifecycleStatus, reason });
      setReason("");
      onSaved();
    } catch (e: any) {
      setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`);
    } finally { setSaving(false); }
  };

  const isActive = current === "active";

  return (
    <div className="space-y-3">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do thay đổi trạng thái" className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs outline-none focus:border-cyan-400" />
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
      <div className="flex gap-2">
        <button disabled={isActive || !reason.trim() || saving} onClick={() => setStatus("active")} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
          Kích hoạt
        </button>
        <button disabled={!isActive || !reason.trim() || saving} onClick={() => setStatus("suspended")} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
          Vô hiệu hoá
        </button>
      </div>
    </div>
  );
}

export function TenantDetailPage({ code, onBack }: { code: string; onBack?: () => void }) {
  const [tenant, setTenant] = React.useState<Tenant>();
  const [summary, setSummary] = React.useState<TenantSummary>();
  const [audit, setAudit] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<TenantUser[]>([]);
  const [error, setError] = React.useState("");

  const [creatingUser, setCreatingUser] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<TenantUser | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<TenantUser | null>(null);

  const load = React.useCallback(() => {
    Promise.all([superAdminTenantService.detail(code), superAdminTenantService.listUsers(code)])
      .then(([d, u]) => { setTenant(d.tenant); setSummary(d.summary); setAudit(d.audit || []); setUsers(u); })
      .catch((e: any) => setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`));
  }, [code]);

  React.useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className="space-y-3">
      {onBack && (
        <button onClick={onBack} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-cyan-300">
          ← Quay lại danh sách
        </button>
      )}
      <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>
    </div>
  );
  if (!tenant) return <p className="text-slate-400">Đang tải thông tin doanh nghiệp…</p>;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 text-slate-100">
      <header className="border-b border-white/10 pb-5">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            ← Quay lại danh sách
          </button>
        )}
        <h2 className="text-2xl font-bold">{tenant.name}</h2>
        <p className="mt-1 font-mono text-xs text-slate-500">{tenant.code} · {tenant.ownerEmail}</p>
        <span className="mt-2 inline-block rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{tenant.lifecycleStatus}</span>
      </header>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Số liệu tổng quan</h3>
        {summary ? (
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-xs text-slate-500">Tổng người dùng</dt><dd className="text-lg font-bold">{summary.userCount}</dd></div>
            <div><dt className="text-xs text-slate-500">Module đang bật</dt><dd className="text-lg font-bold">{summary.enabledModulesCount}</dd></div>
            <div><dt className="text-xs text-slate-500">Theo vai trò</dt><dd className="text-xs">{Object.entries(summary.usersByRole).map(([role, count]) => `${role}: ${count}`).join(", ") || "—"}</dd></div>
          </dl>
        ) : <p className="mt-2 text-xs text-slate-500">Đang tải…</p>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Trạng thái hoạt động</h3>
        <div className="mt-3"><StatusToggle code={code} current={tenant.lifecycleStatus} onSaved={load} /></div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Cấu hình module tính năng</h3>
        <div className="mt-3"><ModulesEditor code={code} current={tenant.enabledModules || []} businessType={resolveBusinessType(tenant.businessType)} onSaved={load} /></div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Tài khoản quản trị & người dùng</h3>
            <p className="text-xs text-slate-400">Danh sách tài khoản trực thuộc doanh nghiệp ({users.length} tài khoản)</p>
          </div>
          <button
            onClick={() => setCreatingUser(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400"
          >
            <UserPlus className="h-4 w-4" />
            <span>Thêm tài khoản</span>
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-white/10">
              <tr>
                <th className="pb-3 pr-4 font-semibold">Thành viên</th>
                <th className="pb-3 pr-4 font-semibold">Vai trò</th>
                <th className="pb-3 pr-4 font-semibold">Phòng ban / Chức vụ</th>
                <th className="pb-3 pr-4 font-semibold">SĐT</th>
                <th className="pb-3 pr-4 font-semibold">Trạng thái</th>
                <th className="pb-3 pr-2 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => {
                const roleConfig = ROLE_CONFIG[u.role] || { label: u.role, badgeClass: "bg-slate-700/60 text-slate-300 border border-slate-600/40" };
                const isOnline = u.status === "online";
                return (
                  <tr key={u._id} className="transition hover:bg-white/[0.02]">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 font-bold text-cyan-300 border border-cyan-500/30">
                          {u.displayName ? u.displayName.slice(0, 1).toUpperCase() : "U"}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-slate-100">{u.displayName}</span>
                          <span className="block truncate font-mono text-[11px] text-slate-400">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${roleConfig.badgeClass}`}>
                        {roleConfig.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      <div className="min-w-0">
                        <span className="block truncate font-medium">{u.department || "—"}</span>
                        {u.jobTitle && <span className="block truncate text-[11px] text-slate-400">{u.jobTitle}</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-300 font-mono">
                      {u.phone || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-slate-500"}`} />
                          {isOnline ? "Online" : "Offline"}
                        </span>
                        {u.disabledAt ? (
                          <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-300">
                            Vô hiệu hoá
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-slate-300 transition hover:border-cyan-400/40 hover:bg-slate-700 hover:text-cyan-300"
                          title="Chỉnh sửa tài khoản"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-300 transition hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-200"
                          title="Xóa tài khoản"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-slate-400">Chưa có tài khoản nào được tạo cho doanh nghiệp này.</p>
              <button
                onClick={() => setCreatingUser(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/30"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Thêm tài khoản ngay</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Nhật ký kiểm toán gần đây</h3>
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          {audit.map((a: any) => <li key={a.eventId}>{a.actionType}</li>)}
          {audit.length === 0 && <li className="text-slate-500">Không có sự kiện gần đây.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Vòng đời</h3>
        <div className="mt-3"><TenantLifecycleDialog code={code} onDone={load} /></div>
      </div>

      {creatingUser && (
        <TenantUserCreateModal
          code={code}
          companyName={tenant.name || code}
          onClose={() => setCreatingUser(false)}
          onSaved={load}
        />
      )}

      {editingUser && (
        <TenantUserEditModal
          code={code}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={load}
        />
      )}

      {deletingUser && (
        <TenantUserDeleteModal
          code={code}
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={load}
        />
      )}
    </section>
  );
}
