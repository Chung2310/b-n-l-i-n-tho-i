import React, { useMemo, useState, useRef, useEffect } from "react";
import { toast } from "../../../pages/Toast";
import type { GoodsReceiptItem } from "../../../services/inventoryReceivingService";

type DraftLine = GoodsReceiptItem & { key: string; displayName: string };

interface SerialManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: DraftLine;
  onSave: (updatedLine: DraftLine) => void;
  otherLinesSerials?: string[];
}

export function SerialManagerModal({
  isOpen,
  onClose,
  line,
  onSave,
  otherLinesSerials = [],
}: SerialManagerModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<"scan" | "paste" | "list">("scan");

  // Local state for quantity, serials, and unitDetails
  const [currentQty, setCurrentQty] = useState<number>(Math.max(1, Math.round(line.quantity)));
  const [serials, setSerials] = useState<string[]>(() => {
    const list = line.serialNumbers || [];
    const count = Math.max(1, Math.round(line.quantity));
    return Array.from({ length: count }, (_, i) => list[i] || "");
  });
  const [unitDetails, setUnitDetails] = useState<Array<{ internalBarcode: string }>>(() => {
    const list = line.unitDetails || [];
    const count = Math.max(1, Math.round(line.quantity));
    return Array.from({ length: count }, (_, i) => ({
      internalBarcode: list[i]?.internalBarcode || "",
    }));
  });

  // Scanner state
  const [scanInput, setScanInput] = useState("");
  const [autoExpandQty, setAutoExpandQty] = useState(true);
  const [scanLastSuccess, setScanLastSuccess] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Paste state
  const [pasteRawText, setPasteRawText] = useState("");
  const [pasteAutoSyncQty, setPasteAutoSyncQty] = useState(true);

  // Focus scanner input on tab change to scan
  useEffect(() => {
    if (activeTab === "scan") {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
    }
  }, [activeTab]);

  // Valid count
  const filledSerials = useMemo(() => {
    return serials.map((s) => s.trim()).filter(Boolean);
  }, [serials]);

  const uniqueFilledCount = useMemo(() => {
    return new Set(filledSerials.map((s) => s.toUpperCase())).size;
  }, [filledSerials]);

  const hasInternalDuplicates = filledSerials.length !== uniqueFilledCount;

  // Check collision with other lines
  const collisionWithOtherLines = useMemo(() => {
    const otherSet = new Set(otherLinesSerials.map((s) => s.trim().toUpperCase()));
    return filledSerials.filter((s) => otherSet.has(s.toUpperCase()));
  }, [filledSerials, otherLinesSerials]);

  // Adjust serials array size when currentQty changes
  const setQuantityAndResize = (newQty: number) => {
    const clamped = Math.max(1, Math.min(500, Math.round(newQty)));
    setCurrentQty(clamped);
    setSerials((curr) => {
      return Array.from({ length: clamped }, (_, i) => curr[i] || "");
    });
    setUnitDetails((curr) => {
      return Array.from({ length: clamped }, (_, i) => ({
        internalBarcode: curr[i]?.internalBarcode || "",
      }));
    });
  };

  // Continuous Scanner submit
  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = scanInput.trim();
    if (!val) return;

    setScanError(null);
    setScanLastSuccess(null);

    // Check if duplicate in current list
    const upper = val.toUpperCase();
    if (serials.some((s) => s.trim().toUpperCase() === upper)) {
      setScanError(`IMEI "${val}" đã tồn tại trong danh sách của SKU này!`);
      setScanInput("");
      return;
    }

    if (otherLinesSerials.some((s) => s.trim().toUpperCase() === upper)) {
      setScanError(`IMEI "${val}" đã được nhập cho một SKU khác trong phiếu nhập!`);
      setScanInput("");
      return;
    }

    // Find first empty slot
    const firstEmptyIndex = serials.findIndex((s) => !s.trim());
    if (firstEmptyIndex !== -1) {
      const nextSerials = [...serials];
      nextSerials[firstEmptyIndex] = val;
      setSerials(nextSerials);
      setScanLastSuccess(`Đã thêm: ${val} (Vị trí #${firstEmptyIndex + 1})`);
    } else {
      // All slots full
      if (autoExpandQty) {
        setSerials([...serials, val]);
        setUnitDetails([...unitDetails, { internalBarcode: "" }]);
        setCurrentQty(currentQty + 1);
        setScanLastSuccess(`Đã tăng SL lên ${currentQty + 1} và thêm: ${val}`);
      } else {
        setScanError(`Đã đủ số lượng ${currentQty} máy. Hãy tích chọn tự động tăng số lượng để tiếp tục quét.`);
      }
    }

    setScanInput("");
  };

  // Parse batch paste text
  const parsedPasteList = useMemo(() => {
    if (!pasteRawText.trim()) return [];
    const tokens = pasteRawText
      .split(/[\n,;\t]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return tokens;
  }, [pasteRawText]);

  const uniqueParsedPasteList = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const t of parsedPasteList) {
      const upper = t.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        list.push(t);
      }
    }
    return list;
  }, [parsedPasteList]);

  const pasteDuplicateCount = parsedPasteList.length - uniqueParsedPasteList.length;

  const handleApplyPaste = () => {
    if (uniqueParsedPasteList.length === 0) {
      toast.error("Không tìm thấy IMEI hợp lệ nào trong văn bản đã dán.");
      return;
    }

    if (pasteAutoSyncQty) {
      const newQty = uniqueParsedPasteList.length;
      setCurrentQty(newQty);
      setSerials(uniqueParsedPasteList);
      setUnitDetails(
        Array.from({ length: newQty }, (_, i) => ({
          internalBarcode: unitDetails[i]?.internalBarcode || "",
        }))
      );
      toast.success(`Đã nạp ${newQty} IMEI và tự động đặt số lượng = ${newQty}.`);
    } else {
      const nextSerials = [...serials];
      let filled = 0;
      for (let i = 0; i < currentQty && filled < uniqueParsedPasteList.length; i++) {
        nextSerials[i] = uniqueParsedPasteList[filled];
        filled++;
      }
      setSerials(nextSerials);
      toast.success(`Đã điền ${filled} IMEI vào ${currentQty} đơn vị.`);
    }

    setPasteRawText("");
    setActiveTab("list");
  };

  // Generate internal barcodes for all units
  const handleGenerateInternalBarcodes = () => {
    const token = line.sku.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    setUnitDetails((curr) =>
      curr.map((item, index) => ({
        ...item,
        internalBarcode: `IG-${token}-${date}-${String(index + 1).padStart(6, "0")}`,
      }))
    );
    toast.success(`Đã sinh mã vạch nội bộ tự động cho ${currentQty} đơn vị.`);
  };

  // Clear all IMEIs
  const handleClearAllSerials = () => {
    setSerials(Array.from({ length: currentQty }, () => ""));
    toast.info("Đã xóa sạch danh sách IMEI.");
  };

  // Save changes
  const handleSave = () => {
    if (line.trackingMode === "serial") {
      if (filledSerials.length !== currentQty) {
        toast.error(`SKU theo IMEI phải nhập đủ ${currentQty} mã (hiện có ${filledSerials.length}).`);
        return;
      }
      if (hasInternalDuplicates) {
        toast.error("Phát hiện IMEI bị trùng lặp trong danh sách. Vui lòng kiểm tra lại.");
        return;
      }
      if (collisionWithOtherLines.length > 0) {
        toast.error(`IMEI "${collisionWithOtherLines[0]}" bị trùng với SKU khác trong phiếu nhập.`);
        return;
      }
    }

    const updated: DraftLine = {
      ...line,
      quantity: currentQty,
      serialNumbers: serials.map((s) => s.trim()),
      unitDetails: unitDetails.map((u, i) => ({
        ...u,
        serialNumber: serials[i]?.trim() || undefined,
        internalBarcode: u.internalBarcode?.trim() || "",
      })),
    };

    onSave(updated);
    toast.success(`Đã lưu danh sách IMEI cho ${line.sku}!`);
    onClose();
  };

  const progressPercent = Math.min(100, Math.round((filledSerials.length / currentQty) * 100));
  const isComplete = filledSerials.length === currentQty && !hasInternalDuplicates;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  Quản lý IMEI &amp; Sê-ri
                </h3>
                <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {line.sku}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {line.productName}
                {line.displayName && (
                  <>
                    {" · "}
                    <span className="font-medium text-slate-700">{line.displayName}</span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100 transition-colors text-sm font-semibold leading-none"
            >
              ✕
            </button>
          </div>

          {/* KPI & Progress */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">SL nhập:</span>
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={currentQty}
                    onChange={(e) => setQuantityAndResize(Number(e.target.value))}
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center font-bold text-slate-900 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-sm"
                  />
                  <span className="text-slate-500">máy</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Đã nhập:</span>
                <strong
                  className={`font-bold tabular-nums text-sm ${
                    isComplete ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {filledSerials.length} / {currentQty}
                </strong>
              </div>
            </div>

            {/* Status Badge */}
            <div>
              {isComplete ? (
                <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  Đã đủ {currentQty} IMEI
                </span>
              ) : filledSerials.length < currentQty ? (
                <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  Còn thiếu {currentQty - filledSerials.length} IMEI
                </span>
              ) : (
                <span className="inline-block rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 border border-cyan-200">
                  Vượt số lượng (+{filledSerials.length - currentQty})
                </span>
              )}
            </div>
          </div>

          {/* Progress bar line */}
          <div className="mt-2.5 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete ? "bg-emerald-600" : "bg-cyan-700"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("scan")}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "scan"
                ? "border-cyan-700 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Quét mã vạch liên tục
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "paste"
                ? "border-cyan-700 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Dán danh sách từ Excel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "list"
                ? "border-cyan-700 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Danh sách chi tiết</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600">
              {filledSerials.length}/{currentQty}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 max-h-[380px]">
          {/* TAB 1: SCANNER */}
          {activeTab === "scan" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
                <div className="max-w-lg mx-auto text-center space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Nhập hoặc quét mã vạch IMEI
                  </h4>
                  <p className="text-xs text-slate-500">
                    Đặt con trỏ vào ô bên dưới rồi cầm máy quét bắn liên tục vào mã vạch IMEI. Hệ thống tự động nhận diện và lưu vào danh sách.
                  </p>
                </div>

                <form onSubmit={handleScannerSubmit} className="mt-4 max-w-lg mx-auto flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={scannerInputRef}
                      type="text"
                      placeholder="Nhập hoặc quét mã IMEI tại đây..."
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="shrink-0 rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-sm"
                  >
                    Thêm
                  </button>
                </form>

                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoExpandQty}
                      onChange={(e) => setAutoExpandQty(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 cursor-pointer"
                    />
                    <span>Tự động tăng số lượng khi quét vượt số máy hiện tại</span>
                  </label>
                </div>
              </div>

              {/* Feedback messages */}
              {scanLastSuccess && (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                  {scanLastSuccess}
                </div>
              )}
              {scanError && (
                <div className="rounded-md bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-800">
                  {scanError}
                </div>
              )}

              {/* Recent Scanned Tags */}
              {filledSerials.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Đã quét gần đây ({filledSerials.length} IMEI):
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("list")}
                      className="text-cyan-700 hover:underline font-medium"
                    >
                      Xem toàn bộ danh sách
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    {filledSerials.slice(-15).reverse().map((serial, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-white px-2.5 py-1 text-xs font-mono font-medium text-slate-800 border border-slate-200 shadow-sm"
                      >
                        {serial}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BATCH PASTE */}
          {activeTab === "paste" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Dán danh sách IMEI từ Excel / Email / Nhà cung cấp:
                </label>
                <textarea
                  rows={6}
                  placeholder={`861234567890123\n861234567890124\n861234567890125\n...`}
                  value={pasteRawText}
                  onChange={(e) => setPasteRawText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs font-mono outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Hỗ trợ sao chép cả cột từ bảng tính Excel. Phân cách bằng dòng mới, dấu phẩy (,), chấm phẩy (;) hoặc tab.
                </p>
              </div>

              {/* Paste Stats Analysis */}
              {parsedPasteList.length > 0 && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 text-xs space-y-2">
                  <div className="flex items-center gap-4 font-semibold text-slate-800">
                    <span>Phát hiện: <strong className="text-cyan-800">{parsedPasteList.length}</strong> chuỗi</span>
                    <span>Hợp lệ duy nhất: <strong className="text-emerald-700">{uniqueParsedPasteList.length}</strong> IMEI</span>
                    {pasteDuplicateCount > 0 && (
                      <span className="text-rose-600 font-medium">
                        (Bỏ qua {pasteDuplicateCount} IMEI trùng lặp)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 pt-1.5 border-t border-cyan-200">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="radio"
                        name="pasteSync"
                        checked={pasteAutoSyncQty}
                        onChange={() => setPasteAutoSyncQty(true)}
                        className="text-cyan-700"
                      />
                      <span>Tự động cập nhật số lượng nhập = {uniqueParsedPasteList.length} máy</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="radio"
                        name="pasteSync"
                        checked={!pasteAutoSyncQty}
                        onChange={() => setPasteAutoSyncQty(false)}
                        className="text-cyan-700"
                      />
                      <span>Chỉ điền vào số lượng hiện tại ({currentQty} máy)</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={uniqueParsedPasteList.length === 0}
                  onClick={handleApplyPaste}
                  className="rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors disabled:opacity-50"
                >
                  Áp dụng {uniqueParsedPasteList.length} IMEI vào danh sách
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DETAILED LIST & INTERNAL BARCODES */}
          {activeTab === "list" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Danh sách chi tiết {currentQty} máy:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateInternalBarcodes}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Tự động tạo mã vạch nội bộ
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllSerials}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-sm"
                  >
                    Xóa sạch IMEI
                  </button>
                </div>
              </div>

              {/* Table of units */}
              <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm max-h-[260px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="p-2 w-12 text-center">#</th>
                      <th className="p-2 w-[45%]">Mã IMEI / Sê-ri *</th>
                      <th className="p-2 w-[45%]">Mã vạch nội bộ (Nếu có)</th>
                      <th className="p-2 w-12 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {Array.from({ length: currentQty }).map((_, index) => {
                      const val = serials[index] || "";
                      const isFilled = Boolean(val.trim());
                      const isDup =
                        isFilled &&
                        serials.filter((s) => s.trim().toUpperCase() === val.trim().toUpperCase())
                          .length > 1;

                      return (
                        <tr
                          key={index}
                          className={`hover:bg-slate-50 ${
                            isDup ? "bg-rose-50/50" : ""
                          }`}
                        >
                          <td className="p-2 text-center text-slate-400 font-sans font-medium">
                            {index + 1}
                          </td>
                          <td className="p-2">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={`IMEI đơn vị #${index + 1}`}
                                value={val}
                                onChange={(e) => {
                                  const next = [...serials];
                                  next[index] = e.target.value;
                                  setSerials(next);
                                }}
                                className={`w-full rounded border px-2 py-1 text-xs outline-none focus:border-cyan-600 ${
                                  isDup
                                    ? "border-rose-400 bg-rose-50 text-rose-900"
                                    : "border-slate-200 bg-white text-slate-800"
                                }`}
                              />
                              {isDup && (
                                <span className="absolute right-2 top-1 text-[10px] text-rose-600 font-sans font-medium">
                                  Trùng lặp!
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder={`Mã nội bộ #${index + 1}`}
                              value={unitDetails[index]?.internalBarcode || ""}
                              onChange={(e) => {
                                const next = [...unitDetails];
                                next[index] = {
                                  ...next[index],
                                  internalBarcode: e.target.value,
                                };
                                setUnitDetails(next);
                              }}
                              className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-cyan-600 focus:bg-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const nextSerials = [...serials];
                                nextSerials[index] = "";
                                setSerials(nextSerials);
                              }}
                              className="text-slate-400 hover:text-rose-600 text-xs font-sans font-medium"
                              title="Xóa IMEI này"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add unit button */}
              <button
                type="button"
                onClick={() => setQuantityAndResize(currentQty + 1)}
                className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 mt-1"
              >
                + Thêm một đơn vị
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-500">
            Tổng cộng: <strong className="text-slate-800">{currentQty} đơn vị</strong> ·{" "}
            Đã có IMEI: <strong className="text-cyan-700 font-bold">{filledSerials.length}</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors"
            >
              Lưu &amp; Áp dụng IMEI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
