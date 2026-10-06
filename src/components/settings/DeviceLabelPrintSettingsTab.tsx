import { useState } from "react";
import { Check, ChevronDown, Printer, Save, Settings2 } from "lucide-react";
import { Dropdown } from "../common/Dropdown";
import { toast } from "../../pages/Toast";
import { printDeviceBarcodeLabels } from "../inventory/receiving/printDeviceBarcodeLabels";
import {
  DEFAULT_DEVICE_LABEL_PRINT_SETTINGS,
  loadDeviceLabelPrintSettings,
  saveDeviceLabelPrintSettings,
  type DeviceLabelPrintSettings,
  type LabelColumnCount,
  type LabelMediaType,
} from "./deviceLabelPrintSettings";

const LABEL_PRESETS = [
  { label: "50 × 30 mm", widthMm: 50, heightMm: 30 },
  { label: "100 × 30 mm", widthMm: 100, heightMm: 30 },
  { label: "40 × 30 mm", widthMm: 40, heightMm: 30 },
  { label: "50 × 25 mm", widthMm: 50, heightMm: 25 },
  { label: "100 × 50 mm", widthMm: 100, heightMm: 50 },
];

const MEDIA_OPTIONS: { value: LabelMediaType; label: string }[] = [
  { value: "gap", label: "Tem có khe hở (Gap)" },
  { value: "black-mark", label: "Tem có dấu đen" },
  { value: "continuous", label: "Giấy liên tục" },
  { value: "punched-hole", label: "Tem có lỗ đục" },
];

const TEST_LABEL = {
  internalBarcode: "TEST-DVU000001",
  sku: "TEST-DEVICE",
  productName: "TEM TEST",
  imei1: "IMEI-TEST-0001",
};

export default function DeviceLabelPrintSettingsTab() {
  const [settings, setSettings] = useState<DeviceLabelPrintSettings>(loadDeviceLabelPrintSettings);
  const [isSaved, setIsSaved] = useState(true);
  const [isCustomSizeOpen, setIsCustomSizeOpen] = useState(() =>
    !LABEL_PRESETS.some((preset) => preset.widthMm === settings.widthMm && preset.heightMm === settings.heightMm),
  );

  const updateSettings = (updates: Partial<DeviceLabelPrintSettings>) => {
    setSettings((current) => ({ ...current, ...updates }));
    setIsSaved(false);
  };

  const handleSave = () => {
    if (settings.widthMm < 25.4 || settings.widthMm > 108 || settings.heightMm < 10 || settings.heightMm > 200) {
      toast.error("Khổ tem cần nằm trong giới hạn: ngang 25,4–108 mm và cao 10–200 mm.");
      return;
    }

    try {
      setSettings(saveDeviceLabelPrintSettings(settings));
      setIsSaved(true);
      toast.success("Đã lưu cấu hình in tem trên máy này.");
    } catch {
      toast.error("Không thể lưu cấu hình in tem trên trình duyệt này.");
    }
  };

  const handlePrintTest = () => {
    if (settings.widthMm < 25.4 || settings.widthMm > 108 || settings.heightMm < 10 || settings.heightMm > 200) {
      toast.error("Khổ tem cần nằm trong giới hạn: ngang 25,4–108 mm và cao 10–200 mm.");
      return;
    }

    try {
      const testLabels = Array.from({ length: settings.columns }, () => TEST_LABEL);
      printDeviceBarcodeLabels(testLabels, settings);
      toast.success(`Đã mở in thử ${testLabels.length} tem. Hãy chọn GoDEX trong hộp thoại in.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể mở lệnh in thử.");
    }
  };

  const selectedPreset = LABEL_PRESETS.some((preset) => preset.widthMm === settings.widthMm && preset.heightMm === settings.heightMm);

  return (
    <section className="space-y-6 rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md sm:p-6">
      <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
        <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700">
          <Printer className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-800">Thiết lập tem mã vạch</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Cấu hình loại tem đang lắp trên máy in. Thiết lập được lưu riêng trên máy tính và trình duyệt này.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Khổ giấy trên mỗi hàng in</h3>
          <p className="mt-1 text-xs text-gray-500">Cuộn hiện tại có hai tem khoảng 50 × 30 mm đặt cạnh nhau: chọn khổ cả hàng 100 × 30 mm và 2 tem mỗi hàng.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {LABEL_PRESETS.map((preset) => {
            const isSelected = settings.widthMm === preset.widthMm && settings.heightMm === preset.heightMm;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  updateSettings({ widthMm: preset.widthMm, heightMm: preset.heightMm });
                  setIsCustomSizeOpen(false);
                }}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${isSelected ? "border-cyan-600 bg-cyan-50 text-cyan-800" : "border-gray-200 text-gray-600 hover:border-cyan-300 hover:bg-cyan-50/50"}`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            aria-expanded={isCustomSizeOpen}
            onClick={() => setIsCustomSizeOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-cyan-300 hover:bg-cyan-50/50"
          >
            <Settings2 className="h-4 w-4" />
            {isCustomSizeOpen
              ? "Ẩn tùy chỉnh"
              : selectedPreset ? "Tùy chỉnh khổ giấy" : `Khổ tùy chỉnh · ${settings.widthMm} × ${settings.heightMm} mm`}
            <ChevronDown className={`h-4 w-4 transition-transform ${isCustomSizeOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
          <span className="block text-xs font-semibold text-gray-700">Số tem nằm ngang trên giấy</span>
          <div className="grid max-w-md grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((columns) => {
              const isSelected = settings.columns === columns;
              return (
                <button
                  key={columns}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateSettings({ columns: columns as LabelColumnCount })}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${isSelected ? "border-cyan-600 bg-cyan-50 text-cyan-800" : "border-gray-200 text-gray-600 hover:border-cyan-300 hover:bg-cyan-50/50"}`}
                >
                  {columns} tem
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500">
            Kích thước mỗi tem: khoảng {(settings.widthMm / settings.columns).toFixed(1)} × {settings.heightMm} mm.
          </p>
        </div>

        {isCustomSizeOpen && (
        <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-gray-700">
            <span>Chiều ngang toàn cuộn giấy (mm)</span>
            <input
              aria-label="Chiều ngang toàn cuộn giấy (mm)"
              type="number"
              min="25.4"
              max="108"
              step="0.1"
              value={settings.widthMm}
              onChange={(event) => updateSettings({ widthMm: Number(event.target.value) })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-gray-700">
            <span>Chiều dài mỗi hàng tem (mm)</span>
            <input
              aria-label="Chiều dài mỗi hàng tem (mm)"
              type="number"
              min="10"
              max="200"
              step="0.1"
              value={settings.heightMm}
              onChange={(event) => updateSettings({ heightMm: Number(event.target.value) })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          {!selectedPreset && (
            <p className="text-[11px] text-cyan-800 sm:col-span-2">
              Khổ tùy chỉnh: {settings.widthMm} × {settings.heightMm} mm
            </p>
          )}
        </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="device-label-media-type" className="block text-sm font-bold text-gray-800">Loại giấy / cảm biến</label>
        <Dropdown<LabelMediaType>
          value={settings.mediaType}
          onChange={(mediaType) => updateSettings({ mediaType })}
          options={MEDIA_OPTIONS}
          aria-label="Loại giấy / cảm biến"
          variant="form"
          className="w-full sm:max-w-md"
          searchable={false}
        />
        <p className="max-w-3xl text-xs leading-5 text-amber-800">
          Khổ giấy sẽ được áp dụng khi mở lệnh in. Hãy đặt cùng loại giấy và kích thước trong Printing Preferences của driver GoDEX trên Windows; trình duyệt không tự đổi được cảm biến Gap/dấu đen của máy in.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-900 sm:flex-row sm:items-start">
        <Settings2 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Mặc định là {DEFAULT_DEVICE_LABEL_PRINT_SETTINGS.widthMm} × {DEFAULT_DEVICE_LABEL_PRINT_SETTINGS.heightMm} mm cho cả hàng, gồm hai tem cạnh nhau. Hộp thoại in phải chọn GoDEX làm máy đích (không chọn Save as PDF), 1 bản sao, 1 trang trên mỗi tờ và tỷ lệ 100% / Actual size; hãy tắt đầu/chân trang nếu thấy “about:blank”. Driver GoDEX cũng cần khổ cả hàng {settings.widthMm} × {settings.heightMm} mm và đúng loại cảm biến đã chọn.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="block text-xs text-gray-500">{isSaved ? "Cấu hình đã lưu trên máy này" : "Bạn có thay đổi chưa lưu"}</span>
          <span className="mt-1 block text-[11px] text-gray-400">Bản in thử gồm {settings.columns} tem giống nhau trên một hàng.</span>
        </div>
        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handlePrintTest}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2.5 text-sm font-bold text-cyan-800 transition hover:bg-cyan-50"
          >
            <Printer className="h-4 w-4" />
            In thử {settings.columns} tem
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaved}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-default disabled:bg-emerald-700"
          >
            {isSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isSaved ? "Đã lưu" : "Lưu cấu hình"}
          </button>
        </div>
      </div>
    </section>
  );
}
