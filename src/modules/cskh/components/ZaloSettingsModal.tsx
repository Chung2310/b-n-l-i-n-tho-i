import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  RotateCw,
  Building2,
  LogIn,
  LogOut,
  Sparkles,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import {
  cskhApi,
  type CskhZaloConfig,
  type CskhBranch,
} from "../api/cskh.api";
import { toast } from "../../../pages/Toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyCode: string;
}

export default function ZaloSettingsModal({ isOpen, onClose }: Props) {
  const [branches, setBranches] = useState<CskhBranch[]>([]);
  const [configs, setConfigs] = useState<CskhZaloConfig[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await cskhApi.getZaloConfigs();
      setBranches(res.branches || []);
      setConfigs(res.configs || []);
    } catch (err: any) {
      toast.error(err?.message || "Không thể tải danh sách kết nối Zalo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen]);

  // Lắng nghe sự kiện OAuth Callback hoàn tất từ popup Zalo
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "ZALO_AUTH_RESULT") {
        if (event.data.success) {
          toast.success(
            `🎉 Đã kết nối thành công với Zalo OA: ${event.data.oaName || "Official Account"}`
          );
          void loadData();
        } else {
          toast.error(event.data.message || "Kết nối Zalo OA thất bại.");
        }
        setAuthorizing(false);
      }
    };
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  if (!isOpen) return null;

  const currentConfig = configs.find((c) => c.branchId === selectedBranchId);
  const currentBranchName =
    selectedBranchId === "ALL"
      ? "Toàn bộ hệ thống"
      : branches.find((b) => b._id === selectedBranchId)?.name || "Chi nhánh";

  // Khởi chạy popup Đăng nhập & Cấp quyền Zalo OA
  const handleOAuthLogin = async () => {
    try {
      setAuthorizing(true);
      const res = await cskhApi.getZaloOAuthUrl(selectedBranchId);
      if (res?.authUrl) {
        const width = 600;
        const height = 740;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          res.authUrl,
          "zalo_oauth_popup",
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );
        if (!popup) {
          toast.error("Trình duyệt chặn popup. Vui lòng cho phép popup để mở màn hình đăng nhập Zalo.");
          setAuthorizing(false);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Không thể khởi tạo đăng nhập Zalo OA.");
      setAuthorizing(false);
    }
  };

  // Kiểm tra kết nối
  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await cskhApi.testZaloConfig(selectedBranchId);
      if (res.connected) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Kiểm tra kết nối thất bại.");
    } finally {
      setTesting(false);
    }
  };

  // Ngắt kết nối
  const handleDisconnect = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn ngắt kết nối Zalo OA của ${currentBranchName}?`)) {
      return;
    }
    setDisconnecting(true);
    try {
      await cskhApi.disconnectZaloConfig(selectedBranchId);
      toast.success(`Đã ngắt kết nối Zalo OA cho ${currentBranchName}`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Không thể ngắt kết nối.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Tối Giản */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0068FF] text-white font-black shadow-md shadow-blue-500/20 text-base">
              Z
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Kết Nối Zalo Official Account
              </h2>
              <p className="text-xs text-slate-500">
                Đăng nhập 1-click & đồng bộ tin nhắn khách hàng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nội Dung Chính */}
        <div className="p-6 space-y-5">
          {/* Bộ Chọn Chi Nhánh / Trung Tâm */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              Chi nhánh / Trung tâm áp dụng:
            </label>
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition shadow-2xs"
              >
                <option value="ALL">🏢 Toàn bộ trung tâm (Dùng chung)</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    📍 {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* CARD TRẠNG THÁI KẾT NỐI */}
          {currentConfig?.isConnected ? (
            /* TRƯỜNG HỢP: ĐÃ KẾT NỐI */
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {currentConfig.oaAvatar ? (
                    <img
                      src={currentConfig.oaAvatar}
                      alt="OA Avatar"
                      className="h-12 w-12 rounded-2xl border border-emerald-300 object-cover shadow-xs"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-xs">
                      Z
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {currentConfig.oaName || "Zalo Official Account"}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Đang kết nối
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                      OA ID: {currentConfig.oaId} • {currentBranchName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thông tin tự động */}
              <div className="rounded-xl bg-white p-3 border border-emerald-100 text-[11px] text-slate-600 space-y-1 shadow-2xs">
                <p className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Đang hoạt động tự động:
                </p>
                <p className="text-slate-500">
                  • Tin nhắn khách nhắn tới Zalo OA sẽ tự động đổ về Hộp thư CSKH.
                </p>
                <p className="text-slate-500">
                  • Phiếu sửa chữa tự động gửi tin nhắn 4 bước tới khách hàng.
                </p>
              </div>

              {/* Nút thao tác nhanh */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${testing ? "animate-spin text-blue-600" : ""}`} />
                  {testing ? "Đang kiểm tra..." : "Kiểm tra"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOAuthLogin}
                    disabled={authorizing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${authorizing ? "animate-spin" : ""}`} />
                    Đổi tài khoản
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Ngắt
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP: CHƯA KẾT NỐI */
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 text-center space-y-4 shadow-2xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#0068FF] shadow-xs">
                <MessageSquare className="h-7 w-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Chưa kết nối Zalo OA cho {currentBranchName}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Đăng nhập một lần để kích hoạt tự động gửi tin nhắn 4 bước sửa chữa và chat 1-1 trực tiếp với khách hàng.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOAuthLogin}
                  disabled={authorizing}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0068FF] hover:bg-[#0054cc] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  <LogIn className="h-4 w-4" />
                  {authorizing ? "Đang mở cửa sổ Zalo..." : "Đăng nhập kết nối Zalo OA"}
                </button>
                <p className="text-[11px] text-slate-400 mt-2">
                  🔒 Cấp quyền an toàn qua cổng xác thực chính thức của Zalo
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Đóng */}
        <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
