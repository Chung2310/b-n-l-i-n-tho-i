import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarHeart,
  Clock,
  Gift,
  HeartHandshake,
  Loader2,
  Pencil,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  marketingApi,
  type MarketingAutomationConfig,
  type MarketingAutomationType,
  type MarketingChannelStatus,
  type MarketingSettings,
} from "../api/marketing.api";
import HolidayCampaignsSection from "../components/HolidayCampaignsSection";
import MarketingAutomationModal from "../components/MarketingAutomationModal";
import ScanResultModal from "../components/ScanResultModal";
import SendTestModal from "../components/SendTestModal";
import SendTimeModal from "../components/SendTimeModal";
import { toast } from "../../../pages/Toast";

const AUTOMATIONS: Array<{
  type: MarketingAutomationType;
  title: string;
  description: string;
  icon: typeof Gift;
  manualScan?: "birthday" | "holiday" | "remarketing";
}> = [
  {
    type: "thank_you",
    title: "Cảm ơn sau khi xuất hoá đơn",
    description: "Gửi ngay khi đơn bán hàng được xác nhận và xuất hoá đơn.",
    icon: HeartHandshake,
  },
  {
    type: "birthday",
    title: "Chúc mừng sinh nhật",
    description: "Quét mỗi ngày, gửi cho khách có ngày sinh trùng hôm nay.",
    icon: Gift,
    manualScan: "birthday",
  },
  {
    type: "holiday",
    title: "Lễ tết theo nhóm khách hàng",
    description: "Chạy theo các chiến dịch đã lên lịch bên dưới.",
    icon: CalendarHeart,
    manualScan: "holiday",
  },
  {
    type: "remarketing",
    title: "Remarketing khách cũ",
    description: "Hỏi thăm khách đã lâu không quay lại mua hàng.",
    icon: Sparkles,
    manualScan: "remarketing",
  },
];

const CHANNEL_HINT =
  "Kênh chưa được nối API sẽ tự bỏ qua, hệ thống dùng kênh khả dụng đầu tiên trong danh sách.";

export default function MarketingAutomationSettingsPage({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<MarketingSettings>();
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [channels, setChannels] = useState<MarketingChannelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<(typeof AUTOMATIONS)[number] | null>(
    null
  );
  const [openSendTimeModal, setOpenSendTimeModal] = useState(false);
  const [testTarget, setTestTarget] = useState<{ type: MarketingAutomationType; title: string } | null>(null);
  const [scanResult, setScanResult] = useState<{ typeLabel: string; stats: any } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketingApi.getSettings();
      setSettings(data.settings);
      setSavedSnapshot(JSON.stringify(data.settings));
      setChannels(data.channels);
    } catch (error: any) {
      toast.error(error?.message || "Không tải được cài đặt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (type: MarketingAutomationType, values: Partial<MarketingAutomationConfig>) => {
    setSettings((current) =>
      current ? { ...current, [type]: { ...current[type], ...values } } : current
    );
  };

  const updateSettings = (patchValues: Partial<MarketingSettings>) => {
    setSettings((current) => (current ? { ...current, ...patchValues } : current));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await marketingApi.updateSettings(settings);
      setSettings(saved);
      setSavedSnapshot(JSON.stringify(saved));
      toast.success("Đã lưu cài đặt tự động thành công.");
    } catch (error: any) {
      toast.error(error?.message || "Lưu cài đặt thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const runScan = async (type: "birthday" | "holiday" | "remarketing") => {
    const item = AUTOMATIONS.find((a) => a.manualScan === type);
    const label = item ? item.title : "Chiến dịch";
    try {
      const stats = await marketingApi.runScan(type);
      setScanResult({ typeLabel: label, stats });
      toast.success(`Đã quét xong: ${stats.eligible} khách phù hợp, ${stats.queued} tin vào hàng đợi.`);
    } catch (error: any) {
      toast.error(error?.message || "Chạy quét thất bại.");
    }
  };

  const handleOpenSendTest = (type: MarketingAutomationType) => {
    const item = AUTOMATIONS.find((a) => a.type === type);
    setTestTarget({ type, title: item ? item.title : "Kịch bản tin nhắn" });
  };

  const handleExecuteSendTest = async (recipient: string) => {
    if (!testTarget) return;
    try {
      const result = await marketingApi.sendTest(testTarget.type, recipient.trim());
      if (result.status === "sent") {
        toast.success(`Đã gửi thử nghiệm thành công tới ${recipient}.`);
      } else {
        toast.error(`Không gửi được: ${result.reason || result.status}.`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Gửi thử nghiệm thất bại.");
    }
  };

  const dirty = Boolean(settings) && JSON.stringify(settings) !== savedSnapshot;
  const handleToggle = async (type: MarketingAutomationType, enabled: boolean) => {
    if (!settings) return;
    const nextSettings = {
      ...settings,
      [type]: { ...settings[type], enabled },
    };
    setSettings(nextSettings);
    try {
      const saved = await marketingApi.updateSettings(nextSettings);
      setSettings(saved);
      setSavedSnapshot(JSON.stringify(saved));
      toast.success(enabled ? "Đã bật kịch bản tự động." : "Đã tắt kịch bản tự động.");
    } catch (error: any) {
      toast.error(error?.message || "Cập nhật trạng thái thất bại.");
    }
  };

  const handleSaveSendTime = async (newTime: string) => {
    if (!settings) return;
    const nextSettings = { ...settings, sendTime: newTime };
    setSettings(nextSettings);
    try {
      const saved = await marketingApi.updateSettings(nextSettings);
      setSettings(saved);
      setSavedSnapshot(JSON.stringify(saved));
      toast.success(`Đã cập nhật giờ quét thành ${newTime}.`);
    } catch (error: any) {
      toast.error(error?.message || "Lưu giờ quét thất bại.");
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" /> Đang tải cài đặt marketing…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <header className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tin nhắn tự động</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Hệ thống tự động gửi tin nhắn chăm sóc khách hàng theo các kịch bản bên dưới.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Clock className="h-4 w-4 text-cyan-600" />
            <span>Giờ quét gửi:</span>
            <button
              type="button"
              onClick={() => setOpenSendTimeModal(true)}
              disabled={!canManage}
              title="Nhấn để đổi giờ quét"
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/90 bg-cyan-50 px-2.5 py-1 font-mono text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition cursor-pointer shadow-2xs"
            >
              <span>{settings.sendTime || "09:00"}</span>
              {canManage && <Pencil className="h-3 w-3 text-cyan-600" />}
            </button>
          </div>
        </div>
      </header>



      {/* Grid of Automation Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Các kịch bản tự động chăm sóc khách hàng</h3>

        <div className="grid gap-4 md:grid-cols-2">
          {AUTOMATIONS.map((automation) => {
            const config = settings[automation.type];
            const Icon = automation.icon;
            const activeChannels = channels.filter((c) => config.channels.includes(c.channel));

            return (
              <div
                key={automation.type}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-slate-300 transition"
              >
                <div>
                  {/* Top row: Icon, title, desc, on/off */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 shadow-2xs">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">{automation.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{automation.description}</p>
                      </div>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        disabled={!canManage}
                        onChange={(event) => handleToggle(automation.type, event.target.checked)}
                        className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
                      />
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          config.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {config.enabled ? "Bật" : "Tắt"}
                      </span>
                    </label>
                  </div>

                  {/* Middle details: channels and preview */}
                  <div className="mt-4 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">Kênh gửi:</span>
                      {activeChannels.length > 0 ? (
                        activeChannels.map((c) => (
                          <span
                            key={c.channel}
                            className="rounded-lg bg-cyan-50 border border-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700"
                          >
                            {c.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-amber-600 font-medium">Chưa kích hoạt kênh nào</span>
                      )}
                    </div>

                    {automation.type === "thank_you" && (
                      <div className="text-[11px] text-slate-500">
                        Đính kèm hoá đơn PDF:{" "}
                        <span className="font-semibold text-slate-700">
                          {settings.attachInvoicePdf ? "Đang bật" : "Đang tắt"}
                        </span>
                      </div>
                    )}

                    {automation.type === "remarketing" && (
                      <div className="text-[11px] text-slate-500">
                        Chu kỳ quét:{" "}
                        <span className="font-semibold text-slate-700">
                          Sau {settings.remarketingInactiveDays} ngày không mua · Chờ {settings.remarketingCooldownDays} ngày
                        </span>
                      </div>
                    )}

                    <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100/80 text-xs">
                      <span className="block text-[11px] font-bold text-slate-500 mb-0.5">Tiêu đề mẫu tin:</span>
                      <p className="truncate text-slate-700 font-medium italic">
                        {config.subject || <span className="text-slate-400 not-italic">(Chưa đặt tiêu đề)</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAutomation(automation)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-50 border border-cyan-200/80 px-3.5 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer shadow-2xs"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-600" />
                    Cấu hình & Soạn nội dung
                  </button>

                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenSendTest(automation.type)}
                        title="Gửi tin thử nghiệm đến hòm thư hoặc số của bạn"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                      >
                        <Send className="h-3 w-3 text-slate-500" />
                        Gửi thử
                      </button>
                      {automation.manualScan && (
                        <button
                          type="button"
                          onClick={() => runScan(automation.manualScan!)}
                          title="Quét và kích hoạt gửi ngay bây giờ"
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
                        >
                          Quét ngay
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Holiday Campaigns Section */}
      <HolidayCampaignsSection canManage={canManage} />

      {/* Dedicated Modal for Editing Specific Automation */}
      {selectedAutomation && (
        <MarketingAutomationModal
          automation={selectedAutomation}
          config={settings[selectedAutomation.type]}
          settings={settings}
          canManage={canManage}
          channels={channels}
          dirty={dirty}
          saving={saving}
          onPatch={patch}
          onUpdateSettings={updateSettings}
          onSendTest={handleOpenSendTest}
          onRunScan={runScan}
          onClose={() => setSelectedAutomation(null)}
          onSave={save}
        />
      )}

      {/* Send Time Modal */}
      {openSendTimeModal && (
        <SendTimeModal
          initialTime={settings.sendTime}
          timeZone={settings.timeZone}
          canManage={canManage}
          onSave={handleSaveSendTime}
          onClose={() => setOpenSendTimeModal(false)}
        />
      )}

      {/* Send Test Modal */}
      {testTarget && (
        <SendTestModal
          automationType={testTarget.type}
          title={testTarget.title}
          onSend={handleExecuteSendTest}
          onClose={() => setTestTarget(null)}
        />
      )}

      {/* Scan Result Modal */}
      {scanResult && (
        <ScanResultModal
          typeLabel={scanResult.typeLabel}
          stats={scanResult.stats}
          onClose={() => setScanResult(null)}
        />
      )}
    </div>
  );
}
