import React from "react";
import { Plus, Settings, Users, Trash2, Save, AlertTriangle, Award, Coins, ShieldCheck, Sparkles, Building2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { customerApi } from "./customerApi";
import CustomerDetailDrawer from "./components/CustomerDetailDrawer";
import CustomerFormDialog from "./components/CustomerFormDialog";
import CustomerList from "./components/CustomerList";
import { CurrencyInput } from "../../components/common/CurrencyInput";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { CUSTOMER_SUB_TAB_ROUTES, type CustomerSubTabType } from "../../router/subTabRoutes";
import type { Customer, CustomerInput, CustomerStatus, CustomerType, PaginatedCustomers, CustomerSettings, CustomerTier } from "./types";

const emptyResult: PaginatedCustomers = { items: [], total: 0, page: 1, limit: 20 };

export default function CustomerWorkspace() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode?.trim().toUpperCase() || "";
  const permissions = userProfile?.permissions || [];
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || permissions.includes("*") || permissions.includes("customer:manage");
  const [activeTab, setActiveTab] = useSubTabRouter<CustomerSubTabType>(CUSTOMER_SUB_TAB_ROUTES, "list");
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [status, setStatus] = React.useState<CustomerStatus>("active");
  const [type, setType] = React.useState<"" | CustomerType>("");
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [result, setResult] = React.useState(emptyResult);
  const [selected, setSelected] = React.useState<Customer | null>(null);
  const [editing, setEditing] = React.useState<Customer | "new" | null>(null);
  const [error, setError] = React.useState("");

  // Settings state
  const [settings, setSettings] = React.useState<CustomerSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!companyCode) return;
    try {
      setResult(await customerApi.list({ companyCode, q: debouncedQuery, status, type: type || undefined, page, limit }));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách khách hàng.");
    }
  }, [companyCode, debouncedQuery, status, type, page, limit]);

  const loadSettings = React.useCallback(async () => {
    if (!companyCode) return;
    setLoadingSettings(true);
    setError("");
    try {
      const data = await customerApi.getSettings(companyCode);
      setSettings(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được cấu hình phân hạng.");
    } finally {
      setLoadingSettings(false);
    }
  }, [companyCode]);

  React.useEffect(() => {
    if (activeTab === "list") {
      void load();
    } else {
      void loadSettings();
    }
  }, [activeTab, load, loadSettings]);

  const openDetail = async (customer: Customer) => {
    try { setSelected(await customerApi.detail(customer._id, companyCode)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ khách hàng."); }
  };

  const handleUpdateTier = (index: number, field: keyof CustomerTier, value: any) => {
    if (!settings) return;
    const newTiers = settings.customerTiers.map((tier, itemIndex) => {
      if (itemIndex === index) {
        if (field === "code") {
          return { ...tier, [field]: String(value).toLowerCase().replace(/[^a-z0-9-]/g, "") };
        }
        return { ...tier, [field]: value };
      }
      return tier;
    });
    setSettings({ ...settings, customerTiers: newTiers });
  };

  const handleAddTier = () => {
    if (!settings) return;
    const newTiers = [
      ...settings.customerTiers,
      {
        code: `tier-${settings.customerTiers.length + 1}`,
        name: `Hạng mới ${settings.customerTiers.length + 1}`,
        minGrossProfit: 0,
        minSpend: 0,
        pointMultiplier: 1.0,
      }
    ];
    setSettings({ ...settings, customerTiers: newTiers });
  };

  const handleRemoveTier = (index: number) => {
    if (!settings || index === 0) return;
    const newTiers = settings.customerTiers.filter((_, itemIndex) => itemIndex !== index);
    setSettings({ ...settings, customerTiers: newTiers });
  };

  const saveSettings = async () => {
    if (!settings || !companyCode) return;
    setSavingSettings(true);
    setError("");
    try {
      const data = await customerApi.updateSettings(
        {
          customerTiers: settings.customerTiers,
          pointsPolicy: settings.pointsPolicy,
          tierEvaluationMetric: settings.tierEvaluationMetric || "gross_profit",
          evaluationWindow: settings.evaluationWindow || "rolling12Months",
        },
        companyCode
      );
      setSettings(data);
      alert("Đã lưu cấu hình phân hạng Lợi Nhuận Gộp & Điểm thưởng thành công!");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình.");
    } finally {
      setSavingSettings(false);
    }
  };

  const totalCustomers = result.total || 0;
  const activeCount = result.items.filter((c) => c.status === "active").length;
  const vipCount = result.items.filter((c) => Boolean(c.tier)).length;
  const vatCount = result.items.filter((c) => c.type === "vat").length;

  return (
    <section className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-gradient-to-r from-cyan-50 to-teal-50 text-cyan-800 border border-cyan-200/60 mb-1.5 shadow-2xs">
            <Sparkles className="h-3 w-3 text-cyan-600" />
            <span>Quản trị quan hệ khách hàng (CRM)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Quản lý khách hàng
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Phân hạng VIP theo Lợi Nhuận Gộp thực tế & Sổ cái Điểm thưởng bất biến chuẩn kiểm toán.
          </p>
        </div>

        {canManage && activeTab === "list" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-600/20 hover:from-cyan-700 hover:to-teal-700 active:scale-[0.98] transition cursor-pointer"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/20 group-hover:scale-110 transition-transform">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <span>Thêm khách hàng</span>
          </button>
        )}
      </div>

      {/* Navigation Segmented Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("list")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === "list"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className={`h-4 w-4 ${activeTab === "list" ? "text-cyan-600" : "text-slate-400"}`} />
          <span>Danh sách khách hàng</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activeTab === "list"
                ? "bg-cyan-50 text-cyan-700 border border-cyan-100"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {result.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === "settings"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Award className={`h-4 w-4 ${activeTab === "settings" ? "text-amber-600" : "text-slate-400"}`} />
          <span>Phân hạng Lãi gộp & Điểm thưởng</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2 border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === "list" ? (
        <div className="space-y-5">
          {/* KPI Summary Bento Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng khách hàng</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                  <Users className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{totalCustomers}</span>
                <span className="text-xs font-semibold text-slate-400">hồ sơ</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đang hoạt động</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">{activeCount}</span>
                <span className="text-xs font-semibold text-slate-400">trên trang</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thành viên có VIP</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                  <Award className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-600">{vipCount}</span>
                <span className="text-xs font-semibold text-slate-400">đã phân hạng</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khách xuất VAT</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-600">{vatCount}</span>
                <span className="text-xs font-semibold text-slate-400">doanh nghiệp</span>
              </div>
            </div>
          </div>

          <CustomerList
            {...result}
            limit={limit}
            query={query}
            status={status}
            type={type}
            onQueryChange={(value) => { setQuery(value); setPage(1); }}
            onStatusChange={(value) => { setStatus(value); setPage(1); }}
            onTypeChange={(value) => { setType(value); setPage(1); }}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
            onOpen={(customer) => void openDetail(customer)}
          />
          {selected && (
            <CustomerDetailDrawer
              customer={selected}
              branchId={activeBranchId}
              canManage={canManage}
              onClose={() => setSelected(null)}
              onEdit={() => setEditing(selected)}
              onCustomerUpdated={() => {
                void load();
                if (selected) void openDetail(selected);
              }}
              onToggleStatus={() =>
                void customerApi
                  .setStatus(selected._id, selected.status === "active" ? "inactive" : "active", selected.version, companyCode)
                  .then((updated) => {
                    setSelected(updated);
                    void load();
                  })
                  .catch((cause) => setError(cause instanceof Error ? cause.message : "Không cập nhật được trạng thái."))
              }
            />
          )}
          {editing && (
            <CustomerFormDialog
              customer={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
              onSave={async (input: CustomerInput) => {
                const saved = editing === "new" ? await customerApi.create(input, companyCode) : await customerApi.update(editing._id, input, editing.version, companyCode);
                setEditing(null);
                setSelected(saved);
                await load();
              }}
            />
          )}
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* Banner Explanation */}
          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50/70 to-teal-50/40 p-5">
            <div className="flex items-center gap-2 text-cyan-900 font-bold text-base">
              <Award className="h-5 w-5 text-cyan-600" />
              <span>Chính sách Phân hạng VIP theo LỢI NHUẬN GỘP (Gross Profit)</span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Hệ thống tự động phân hạng thành viên dựa trên <b>Tổng Lợi Nhuận Gộp (Giá bán - Giá vốn)</b> thực tế mà khách hàng mang lại từ cả đơn bán máy/phụ kiện và phiếu sửa chữa.
              Giúp doanh nghiệp tri ân và bảo vệ chính xác tệp khách hàng nuôi sống cửa hàng, tránh thất thoát dòng tiền do phân hạng theo doanh thu ảo.
            </p>
          </div>

          {loadingSettings ? (
            <div className="text-center py-12 text-slate-500">Đang tải cấu hình...</div>
          ) : settings ? (
            <div className="space-y-6">
              {/* Tiers Table Card */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Các bậc phân hạng thành viên</h3>
                    <p className="text-xs text-slate-500">Bậc đầu tiên bắt đầu từ 0đ. Các bậc tiếp theo có ngưỡng lãi gộp tăng dần.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider">
                        <th className="py-3 px-4">Mã hạng</th>
                        <th className="py-3 px-4">Tên hiển thị</th>
                        <th className="py-3 px-4">Lợi nhuận gộp tối thiểu (VNĐ)</th>
                        <th className="py-3 px-3 text-center">Hệ số tích điểm</th>
                        {canManage && <th className="py-3 px-4 text-right">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {settings.customerTiers.map((tier, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition">
                          <td className="py-2.5 px-4">
                            <input
                              aria-label={`Mã hạng ${index + 1}`}
                              disabled={!canManage}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 w-full bg-white disabled:bg-slate-50 text-slate-800 font-mono text-xs placeholder:text-slate-400 placeholder:font-normal"
                              value={tier.code}
                              onChange={(e) => handleUpdateTier(index, "code", e.target.value)}
                              placeholder="vd: bronze, silver, gold, diamond"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              aria-label={`Tên hạng ${index + 1}`}
                              disabled={!canManage}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 w-full bg-white disabled:bg-slate-50 text-slate-800 font-bold text-xs placeholder:text-slate-400 placeholder:font-normal"
                              value={tier.name}
                              onChange={(e) => handleUpdateTier(index, "name", e.target.value)}
                              placeholder="Tên hiển thị (VD: Kim Cương)"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <CurrencyInput
                              aria-label={`Ngưỡng lãi gộp ${tier.name}`}
                              disabled={!canManage || index === 0}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 w-full bg-white disabled:bg-slate-50 text-slate-900 font-black text-xs placeholder:text-slate-400 placeholder:font-normal"
                              value={tier.minGrossProfit ?? tier.minSpend ?? 0}
                              onChange={(num) => handleUpdateTier(index, "minGrossProfit", num)}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              aria-label={`Hệ số điểm ${tier.name}`}
                              type="number"
                              min="1"
                              max="10"
                              step="0.1"
                              disabled={!canManage}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 w-20 text-center bg-white disabled:bg-slate-50 text-cyan-800 font-bold text-xs placeholder:text-slate-400 placeholder:font-normal"
                              value={tier.pointMultiplier || 1.0}
                              onChange={(e) => handleUpdateTier(index, "pointMultiplier", Number(e.target.value))}
                              placeholder="1.0"
                            />
                          </td>
                          {canManage && (
                            <td className="py-2.5 px-4 text-right">
                              {index > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTier(index)}
                                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                                  title="Xóa phân hạng này"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium select-none pr-2">Mặc định</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canManage && (
                  <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-white px-3.5 py-1.5 text-xs font-bold text-cyan-700 shadow-2xs hover:bg-cyan-50 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm bậc xếp hạng
                    </button>
                  </div>
                )}
              </div>

              {/* Points Policy Settings Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Chính sách Tích điểm & Cấn trừ Tiền</h3>
                      <p className="text-xs text-slate-500">Quy tắc tự động tích điểm theo Lãi gộp và bảo vệ dòng tiền khi cấn trừ</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.pointsPolicy?.enabled ?? true}
                      disabled={!canManage}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          pointsPolicy: {
                            ...(settings.pointsPolicy || {
                              enabled: true,
                              grossProfitPerPoint: 10000,
                              pointRedeemValue: 1000,
                              maxRedeemPercent: 50,
                              minOrderTotalForRedeem: 50000,
                              allowRepairRedeem: true,
                              allowRetailRedeem: true,
                            }),
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-xs font-bold text-slate-800">Bật hệ thống điểm thưởng</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tỷ lệ tích điểm: Mỗi bao nhiêu tiền Lãi Gộp được 1 điểm?
                    </label>
                    <div className="relative">
                      <CurrencyInput
                        disabled={!canManage}
                        value={settings.pointsPolicy?.grossProfitPerPoint || 10000}
                        placeholder="10.000"
                        onChange={(num) =>
                          setSettings({
                            ...settings,
                            pointsPolicy: {
                              ...(settings.pointsPolicy as any),
                              grossProfitPerPoint: num,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">VNĐ / 1 điểm</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">Mặc định: 10.000đ lãi gộp tích 1 điểm</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tỷ lệ quy đổi tiêu điểm: 1 điểm cấn trừ được bao nhiêu tiền?
                    </label>
                    <div className="relative">
                      <CurrencyInput
                        disabled={!canManage}
                        value={settings.pointsPolicy?.pointRedeemValue || 1000}
                        placeholder="1.000"
                        onChange={(num) =>
                          setSettings({
                            ...settings,
                            pointsPolicy: {
                              ...(settings.pointsPolicy as any),
                              pointRedeemValue: num,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">VNĐ / 1 điểm</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">Tương đương: 100 điểm = 100.000 VNĐ</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Trần cấn trừ tối đa cho một đơn hàng / phiếu sửa
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        disabled={!canManage}
                        value={settings.pointsPolicy?.maxRedeemPercent || 50}
                        placeholder="50"
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            pointsPolicy: {
                              ...(settings.pointsPolicy as any),
                              maxRedeemPercent: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">% giá trị đơn</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">Bảo vệ dòng tiền: tránh khách trừ 100% gây lỗ</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Giá trị đơn hàng tối thiểu để được áp dụng điểm
                    </label>
                    <div className="relative">
                      <CurrencyInput
                        disabled={!canManage}
                        value={settings.pointsPolicy?.minOrderTotalForRedeem || 50000}
                        placeholder="50.000"
                        onChange={(num) =>
                          setSettings({
                            ...settings,
                            pointsPolicy: {
                              ...(settings.pointsPolicy as any),
                              minOrderTotalForRedeem: num,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">VNĐ</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button Bar */}
              {canManage && (
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => void saveSettings()}
                    disabled={savingSettings}
                    className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 transition disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {savingSettings ? "Đang lưu cấu hình..." : "Lưu tất cả cấu hình"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-center py-12 border border-dashed rounded-2xl">Không tìm thấy dữ liệu cấu hình.</div>
          )}
        </div>
      )}
    </section>
  );
}
