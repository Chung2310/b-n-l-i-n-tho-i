import { useCallback, useEffect, useState } from "react";
import { Calendar, CalendarPlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { marketingApi, type MarketingCampaign } from "../api/marketing.api";
import HolidayCampaignModal from "./HolidayCampaignModal";

import { toast } from "../../../pages/Toast";

export default function HolidayCampaignsSection({ canManage }: { canManage: boolean }) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCampaigns(await marketingApi.listCampaigns());
    } catch (err: any) {
      toast.error(err?.message || "Không tải được danh sách chiến dịch.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (campaign: MarketingCampaign) => {
    try {
      await marketingApi.updateCampaign(campaign._id, { enabled: !campaign.enabled });
      await load();
      toast.success(campaign.enabled ? "Đã tắt chiến dịch." : "Đã bật chiến dịch.");
    } catch (err: any) {
      toast.error(err?.message || "Cập nhật trạng thái chiến dịch thất bại.");
    }
  };

  const remove = async (campaign: MarketingCampaign) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá chiến dịch "${campaign.name}"?`)) return;
    try {
      await marketingApi.deleteCampaign(campaign._id);
      await load();
      toast.success(`Đã xoá chiến dịch "${campaign.name}".`);
    } catch (err: any) {
      toast.error(err?.message || "Xoá chiến dịch thất bại.");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-base">Chiến dịch lễ tết theo lịch</h3>
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">
              {campaigns.length} chiến dịch
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Hệ thống tự động quét và gửi thông điệp vào đúng ngày đã định cho từng nhóm khách hàng.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-50 border border-cyan-200/80 px-3.5 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer shadow-2xs shrink-0"
          >
            <CalendarPlus className="h-4 w-4 text-cyan-600" />
            Thêm chiến dịch lễ tết
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-600" /> Đang tải danh sách chiến dịch…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-2">
            <Calendar className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-600">Chưa có chiến dịch lễ tết nào</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Tạo chiến dịch để gửi lời chúc tự động vào các dịp Tết, 8/3, 20/10...</p>
          {canManage && (
            <button
              type="button"
              onClick={() => setOpenModal(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 transition cursor-pointer"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Tạo chiến dịch ngay
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <div
              key={campaign._id}
              className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/40 p-3.5 hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{campaign.name}</h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                      campaign.enabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {campaign.enabled ? "Đang bật" : "Đang tắt"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    <Calendar className="h-3 w-3 text-cyan-600" />
                    {campaign.runDate}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {campaign.targetTierCodes?.length
                      ? `Hạng: ${campaign.targetTierCodes.join(", ")}`
                      : "Tất cả khách hàng"}
                  </span>
                </div>
                {campaign.subject && (
                  <p className="mt-2 text-xs text-slate-600 line-clamp-1 italic">
                    Tiêu đề: &ldquo;{campaign.subject}&rdquo;
                  </p>
                )}
              </div>

              {canManage && (
                <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                  <button
                    type="button"
                    onClick={() => toggle(campaign)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition ${
                      campaign.enabled
                        ? "bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200/70"
                        : "bg-slate-200/80 text-slate-700 hover:bg-slate-300/80"
                    }`}
                  >
                    {campaign.enabled ? "Tắt chiến dịch" : "Bật chiến dịch"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(campaign)}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                    aria-label={`Xoá ${campaign.name}`}
                    title="Xoá chiến dịch"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {openModal && (
        <HolidayCampaignModal
          onClose={() => setOpenModal(false)}
          onCreated={() => {
            void load();
          }}
        />
      )}
    </section>
  );
}
