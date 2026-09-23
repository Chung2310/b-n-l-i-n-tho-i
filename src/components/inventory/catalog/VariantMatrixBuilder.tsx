import React, { useMemo, useState, useEffect } from "react";
import { Box, Check, DollarSign, Plus, Trash2, X, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "../../../pages/Toast";
import {
  type Option,
  type GeneratedVariant,
  generateMatrixFromOptions,
} from "../../../hooks/useVariantMatrix";
import { DEFAULT_PHONE_ATTRIBUTE_PRESETS, inputClassName, trackingLabels } from "./catalogConstants";
import { ImageUploadBox, NumberInput } from "./catalogUi";
import type { ProductCatalogType, ProductTrackingMode } from "../../../services/productCatalogService";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";

interface VariantMatrixBuilderProps {
  options: Option[];
  setOptions: React.Dispatch<React.SetStateAction<Option[]>>;
  variantsMatrix: GeneratedVariant[];
  setVariantsMatrix: React.Dispatch<React.SetStateAction<GeneratedVariant[]>>;
  productType?: ProductCatalogType;
  trackingMode?: ProductTrackingMode;
  onTrackingModeChange?: (mode: ProductTrackingMode) => void;
  baseSku?: string;
}

export function VariantMatrixBuilder({
  options,
  setOptions,
  variantsMatrix,
  setVariantsMatrix,
  productType = "physical",
  trackingMode = "serial",
  onTrackingModeChange,
  baseSku = "",
}: VariantMatrixBuilderProps) {
  // Bulk Price & Cost Price input states
  const [bulkPriceAll, setBulkPriceAll] = useState<number>(0);
  const [bulkCostPriceAll, setBulkCostPriceAll] = useState<number>(0);
  const [bulkPriceValueFilter, setBulkPriceValueFilter] = useState<string>("");
  const [bulkPriceByVal, setBulkPriceByVal] = useState<number>(0);
  const [bulkCostPriceByVal, setBulkCostPriceByVal] = useState<number>(0);

  // Preset button click
  const addPresetOption = (presetKey: string) => {
    const preset = DEFAULT_PHONE_ATTRIBUTE_PRESETS[presetKey];
    if (!preset) return;
    if (options.some((o) => o.code === preset.code || o.name.toLowerCase() === preset.name.toLowerCase())) {
      toast.error(`Thuộc tính "${preset.name}" đã được thêm.`);
      return;
    }
    setOptions([...options, { code: preset.code, name: preset.name, values: [] }]);
  };

  const addCustomOption = () => {
    const idx = options.length + 1;
    setOptions([...options, { code: `OPT${idx}`, name: `Thuộc tính ${idx}`, values: [] }]);
  };

  const handleToggleOptionValue = (optIndex: number, val: string) => {
    const newOptions = [...options];
    const currentValues = newOptions[optIndex].values;
    if (currentValues.includes(val)) {
      newOptions[optIndex].values = currentValues.filter((v) => v !== val);
    } else {
      newOptions[optIndex].values = [...currentValues, val];
    }
    setOptions(newOptions);
  };

  const handleSelectAllPreset = (optIndex: number, presetOptions: string[]) => {
    const newOptions = [...options];
    newOptions[optIndex].values = [...new Set([...newOptions[optIndex].values, ...presetOptions])];
    setOptions(newOptions);
  };

  const handleClearAllPreset = (optIndex: number) => {
    const newOptions = [...options];
    newOptions[optIndex].values = [];
    setOptions(newOptions);
  };

  const handleOptionValueAdd = (index: number, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const newOptions = [...options];
    if (!newOptions[index].values.includes(trimmed)) {
      newOptions[index].values.push(trimmed);
      setOptions(newOptions);
    }
  };

  const handleOptionValueRemove = (optIndex: number, valIndex: number) => {
    const newOptions = [...options];
    newOptions[optIndex].values.splice(valIndex, 1);
    setOptions(newOptions);
  };

  const handleVariantMatrixChange = (index: number, field: keyof GeneratedVariant, value: any) => {
    const newVariants = [...variantsMatrix];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariantsMatrix(newVariants);
  };

  const removeMatrixRow = (index: number) => {
    setVariantsMatrix((current) => current.filter((_, i) => i !== index));
  };

  // Bulk Apply Price & Cost Price for ALL
  const applyBulkPriceToAll = () => {
    if (bulkPriceAll <= 0 && bulkCostPriceAll <= 0) {
      toast.error("Vui lòng nhập giá bán hoặc giá vốn hợp lệ.");
      return;
    }
    setVariantsMatrix((current) =>
      current.map((v) => {
        const updated = { ...v };
        if (bulkPriceAll > 0) updated.price = bulkPriceAll;
        if (bulkCostPriceAll > 0) updated.costPrice = bulkCostPriceAll;
        return updated;
      })
    );
    const parts: string[] = [];
    if (bulkPriceAll > 0) parts.push(`giá bán ${bulkPriceAll.toLocaleString("vi-VN")} ₫`);
    if (bulkCostPriceAll > 0) parts.push(`giá vốn ${bulkCostPriceAll.toLocaleString("vi-VN")} ₫`);
    toast.success(`Đã áp dụng ${parts.join(" & ")} cho tất cả ${variantsMatrix.length} SKU.`);
  };

  // Bulk Apply Price & Cost Price by Option Value
  const applyBulkPriceByValue = () => {
    if (!bulkPriceValueFilter) {
      toast.error("Vui lòng chọn giá trị thuộc tính (VD: 128GB, Titan...).");
      return;
    }
    if (bulkPriceByVal <= 0 && bulkCostPriceByVal <= 0) {
      toast.error("Vui lòng nhập giá bán hoặc giá vốn hợp lệ.");
      return;
    }
    let matchedCount = 0;
    setVariantsMatrix((current) =>
      current.map((v) => {
        const matches = v.optionValues.some((opt) => opt.value === bulkPriceValueFilter);
        if (matches) {
          matchedCount++;
          const updated = { ...v };
          if (bulkPriceByVal > 0) updated.price = bulkPriceByVal;
          if (bulkCostPriceByVal > 0) updated.costPrice = bulkCostPriceByVal;
          return updated;
        }
        return v;
      })
    );
    const parts: string[] = [];
    if (bulkPriceByVal > 0) parts.push(`giá bán ${bulkPriceByVal.toLocaleString("vi-VN")} ₫`);
    if (bulkCostPriceByVal > 0) parts.push(`giá vốn ${bulkCostPriceByVal.toLocaleString("vi-VN")} ₫`);
    toast.success(`Đã áp dụng ${parts.join(" & ")} cho ${matchedCount} SKU thuộc "${bulkPriceValueFilter}".`);
  };

  // All distinct option values across active options for the bulk price filter dropdown
  const allCurrentOptionValues = useMemo(() => {
    return Array.from(new Set(options.flatMap((o) => o.values)));
  }, [options]);

  // Filter active options with values
  const validOptions = useMemo(() => options.filter((o) => o.values && o.values.length > 0), [options]);
  const expectedCombinationsCount = useMemo(() => {
    if (validOptions.length === 0) return 0;
    return validOptions.reduce((acc, curr) => acc * curr.values.length, 1);
  }, [validOptions]);

  // Serialized options to detect real value changes
  const optionsSignature = useMemo(() => {
    return options.map((o) => `${o.code}:${[...o.values].sort().join(",")}`).join(";");
  }, [options]);

  // Automatically generate / synchronize variantsMatrix when options change
  useEffect(() => {
    if (validOptions.length === 0) {
      if (variantsMatrix.length > 0) {
        setVariantsMatrix([]);
      }
      return;
    }

    const newMatrix = generateMatrixFromOptions(options, baseSku, variantsMatrix);
    const currentKeys = variantsMatrix
      .map((v) => (v.optionValues || []).map((ov) => `${ov.code}:${ov.value}`).sort().join("|"))
      .join(";");
    const newKeys = newMatrix
      .map((v) => (v.optionValues || []).map((ov) => `${ov.code}:${ov.value}`).sort().join("|"))
      .join(";");

    if (currentKeys !== newKeys) {
      setVariantsMatrix(newMatrix);
    }
  }, [optionsSignature, baseSku]);

  // Explicit confirmation button action
  const handleConfirmGenerate = () => {
    const matrix = generateMatrixFromOptions(options, baseSku, variantsMatrix);
    setVariantsMatrix(matrix);
    toast.success(`Đã tạo thành công ma trận ${matrix.length} biến thể SKU!`);
  };

  const handleClearMatrix = () => {
    setVariantsMatrix([]);
    toast.info("Đã xóa toàn bộ ma trận biến thể.");
  };

  return (
    <div className="space-y-4">
      {/* Preset quick-add buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Thuộc tính biến thể (Màu sắc × Dung lượng × Tình trạng)
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Chọn nhanh hoặc gõ các thuộc tính để hệ thống tự động nhân ma trận SKU.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => addPresetOption("COLOR")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Màu sắc
          </button>
          <button
            type="button"
            onClick={() => addPresetOption("STORAGE")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Dung lượng
          </button>
          <button
            type="button"
            onClick={() => addPresetOption("CONDITION")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Tình trạng
          </button>
          <button
            type="button"
            onClick={() => addPresetOption("ORIGIN")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Xuất xứ
          </button>
          <button
            type="button"
            onClick={addCustomOption}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Thuộc tính khác
          </button>
        </div>
      </div>

      {/* Option cards */}
      {options.length > 0 && (
        <div className="space-y-4 pt-1">
          {options.map((opt, optIndex) => {
            const preset = DEFAULT_PHONE_ATTRIBUTE_PRESETS[opt.code];
            const suggestedOptions = preset?.options || [];

            return (
              <div key={opt.code + optIndex} className="relative rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-700 text-[11px] font-bold text-white">
                      {optIndex + 1}
                    </span>
                    <input
                      className="bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-b focus:border-cyan-500 pb-0.5"
                      value={opt.name}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[optIndex].name = e.target.value;
                        setOptions(newOpts);
                      }}
                      placeholder="Tên thuộc tính (VD: Màu sắc)"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestedOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectAllPreset(optIndex, suggestedOptions)}
                        className="text-[11px] text-cyan-700 hover:underline font-medium"
                      >
                        Chọn tất cả
                      </button>
                    )}
                    {opt.values.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleClearAllPreset(optIndex)}
                        className="text-[11px] text-slate-400 hover:text-rose-600 font-medium ml-1"
                      >
                        Xóa chọn
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== optIndex))}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-600 transition-colors"
                      title="Xóa thuộc tính này"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Preset quick-toggle chips */}
                {suggestedOptions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-medium text-slate-500 mb-1.5">Gợi ý chọn nhanh:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedOptions.map((suggestedVal) => {
                        const isSelected = opt.values.includes(suggestedVal);
                        return (
                          <button
                            key={suggestedVal}
                            type="button"
                            onClick={() => handleToggleOptionValue(optIndex, suggestedVal)}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-cyan-700 text-white shadow-sm ring-1 ring-cyan-700"
                                : "bg-white text-slate-700 border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                            {suggestedVal}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected values tags */}
                {opt.values.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 bg-white p-2 rounded border border-slate-200/80">
                    <span className="text-[11px] font-medium text-slate-400 mr-1">Đã chọn ({opt.values.length}):</span>
                    {opt.values.map((val, valIndex) => (
                      <span key={valIndex} className="flex items-center gap-1 rounded bg-cyan-100 pl-2 pr-1 py-0.5 text-xs font-medium text-cyan-800">
                        {val}
                        <button
                          type="button"
                          onClick={() => handleOptionValueRemove(optIndex, valIndex)}
                          className="rounded-sm p-0.5 text-cyan-600 hover:bg-cyan-200 hover:text-cyan-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input custom value */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`Gõ thêm giá trị ${opt.name} khác và nhấn Enter...`}
                    className={inputClassName("text-xs shadow-sm bg-white")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleOptionValueAdd(optIndex, e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-mono">↵ Enter</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Matrix Table */}
      {options.length > 0 && (
        <div className="pt-4 mt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span>Ma trận Biến thể ({variantsMatrix.length} SKU)</span>
                {validOptions.length > 0 && (
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800">
                    {validOptions.map((o) => `${o.values.length} ${o.name}`).join(" × ")}
                  </span>
                )}
                {expectedCombinationsCount > 0 && variantsMatrix.length !== expectedCombinationsCount && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 animate-pulse">
                    {expectedCombinationsCount} tổ hợp chờ tạo
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Ma trận tự động cập nhật khi bạn chọn giá trị. Nhập giá bán cho từng dòng.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {onTrackingModeChange && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Quản lý kho:</span>
                  <Dropdown<ProductTrackingMode>
                    disabled={productType === "service"}
                    value={productType === "service" ? "none" : trackingMode}
                    onChange={onTrackingModeChange}
                    options={[
                      { value: "serial", label: "Theo số sê-ri / IMEI" },
                      { value: "quantity", label: "Theo số lượng" },
                      { value: "unit_barcode", label: "Theo mã vạch đơn vị" },
                      { value: "none", label: "Không theo dõi" },
                    ]}
                    variant="default"
                    size="xs"
                    triggerClassName="font-medium text-xs"
                  />
                </div>
              )}
              {validOptions.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmGenerate}
                  title="Tạo lại toàn bộ ma trận từ các thuộc tính đã chọn"
                  className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {variantsMatrix.length === 0 ? "Tạo ma trận" : "Làm mới"}
                </button>
              )}
              {variantsMatrix.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearMatrix}
                  title="Xóa toàn bộ ma trận"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Bulk Price & Cost Price Action Toolbar */}
          {variantsMatrix.length > 0 && (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-900">
                  <DollarSign className="h-4 w-4 text-cyan-700" />
                  Công cụ áp giá bán &amp; giá vốn hàng loạt cho Ma trận:
                </div>
                <span className="text-[11px] text-cyan-700">Nhập giá bán, giá vốn (hoặc cả hai) rồi bấm Áp dụng</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Option 1: Apply to ALL */}
                <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-md border border-cyan-100 shadow-sm">
                  <span className="text-xs text-slate-700 shrink-0 font-semibold">Tất cả SKU:</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                    <div className="relative flex-1">
                      <NumberInput
                        value={bulkPriceAll}
                        onChange={(val) => setBulkPriceAll(val)}
                        className={inputClassName("py-1.5 text-xs text-right font-bold text-cyan-800 bg-cyan-50/20")}
                        placeholder="Giá bán..."
                      />
                    </div>
                    <div className="relative flex-1">
                      <NumberInput
                        value={bulkCostPriceAll}
                        onChange={(val) => setBulkCostPriceAll(val)}
                        className={inputClassName("py-1.5 text-xs text-right font-semibold text-slate-600 bg-slate-50/40")}
                        placeholder="Giá vốn..."
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={applyBulkPriceToAll}
                    className="shrink-0 rounded bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-sm"
                  >
                    Áp dụng
                  </button>
                </div>

                {/* Option 2: Apply by attribute value */}
                {allCurrentOptionValues.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-md border border-cyan-100 shadow-sm">
                    <Dropdown<string>
                      value={bulkPriceValueFilter}
                      onChange={setBulkPriceValueFilter}
                      options={[
                        { value: "", label: "-- Chọn bản --" },
                        ...allCurrentOptionValues.map((v) => ({
                          value: v,
                          label: `Bản: ${v}`,
                        })),
                      ]}
                      placeholder="-- Chọn bản --"
                      variant="default"
                      size="xs"
                      className="w-32 shrink-0"
                      triggerClassName="w-full text-xs font-medium"
                    />
                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                      <div className="relative flex-1">
                        <NumberInput
                          value={bulkPriceByVal}
                          onChange={(val) => setBulkPriceByVal(val)}
                          className={inputClassName("py-1.5 text-xs text-right font-bold text-cyan-800 bg-cyan-50/20")}
                          placeholder="Giá bán..."
                        />
                      </div>
                      <div className="relative flex-1">
                        <NumberInput
                          value={bulkCostPriceByVal}
                          onChange={(val) => setBulkCostPriceByVal(val)}
                          className={inputClassName("py-1.5 text-xs text-right font-semibold text-slate-600 bg-slate-50/40")}
                          placeholder="Giá vốn..."
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applyBulkPriceByValue}
                      className="shrink-0 rounded bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-sm"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Matrix table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-sm relative">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-2.5 font-semibold w-[50px] text-center">Ảnh</th>
                    <th className="p-2.5 font-semibold w-[20%]">Biến thể</th>
                    <th className="p-2.5 font-semibold w-[18%]">Mã SKU</th>
                    <th className="p-2.5 font-semibold w-[16%]">Mã vạch</th>
                    <th className="p-2.5 font-semibold w-[16%] text-right text-cyan-800">Giá bán (₫) *</th>
                    <th className="p-2.5 font-semibold w-[14%] text-right text-slate-600">Giá vốn (₫)</th>
                    <th className="p-2.5 font-semibold text-center w-[40px]">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {variantsMatrix.length > 0 ? (
                    variantsMatrix.map((variantItem, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 text-center">
                          <ImageUploadBox
                            value={variantItem.mediaIds?.[0]}
                            onChange={(url) => handleVariantMatrixChange(index, "mediaIds", [url])}
                            className="h-10 w-10 !rounded-md mx-auto"
                          />
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {variantItem.optionValues.map((v, i) => (
                              <span key={i} className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                                {v.value}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <input
                            className={inputClassName("py-1.5 text-xs font-mono font-medium")}
                            placeholder="Mã SKU"
                            value={variantItem.sku}
                            onChange={(e) => handleVariantMatrixChange(index, "sku", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            className={inputClassName("py-1.5 text-xs font-mono text-slate-600")}
                            placeholder="Mã vạch..."
                            value={variantItem.barcode || ""}
                            onChange={(e) => handleVariantMatrixChange(index, "barcode", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            className={inputClassName("py-1.5 text-xs text-right font-bold text-cyan-700 bg-cyan-50/30 focus:bg-white")}
                            placeholder="0 ₫"
                            value={variantItem.price || ""}
                            onChange={(num) => handleVariantMatrixChange(index, "price", num)}
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            className={inputClassName("py-1.5 text-xs text-right text-slate-600")}
                            placeholder="0 ₫"
                            value={variantItem.costPrice || ""}
                            onChange={(num) => handleVariantMatrixChange(index, "costPrice", num)}
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeMatrixRow(index)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Loại bỏ SKU này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        {validOptions.length === 0 ? (
                          <>
                            <Box className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                            <h4 className="text-sm font-semibold text-slate-700">Chưa chọn giá trị thuộc tính</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                              Tick chọn hoặc gõ ít nhất một giá trị cho thuộc tính ở trên — ma trận sẽ tự động hiển thị.
                            </p>
                          </>
                        ) : (
                          <>
                            <Sparkles className="mx-auto h-8 w-8 text-cyan-300 mb-2" />
                            <h4 className="text-sm font-semibold text-slate-700">
                              Sẵn sàng tạo {expectedCombinationsCount} biến thể
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 mb-3 max-w-sm mx-auto">
                              {validOptions.map((o) => `${o.values.length} ${o.name}`).join(" × ")} tổ hợp được phát hiện.
                              Ma trận sẽ tự động cập nhật.
                            </p>
                            <button
                              type="button"
                              onClick={handleConfirmGenerate}
                              className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors"
                            >
                              <Sparkles className="h-4 w-4" />
                              Tạo ma trận ngay
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
