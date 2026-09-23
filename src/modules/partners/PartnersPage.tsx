import React from "react";
import "./partners.css";
import {
  Users,
  UserCheck,
  Building2,
  Plus,
  Search,
  SlidersHorizontal,
  Receipt,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  Trash2,
  Copy,
  Coins,
  Shield,
  X,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sparkles,
  DollarSign,
  Smartphone,
  Percent,
  Wrench,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ContactRound,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { partnerRequest, type Partner } from "./partnerApi";

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n || 0);

const roles: Record<string, string> = {
  collaborator: "CTV",
  dealer: "Đại lý",
  supplier: "Nhà cung cấp",
};

const partnerGroupDescription: Record<string, string> = {
  collaborator: "Tra cứu sao kê, doanh số và thưởng KPI cá nhân.",
  dealer: "Theo dõi thông tin đại lý và các giao dịch được liên kết.",
  supplier: "Theo dõi hồ sơ nhà cung cấp và liên kết với doanh nghiệp.",
};

const kindNames: Record<string, string> = {
  earning: "Hoa hồng",
  reversal: "Thu hồi",
  kpi: "Thưởng/điều chỉnh KPI",
  payout: "Đã chi",
};

const month = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------
// PARTNER MODAL FORM (Create / Edit)
// ---------------------------------------------------------
function PartnerForm({
  initial,
  onSaved,
  onClose,
}: {
  initial: Partial<Partner>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    roles: ["collaborator"],
    status: "active",
    phone: "",
    email: "",
    address: "",
    userId: "",
    accountPassword: "",
    ...initial,
  });
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await partnerRequest(
        initial._id ? `/${initial._id}` : "/",
        initial._id ? "PATCH" : "POST",
        form
      );
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 text-white shadow-md shadow-cyan-500/20">
              <ContactRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {initial._id ? "Sửa thông tin đối tác" : "Thêm đối tác"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quản lý hồ sơ CTV, đại lý đối tác hoặc liên kết nhà cung cấp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={save} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Info */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Thông tin định danh
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mã đối tác <span className="text-rose-500">*</span>
                <input
                  required
                  placeholder="VD: CTV-001, DL-MINH"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                  value={String(form.code || "")}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>

              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tên đối tác <span className="text-rose-500">*</span>
                <input
                  required
                  placeholder="Họ tên cá nhân hoặc tên đại lý"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                  value={String(form.name || "")}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Liên hệ & Địa chỉ
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Điện thoại
                <input
                  placeholder="0912 345 678"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                  value={String(form.phone || "")}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email
                <input
                  required={!initial._id}
                  type="email"
                  placeholder="partner@example.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                  value={String(form.email || "")}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              {!initial._id && (
                <label className="sm:col-span-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mật khẩu tài khoản <span className="text-rose-500">*</span>
                  <input
                    required
                    minLength={6}
                    maxLength={128}
                    type="password"
                    placeholder="Ít nhất 6 ký tự"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                    value={String(form.accountPassword || "")}
                    onChange={(e) => setForm({ ...form, accountPassword: e.target.value })}
                  />
                  <span className="mt-1.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                    Tài khoản sẽ được cấp ngay sau khi lưu hồ sơ với quyền chỉ xem cổng Đối tác.
                  </span>
                </label>
              )}

              <label className="sm:col-span-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Địa chỉ
                <input
                  placeholder="Địa chỉ giao dịch, nhận hàng hoặc liên hệ"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                  value={String(form.address || "")}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Roles & Status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Nhóm đối tác (chọn 1 nhóm)
              </span>
              <div className="space-y-2">
                {Object.entries(roles).map(([key, label]) => {
                  const checked = form.roles.includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                        checked
                          ? "border-cyan-500/40 bg-cyan-50/50 ring-1 ring-cyan-500/20 dark:border-cyan-500/40 dark:bg-cyan-950/20"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {label}
                      </span>
                      <input
                        type="radio"
                        name="partnerRole"
                        aria-label={label}
                        className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        checked={checked}
                        onChange={() =>
                          setForm({
                            ...form,
                            roles: [key],
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Trạng thái
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900 cursor-pointer"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </label>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Ghi chú:</span> Đối tác ngừng hoạt động sẽ không thể gắn vào đơn hàng mới hoặc tính hoa hồng phát sinh.
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 transition cursor-pointer"
            >
              {busy ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PartnerAccountModal({
  partner,
  onCreated,
  onClose,
}: {
  partner: Partner;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = React.useState(partner.email || "");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState(partner.name || "");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await partnerRequest(`/${partner._id}/account`, "POST", { email, password, displayName });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cấp tài khoản đối tác</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{partner.name} · {roles[partner.roles?.[0]] || "Đối tác"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
          <p className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-3 text-xs leading-5 text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-200">
            Tài khoản chỉ được xem cổng Đối tác và dữ liệu thuộc hồ sơ này. Gửi thông tin đăng nhập cho đối tác qua kênh an toàn.
          </p>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Email đăng nhập <span className="text-rose-500">*</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100" />
          </label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tên hiển thị
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100" />
          </label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Mật khẩu tạm thời <span className="text-rose-500">*</span>
            <input required minLength={6} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ít nhất 6 ký tự" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-500/20 disabled:opacity-50">{busy ? "Đang cấp..." : "Cấp tài khoản"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// COMMISSION STATEMENT VIEW (Full statement & Payout)
// ---------------------------------------------------------
function Statement({
  partnerId,
  self,
  canPay,
  onClose,
}: {
  partnerId?: string;
  self: boolean;
  canPay: boolean;
  onClose?: () => void;
}) {
  const [period, setPeriod] = React.useState(month);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [reference, setReference] = React.useState("");
  const payoutKey = React.useRef(crypto.randomUUID());
  const requestNumber = React.useRef(0);
  const partnerGroup = String(data?.partner?.roles?.[0] || "collaborator");
  const partnerGroupLabel = roles[partnerGroup] || "Đối tác";
  const isCommissionPartner = partnerGroup === "collaborator";

  const load = React.useCallback(async () => {
    const request = ++requestNumber.current;
    setError("");
    try {
      const result = await partnerRequest(
        self ? "/me/statement" : `/${partnerId}/statement`,
        "GET",
        undefined,
        { period, page }
      );
      if (request === requestNumber.current) setData(result);
    } catch (e) {
      if (request === requestNumber.current) {
        setData(null);
        setError((e as Error).message);
      }
    }
  }, [self, partnerId, period, page]);

  React.useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const payout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`Xác nhận đã chi ${money(Number(amount))} cho ${data?.partner?.name}, chứng từ ${reference}?`))
      return;
    setBusy(true);
    try {
      await partnerRequest(`/${partnerId}/payouts`, "POST", {
        amount: Number(amount),
        reference,
        idempotencyKey: payoutKey.current,
      });
      payoutKey.current = crypto.randomUUID();
      setAmount("");
      setReference("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isCommissionPartner ? `Sao kê hoa hồng ${data?.partner?.name || ""}` : `Cổng ${partnerGroupLabel}: ${data?.partner?.name || ""}`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isCommissionPartner ? "Chi tiết các khoản phát sinh, thưởng KPI và lịch sử thanh toán hoa hồng" : partnerGroupDescription[partnerGroup]}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isCommissionPartner && <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Kỳ tra cứu:</span>
            <input
              aria-label="Tháng sao kê"
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            />
          </div>}
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400 dark:hover:bg-slate-700/60 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Làm mới
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Thông tin nhóm đối tác</p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">{partnerGroupLabel}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{partnerGroupDescription[partnerGroup] || "Thông tin được giới hạn theo hồ sơ đối tác."}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-xs">
                <span className="text-slate-500">Mã đối tác</span><b className="font-mono text-slate-800 dark:text-slate-200">{data.partner.code || "—"}</b>
                <span className="text-slate-500">Trạng thái</span><b className={data.partner.status !== "inactive" ? "text-emerald-600" : "text-slate-500"}>{data.partner.status !== "inactive" ? "Hoạt động" : "Ngừng hoạt động"}</b>
                {data.partner.email && <><span className="text-slate-500">Email</span><b className="max-w-[220px] truncate text-slate-800 dark:text-slate-200">{data.partner.email}</b></>}
                {data.partner.phone && <><span className="text-slate-500">Điện thoại</span><b className="text-slate-800 dark:text-slate-200">{data.partner.phone}</b></>}
                {data.partner.supplierId && <><span className="text-slate-500">Mã liên kết NCC</span><b className="max-w-[220px] truncate font-mono text-slate-800 dark:text-slate-200">{data.partner.supplierId}</b></>}
              </div>
            </div>
          </div>

          <div className={isCommissionPartner ? "contents" : "hidden"}>
          {/* Summary Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Balance Card */}
            <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50/40 p-4.5 dark:border-sky-950 dark:from-sky-950/30 dark:to-cyan-950/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                  Số dư toàn bộ kỳ
                </p>
                <Coins className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <p className={`mt-2 text-2xl font-extrabold ${data.partner.balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {money(data.partner.balance)}
              </p>
              <p className="mt-1 text-xs text-sky-900/70 dark:text-sky-300/70">
                Số âm được bù trừ vào khoản phát sinh tiếp theo.
              </p>
            </div>

            {/* Machines KPI */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50/40 p-4.5 dark:border-indigo-950 dark:from-indigo-950/30 dark:to-purple-950/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                  Máy hợp lệ trong tháng
                </p>
                <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {data.kpi.machines} máy
              </p>
              <p className="mt-1 text-xs text-indigo-900/70 dark:text-indigo-300/70">
                {data.kpi.nextThreshold
                  ? `Còn ${data.kpi.nextThreshold - data.kpi.machines} máy đến mốc ${data.kpi.nextThreshold}`
                  : "Đã đạt bậc cao nhất"}
              </p>
            </div>

            {/* Bonus Card */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4.5 dark:border-emerald-950 dark:from-emerald-950/30 dark:to-teal-950/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Thưởng KPI {data.kpi.provisional ? "(tạm tính)" : "(quyền lợi hiện tại)"}
                </p>
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                {money(data.kpi.bonus)}
              </p>
              <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-300/70">
                10 máy: 1 triệu · 20 máy: 2,5 triệu
              </p>
            </div>
          </div>

          {/* Pending Orders Notice */}
          <details className="group rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition dark:border-slate-800 dark:bg-slate-800/40">
            <summary className="cursor-pointer text-xs font-bold text-slate-700 select-none hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400 flex items-center justify-between">
              <span>Đơn đang chờ đủ điều kiện (toàn bộ kỳ)</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {data.pending?.length || 0} khoản đang chờ
              </span>
            </summary>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Tối đa 100 đơn bán và 100 phiếu sửa. Khoản dự kiến chưa cộng vào số dư khả dụng.
            </p>
            <div className="mt-2.5 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
              {(data.pending || []).map((r: any, i: number) => (
                <div key={i} className="pt-1.5 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="font-mono font-medium text-cyan-600 dark:text-cyan-400">{r.code}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{money(r.amount)} dự kiến</span>
                  <span className="text-slate-500">{r.reason}</span>
                </div>
              ))}
              {(!data.pending || data.pending.length === 0) && (
                <p className="pt-2 text-xs text-slate-400 italic">Không có khoản nào đang chờ duyệt.</p>
              )}
            </div>
          </details>

          {/* Sums Breakdown Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tổng kết tháng:</span>
            {data.sums.map((s: any) => (
              <span
                key={s._id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                <span>{kindNames[s._id]}:</span>
                <b className={s._id === 'reversal' || s._id === 'payout' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  {money(s._id === "payout" ? -s.amount : s.amount)}
                </b>
              </span>
            ))}
          </div>

          {/* Statement Entries Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="p-3">Ngày</th>
                  <th className="p-3">Chứng từ</th>
                  <th className="p-3">Loại / cách tính</th>
                  <th className="p-3 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.entries.map((r: any) => (
                  <tr key={r._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="whitespace-nowrap p-3 text-xs text-slate-600 dark:text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="p-3 text-xs font-mono font-medium text-slate-900 dark:text-slate-100">
                      {r.sourceCode || r.reference || "—"}
                    </td>
                    <td className="p-3 text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {kindNames[r.kind] || r.kind}
                      </p>
                      {r.reason && (
                        <p className="text-slate-500 dark:text-slate-400">{r.reason}</p>
                      )}
                      {r.calculation?.label && (
                        <p className="mt-0.5 font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                          {r.calculation.label}:{" "}
                          {r.calculation.kind === "phone"
                            ? `${r.calculation.quantity} máy × ${money(r.calculation.rate)}`
                            : `${money(r.calculation.base)} × ${r.calculation.rate / 100}%`}
                          {r.calculation.returnedQuantity > 0 ? ` · trả ${r.calculation.returnedQuantity}` : ""}
                          {r.calculation.refundedBase > 0 ? ` · hoàn ${money(r.calculation.refundedBase)}` : ""}
                        </p>
                      )}
                      {r.calculation?.entitlement !== undefined && (
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
                          Quyền lợi còn lại: {money(r.calculation.entitlement)}
                        </p>
                      )}
                    </td>
                    <td
                      className={`whitespace-nowrap p-3 text-right font-bold text-sm ${
                        r.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {money(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.total === 0 && (
              <div className="py-10 text-center text-slate-400 dark:text-slate-500">
                <Receipt className="mx-auto mb-2 h-8 w-8 stroke-1 opacity-50" />
                <p>Chưa có phát sinh trong tháng này.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              Trang {page} · {data.total} khoản
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
              >
                Trước
              </button>
              <button
                disabled={page * 100 >= data.total}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>

          {/* Payout Confirmation Section */}
          {canPay && !self && (
            <form
              className="mt-6 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4.5 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              onSubmit={payout}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Xác nhận chi trả
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chỉ xác nhận sau khi đã chuyển tiền. Hoàn/hủy đơn sau chi sẽ ghi số dư cần bù trừ.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <input
                  required
                  aria-label="Số tiền chi"
                  type="number"
                  min="1"
                  max={Math.max(0, data.partner.balance)}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    payoutKey.current = crypto.randomUUID();
                  }}
                  placeholder="Số tiền chi (VND)"
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  required
                  aria-label="Chứng từ chi"
                  value={reference}
                  onChange={(e) => {
                    setReference(e.target.value);
                    payoutKey.current = crypto.randomUUID();
                  }}
                  placeholder="Mã chứng từ chuyển tiền (UNC, mã giao dịch...)"
                  className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={busy || data.partner.balance <= 0}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-40 transition cursor-pointer"
                >
                  {busy ? "Đang xử lý..." : "Xác nhận đã chi"}
                </button>
              </div>
            </form>
          )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------
// COMMISSION POLICY EDITOR
// ---------------------------------------------------------
function PolicyEditor({ partners }: { partners: Partner[] }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [config, setConfig] = React.useState<any>({
    phoneAmount: 200000,
    accessoryBps: 1000,
    repairBps: 1000,
    rules: [],
  });
  const [partnerId, setPartnerId] = React.useState("");
  const [effectiveAt, setEffectiveAt] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = () =>
    partnerRequest("/policies")
      .then((data) => setItems(data.items))
      .catch((e) => setMessage(e.message));

  React.useEffect(() => {
    void load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await partnerRequest("/policies", "POST", {
        partnerId,
        ...(effectiveAt ? { effectiveAt: new Date(effectiveAt).toISOString() } : {}),
        config,
      });
      setMessage("Đã tạo phiên bản chính sách mới.");
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={save}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Chính sách hoa hồng
          </h2>
          <p className="text-xs text-slate-500">
            Mỗi lần lưu tạo phiên bản mới. Quy tắc SKU ưu tiên hơn nhóm hàng. Cần khai báo nhóm/SKU cho mọi hàng bán có gắn CTV.
          </p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-700"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Scope and Base Settings */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Phạm vi & Mức hoa hồng cơ sở
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">
            Áp dụng cho
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-cyan-500 cursor-pointer"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">Mặc định toàn công ty</option>
              {partners
                .filter((p) => p.roles.includes("collaborator"))
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code})
                  </option>
                ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-700">
            Hiệu lực (để trống = ngay)
            <input
              type="datetime-local"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-cyan-500"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold text-slate-700">
            Điện thoại / máy (VND)
            <div className="relative mt-1.5">
              <input
                type="number"
                min="150000"
                max="300000"
                step="1000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-cyan-500"
                value={config.phoneAmount}
                onChange={(e) =>
                  setConfig({ ...config, phoneAmount: Number(e.target.value) })
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                đ / máy
              </span>
            </div>
          </label>

          {[
            ["accessoryBps", "Phụ kiện (%)"],
            ["repairBps", "Tiền công sửa chữa (%)"],
          ].map(([key, label]) => (
            <label key={key} className="text-xs font-semibold text-slate-700">
              {label}
              <div className="relative mt-1.5">
                <input
                  type="number"
                  min="10"
                  max="15"
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-cyan-500"
                  value={config[key] / 100}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      [key]: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                  %
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Specific Rules */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Quy tắc hoa hồng riêng biệt (SKU / Nhóm hàng)
          </h3>
          <span className="text-xs text-slate-400">
            {config.rules.length} quy tắc
          </span>
        </div>

        <div className="space-y-2.5">
          {config.rules.map((r: any, index: number) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
            >
              <select
                aria-label="Loại sản phẩm"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
                value={r.kind}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rules: config.rules.map((v: any, i: number) =>
                      i === index
                        ? { ...v, kind: e.target.value, amount: undefined, rateBps: undefined }
                        : v
                    ),
                  })
                }
              >
                <option value="phone">Điện thoại</option>
                <option value="accessory">Phụ kiện</option>
              </select>

              <select
                aria-label="Loại quy tắc"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
                value={r.sku !== undefined ? "sku" : "category"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rules: config.rules.map((v: any, i: number) =>
                      i === index
                        ? { kind: v.kind, [e.target.value]: "" }
                        : v
                    ),
                  })
                }
              >
                <option value="category">Nhóm hàng</option>
                <option value="sku">SKU</option>
              </select>

              <input
                aria-label="SKU hoặc nhóm hàng"
                required
                placeholder="Nhập mã SKU hoặc tên nhóm..."
                className="min-w-[150px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
                value={r.sku ?? r.category}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rules: config.rules.map((v: any, i: number) =>
                      i === index
                        ? { ...v, [r.sku !== undefined ? "sku" : "category"]: e.target.value }
                        : v
                    ),
                  })
                }
              />

              <input
                aria-label="Mức riêng (để trống dùng mặc định)"
                type="number"
                placeholder={r.kind === "phone" ? "đ/máy (mặc định)" : "% (mặc định)"}
                className="w-44 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
                min={r.kind === "phone" ? 150000 : 10}
                max={r.kind === "phone" ? 300000 : 15}
                step={r.kind === "phone" ? 1000 : 0.01}
                value={
                  r.kind === "phone"
                    ? r.amount ?? ""
                    : r.rateBps === undefined
                    ? ""
                    : r.rateBps / 100
                }
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rules: config.rules.map((v: any, i: number) =>
                      i === index
                        ? {
                            ...v,
                            [r.kind === "phone" ? "amount" : "rateBps"]:
                              e.target.value === ""
                                ? undefined
                                : Math.round(
                                    Number(e.target.value) * (r.kind === "phone" ? 1 : 100)
                                  ),
                          }
                        : v
                    ),
                  })
                }
              />

              <button
                type="button"
                className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                onClick={() =>
                  setConfig({
                    ...config,
                    rules: config.rules.filter((_: any, i: number) => i !== index),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                <span>Xóa</span>
              </button>
            </div>
          ))}

          {config.rules.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              Chưa có quy tắc riêng biệt nào. Hệ thống sẽ áp dụng mức cơ sở mặc định.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            onClick={() =>
              setConfig({
                ...config,
                rules: [...config.rules, { kind: "phone", category: "" }],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Thêm quy tắc
          </button>

          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-6 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 transition cursor-pointer"
          >
            {busy ? "Đang lưu..." : "Lưu phiên bản"}
          </button>
        </div>
      </div>

      {/* Version History */}
      <div className="border-t border-slate-100 pt-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Phiên bản gần đây
        </h3>
        <div className="space-y-2">
          {items.map((p) => (
            <div
              key={p._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">
                  {p.partnerId
                    ? partners.find((x) => x._id === p.partnerId)?.name || p.partnerId
                    : "Toàn công ty"}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {new Date(p.effectiveAt).toLocaleString("vi-VN")}
                </span>
                <span className="text-slate-400">·</span>
                <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  {p.config?.rules?.length || 0} quy tắc
                </span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer"
                onClick={() => {
                  setConfig(structuredClone(p.config));
                  setPartnerId(p.partnerId || "");
                  setEffectiveAt("");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Sao chép cấu hình
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-slate-400 italic">Chưa có phiên bản nào được ghi nhận.</p>
          )}
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------
// MAIN PARTNERS PAGE COMPONENT
// ---------------------------------------------------------
export default function PartnersPage() {
  const { hasPermission } = useAuth();
  const admin = hasPermission("partner:read") || hasPermission("partner:manage");

  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [role, setRole] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState("");
  const [editing, setEditing] = React.useState<Partial<Partner> | null>(null);
  const [accountPartner, setAccountPartner] = React.useState<Partner | null>(null);
  const [tab, setTab] = React.useState("list");
  const [error, setError] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(() => {
    setRefreshing(true);
    return partnerRequest<Partner[]>("/")
      .then((data) => {
        setPartners(data);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, []);

  React.useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  // Partner accounts without management permission use the self portal.
  if (!admin) {
    return (
      <div id="partners-page" className="w-full min-w-0 space-y-6 px-0.5 py-4 sm:py-6 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 text-white shadow-md shadow-cyan-500/20">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Hoa hồng của tôi
            </h1>
            <p className="text-xs text-slate-500">
              Tra cứu doanh số, sao kê hoa hồng và tiến độ thưởng KPI cá nhân
            </p>
          </div>
        </div>
        <Statement self canPay={false} />
      </div>
    );
  }

  // Filtered partners
  const filtered = partners.filter(
    (p) =>
      (!role || p.roles.includes(role)) &&
      `${p.code} ${p.name} ${p.phone || ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
  );

  // Quick stats
  const totalCollaborators = partners.filter((p) => p.roles.includes("collaborator")).length;
  const totalDealers = partners.filter((p) => p.roles.includes("dealer")).length;
  const totalSuppliers = partners.filter((p) => p.roles.includes("supplier")).length;
  const totalBalance = partners.reduce((acc, curr) => acc + (curr.balance || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 text-left">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-lg shadow-cyan-500/25">
            <ContactRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Quản lý đối tác
            </h1>
            <p className="text-xs font-medium text-slate-500">
              CTV, đại lý, nhà cung cấp và hoa hồng bán hàng.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <nav className="flex items-center rounded-xl bg-slate-100 p-1">
          <button
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              tab === "list"
                ? "bg-white text-cyan-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setTab("list")}
          >
            <Users className="h-3.5 w-3.5" />
            Đối tác & hoa hồng
          </button>
          {hasPermission("commission-policy:manage") && (
            <button
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
                tab === "policy"
                  ? "bg-white text-cyan-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setTab("policy")}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Chính sách
            </button>
          )}
        </nav>
      </div>

      {/* Top Metric Cards */}
      {tab === "list" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-300 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Users className="h-5 w-5" />
              </div>
              <p className="min-w-0 break-words text-2xl font-extrabold text-slate-900">{partners.length}</p>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">Tổng đối tác</p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white">
                <UserCheck className="h-5 w-5" />
              </div>
              <p className="min-w-0 break-words text-2xl font-extrabold text-slate-900">{totalCollaborators}</p>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">Cộng tác viên (CTV)</p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="min-w-0 break-words text-2xl font-extrabold text-slate-900">{totalDealers + totalSuppliers}</p>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">Đại lý & Nhà CC</p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Coins className="h-5 w-5" />
              </div>
              <p className="min-w-0 break-words text-2xl font-extrabold text-slate-900">{money(totalBalance)}</p>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">Tổng số dư hoa hồng</p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tab === "policy" ? (
        <PolicyEditor partners={partners} />
      ) : (
        <>
          {/* Create/Edit Modal Dialog */}
          {editing && (
            <PartnerForm
              key={editing._id || "new"}
              initial={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                void load();
              }}
            />
          )}
          {accountPartner && (
            <PartnerAccountModal
              partner={accountPartner}
              onClose={() => setAccountPartner(null)}
              onCreated={() => {
                setAccountPartner(null);
                void load();
              }}
            />
          )}

          {/* Action and Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {/* Search Box */}
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="Tìm đối tác"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Tìm mã, tên, điện thoại"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Group Filter */}
              <select
                aria-label="Nhóm đối tác"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-cyan-500 cursor-pointer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Tất cả nhóm</option>
                {Object.entries(roles).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Admin Actions */}
            {hasPermission("partner:manage") && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  onClick={() =>
                    void partnerRequest("/import-suppliers", "POST", {})
                      .then(load)
                      .catch((e) => setError(e.message))
                  }
                >
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  Liên kết NCC hiện có
                </button>

                <button
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-500 hover:to-sky-500 transition cursor-pointer"
                  onClick={() => setEditing({})}
                >
                  <Plus className="h-4 w-4" />
                  Thêm đối tác
                </button>
              </div>
            )}
          </div>

          {/* Partners Table Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3.5">Đối tác</th>
                    <th className="p-3.5">Nhóm</th>
                    <th className="p-3.5">Liên hệ</th>
                    <th className="p-3.5">Trạng thái</th>
                    <th className="p-3.5 text-right">Số dư</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => (
                    <tr
                      key={p._id}
                      className="group hover:bg-slate-50/80 transition"
                    >
                      {/* Name & Code */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/20 to-sky-500/20 font-bold text-xs text-cyan-700">
                            {getInitials(p.name || "DT")}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-cyan-600 transition">
                              {p.name}
                            </p>
                            <span className="font-mono text-xs font-medium text-slate-400">
                              {p.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Roles */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {p.roles.map((r) => (
                            <span
                              key={r}
                              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                r === "collaborator"
                                  ? "bg-cyan-50 text-cyan-700"
                                  : r === "dealer"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {roles[r] || r}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-3.5 text-xs text-slate-600">
                        {p.phone ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{p.phone}</span>
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                        {p.email && (
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Mail className="h-3 w-3" />
                            <span>{p.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            p.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                            }`}
                          />
                          {p.status === "active" ? "Hoạt động" : "Ngừng hoạt động"}
                        </span>
                      </td>

                      {/* Balance */}
                      <td
                        className={`whitespace-nowrap p-3.5 text-right font-extrabold text-sm ${
                          p.balance < 0
                            ? "text-rose-600"
                            : p.balance > 0
                            ? "text-emerald-600"
                            : "text-slate-700"
                        }`}
                      >
                        {money(p.balance)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          {p.roles.includes("collaborator") && (
                            <button
                              className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50/80 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
                              onClick={() => setSelected(p._id)}
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Sao kê
                            </button>
                          )}
                          {hasPermission("partner:manage") && (
                            <>
                              {p.userId ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700" title="Đã liên kết tài khoản đăng nhập">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Đã cấp
                                </span>
                              ) : (
                                <button
                                  className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
                                  onClick={() => setAccountPartner(p)}
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Cấp tài khoản
                                </button>
                              )}
                              <button
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                onClick={() => setEditing(p)}
                              >
                                <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                                Sửa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!filtered.length && (
              <div className="p-12 text-center text-slate-400">
                <Users className="mx-auto mb-2 h-10 w-10 stroke-1 opacity-40" />
                <p className="text-sm font-medium">Chưa có đối tác phù hợp.</p>
                <p className="text-xs mt-1 text-slate-400">
                  Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc nhóm đối tác
                </p>
              </div>
            )}
          </div>

          {/* Statement View for Selected Partner */}
          {selected && (
            <Statement
              key={selected}
              partnerId={selected}
              self={false}
              canPay={hasPermission("commission-payment:manage")}
              onClose={() => setSelected("")}
            />
          )}
        </>
      )}
    </div>
  );
}
