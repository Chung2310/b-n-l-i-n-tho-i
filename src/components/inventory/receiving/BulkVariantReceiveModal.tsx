import React, { useMemo, useState } from "react";
import { toast } from "../../../pages/Toast";
import type { CatalogProduct, CatalogProductDetail, ProductVariant } from "../../../services/productCatalogService";
import { trackingLabels } from "../catalog/catalogConstants";
import { NumberInput } from "../catalog/catalogUi";

export interface SelectedReceiveVariant {
  variant: ProductVariant;
  quantity: number;
  unitCost: number;
}

interface BulkVariantReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: CatalogProduct;
  productDetail?: CatalogProductDetail;
  existingVariantIds: string[];
  onConfirm: (selected: SelectedReceiveVariant[]) => void;
}

export function BulkVariantReceiveModal({
  isOpen,
  onClose,
  product,
  productDetail,
  existingVariantIds,
  onConfirm,
}: BulkVariantReceiveModalProps) {
  if (!isOpen) return null;

  const variants = useMemo(() => {
    return (productDetail?.variants || []).filter((v) => v.status === "active");
  }, [productDetail]);

  // Set of checked variant IDs
  const [checkedVariantIds, setCheckedVariantIds] = useState<Set<string>>(new Set());
  // Map of variantId -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Map of variantId -> unitCost
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});
  // Quick filters & batch tools
  const [searchQuery, setSearchQuery] = useState("");
  const [batchQuantity, setBatchQuantity] = useState<number>(10);
  const [batchUnitCost, setBatchUnitCost] = useState<number>(0);

  // Available option values for 1-click filter chips (e.g., 128GB, Titan, Đen...)
  const filterChips = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) {
      for (const ov of v.optionValues || []) {
        if (ov.value) set.add(ov.value);
      }
    }
    return Array.from(set);
  }, [variants]);

  // Filtered variants
  const filteredVariants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter((v) => {
      const matchSku = v.sku.toLowerCase().includes(q);
      const matchBarcode = v.barcode?.toLowerCase().includes(q);
      const matchName = v.displayName?.toLowerCase().includes(q);
      const matchOpts = (v.optionValues || []).some((opt) => opt.value.toLowerCase().includes(q));
      return matchSku || matchBarcode || matchName || matchOpts;
    });
  }, [variants, searchQuery]);

  // Checked count among currently filtered variants
  const checkedInFiltered = useMemo(() => {
    return filteredVariants.filter((v) => checkedVariantIds.has(v._id));
  }, [filteredVariants, checkedVariantIds]);

  const isAllVisibleChecked = filteredVariants.length > 0 && checkedInFiltered.length === filteredVariants.length;
  const isSomeVisibleChecked = checkedInFiltered.length > 0 && checkedInFiltered.length < filteredVariants.length;

  // Toggle single variant checkbox
  const handleToggleCheck = (variantId: string) => {
    setCheckedVariantIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) {
        next.delete(variantId);
        // Clear quantity for unchecked item so no phantom quantity remains
        setQuantities((q) => {
          const nextQ = { ...q };
          delete nextQ[variantId];
          return nextQ;
        });
      } else {
        next.add(variantId);
        // Initialize quantity if currently 0
        if (!quantities[variantId] || quantities[variantId] <= 0) {
          setQuantities((q) => ({ ...q, [variantId]: batchQuantity || 1 }));
        }
        if (batchUnitCost > 0 && (!unitCosts[variantId] || unitCosts[variantId] <= 0)) {
          setUnitCosts((c) => ({ ...c, [variantId]: batchUnitCost }));
        }
      }
      return next;
    });
  };

  // Toggle header checkbox (all visible)
  const handleToggleSelectAllVisible = () => {
    if (isAllVisibleChecked) {
      // Uncheck all visible
      setCheckedVariantIds((current) => {
        const next = new Set(current);
        for (const v of filteredVariants) {
          next.delete(v._id);
        }
        return next;
      });
      setQuantities((current) => {
        const next = { ...current };
        for (const v of filteredVariants) {
          delete next[v._id];
        }
        return next;
      });
    } else {
      // Check all visible
      setCheckedVariantIds((current) => {
        const next = new Set(current);
        for (const v of filteredVariants) {
          next.add(v._id);
        }
        return next;
      });
      // Initialize quantities for those newly checked
      setQuantities((current) => {
        const next = { ...current };
        for (const v of filteredVariants) {
          if (!next[v._id] || next[v._id] <= 0) {
            next[v._id] = batchQuantity || 1;
          }
        }
        return next;
      });
      if (batchUnitCost > 0) {
        setUnitCosts((current) => {
          const next = { ...current };
          for (const v of filteredVariants) {
            if (!next[v._id] || next[v._id] <= 0) {
              next[v._id] = batchUnitCost;
            }
          }
          return next;
        });
      }
    }
  };

  // Apply batch quantity ONLY to CHECKED variants
  const handleApplyBatchQuantity = () => {
    if (batchQuantity <= 0) {
      toast.error("Vui lòng nhập số lượng lớn hơn 0.");
      return;
    }

    const targetVariants = searchQuery.trim()
      ? filteredVariants.filter((v) => checkedVariantIds.has(v._id))
      : variants.filter((v) => checkedVariantIds.has(v._id));

    if (targetVariants.length === 0) {
      toast.error("Vui lòng tích chọn ô checkbox của các SKU bạn muốn áp số lượng.");
      return;
    }

    setQuantities((current) => {
      const next = { ...current };
      for (const v of targetVariants) {
        next[v._id] = batchQuantity;
      }
      return next;
    });
    toast.success(`Đã áp dụng số lượng ${batchQuantity} cho ${targetVariants.length} SKU đã tích chọn.`);
  };

  // Apply batch unit cost ONLY to CHECKED variants
  const handleApplyBatchUnitCost = () => {
    if (batchUnitCost < 0) {
      toast.error("Vui lòng nhập đơn giá hợp lệ.");
      return;
    }

    const targetVariants = searchQuery.trim()
      ? filteredVariants.filter((v) => checkedVariantIds.has(v._id))
      : variants.filter((v) => checkedVariantIds.has(v._id));

    if (targetVariants.length === 0) {
      toast.error("Vui lòng tích chọn ô checkbox của các SKU bạn muốn áp đơn giá.");
      return;
    }

    setUnitCosts((current) => {
      const next = { ...current };
      for (const v of targetVariants) {
        next[v._id] = batchUnitCost;
      }
      return next;
    });
    toast.success(`Đã áp dụng giá nhập ${batchUnitCost.toLocaleString("vi-VN")} ₫ cho ${targetVariants.length} SKU đã tích chọn.`);
  };

  // Quick select all with default
  const handleSelectAllPresets = () => {
    setCheckedVariantIds(new Set(filteredVariants.map((v) => v._id)));
    setQuantities((current) => {
      const next = { ...current };
      for (const v of filteredVariants) {
        if (!next[v._id] || next[v._id] <= 0) {
          next[v._id] = batchQuantity || 1;
        }
      }
      return next;
    });
    if (batchUnitCost > 0) {
      setUnitCosts((current) => {
        const next = { ...current };
        for (const v of filteredVariants) {
          if (!next[v._id] || next[v._id] <= 0) {
            next[v._id] = batchUnitCost;
          }
        }
        return next;
      });
    }
  };

  // Clear all selections
  const handleClearAll = () => {
    setCheckedVariantIds(new Set());
    setQuantities({});
  };

  // Count active selections (must be checked and have quantity > 0)
  const selectedList = useMemo(() => {
    const list: SelectedReceiveVariant[] = [];
    for (const v of variants) {
      if (checkedVariantIds.has(v._id)) {
        const qty = quantities[v._id] || 0;
        if (qty > 0) {
          list.push({
            variant: v,
            quantity: qty,
            unitCost: unitCosts[v._id] || 0,
          });
        }
      }
    }
    return list;
  }, [variants, checkedVariantIds, quantities, unitCosts]);

  const totalQuantity = useMemo(() => {
    return selectedList.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [selectedList]);

  const totalAmount = useMemo(() => {
    return selectedList.reduce((acc, curr) => acc + curr.quantity * curr.unitCost, 0);
  }, [selectedList]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedList.length === 0) {
      toast.error("Vui lòng tích chọn ít nhất 1 biến thể SKU và nhập số lượng.");
      return;
    }
    onConfirm(selectedList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 bg-white">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                Nhập nhanh nhiều SKU theo sản phẩm
              </h3>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                {variants.length} SKU
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sản phẩm: <span className="font-semibold text-slate-700">{product.name}</span> ({product.productCode})
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

        {/* Toolbar & Filter */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search filter */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Lọc biến thể (VD: 128GB, Titan, Đen, Cũ 98%...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick selection presets */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllPresets}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                Chọn tất cả ({filteredVariants.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 shadow-sm transition-colors"
              >
                Bỏ chọn hết
              </button>
            </div>
          </div>

          {/* Quick attribute filter chips */}
          {filterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 mr-0.5">Lọc nhanh:</span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  !searchQuery
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Tất cả ({variants.length})
              </button>
              {filterChips.slice(0, 10).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSearchQuery(searchQuery === chip ? "" : chip)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    searchQuery.toLowerCase() === chip.toLowerCase()
                      ? "bg-cyan-700 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Bulk set quantity & unit cost for CHECKED items */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Đang chọn:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    checkedInFiltered.length > 0
                      ? "bg-cyan-100 text-cyan-800 border border-cyan-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {checkedInFiltered.length} / {filteredVariants.length} SKU
                </span>
                {checkedInFiltered.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-slate-500 hover:text-rose-600 underline ml-1"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-500 italic">
                * Điền số lượng hoặc đơn giá rồi bấm Áp dụng cho các SKU đang tích chọn
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Apply Quantity */}
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border border-slate-200">
                <span className="text-xs text-slate-700 shrink-0 font-medium">
                  SL chung:
                </span>
                <NumberInput
                  value={batchQuantity}
                  onChange={(val) => setBatchQuantity(val)}
                  className="w-20 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-right font-bold text-slate-900 outline-none focus:border-cyan-600"
                  placeholder="10"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchQuantity}
                  className="rounded bg-cyan-700 hover:bg-cyan-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm ml-auto"
                >
                  {checkedInFiltered.length > 0
                    ? `Áp cho ${checkedInFiltered.length} SKU`
                    : "Áp số lượng"}
                </button>
              </div>

              {/* Apply Unit Cost */}
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border border-slate-200">
                <span className="text-xs text-slate-700 shrink-0 font-medium">
                  Giá nhập chung:
                </span>
                <NumberInput
                  value={batchUnitCost}
                  onChange={(val) => setBatchUnitCost(val)}
                  className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-right font-bold text-slate-900 outline-none focus:border-cyan-600"
                  placeholder="0 ₫"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchUnitCost}
                  className="rounded bg-cyan-700 hover:bg-cyan-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm ml-auto"
                >
                  {checkedInFiltered.length > 0
                    ? `Áp cho ${checkedInFiltered.length} SKU`
                    : "Áp đơn giá"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Variants Table */}
        <div className="flex-1 overflow-y-auto max-h-[420px] p-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-2.5 text-center w-12">
                    <input
                      type="checkbox"
                      checked={isAllVisibleChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeVisibleChecked;
                      }}
                      onChange={handleToggleSelectAllVisible}
                      title="Tích chọn / Bỏ chọn tất cả các dòng đang hiển thị"
                      className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 cursor-pointer"
                    />
                  </th>
                  <th className="p-2.5">Biến thể</th>
                  <th className="p-2.5">Mã SKU</th>
                  <th className="p-2.5">Quản lý kho</th>
                  <th className="p-2.5 text-right w-32">Số lượng *</th>
                  <th className="p-2.5 text-right w-36">Giá nhập (₫) *</th>
                  <th className="p-2.5 text-right w-36">Thành tiền (₫)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredVariants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      Không tìm thấy biến thể nào phù hợp với từ khóa "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredVariants.map((v) => {
                    const isAlreadyInReceipt = existingVariantIds.includes(v._id);
                    const isChecked = checkedVariantIds.has(v._id);
                    const qty = quantities[v._id] || 0;
                    const cost = unitCosts[v._id] || 0;
                    const lineTotal = isChecked && qty > 0 ? qty * cost : 0;

                    return (
                      <tr
                        key={v._id}
                        className={`transition-colors ${
                          isChecked ? "bg-cyan-50/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCheck(v._id)}
                            className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900 text-xs">
                            {v.displayName || v.sku}
                          </div>
                          {isAlreadyInReceipt && (
                            <span className="inline-block mt-0.5 rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-700 border border-amber-200">
                              Đã có trong phiếu
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-xs text-slate-600">
                          {v.sku}
                        </td>
                        <td className="p-2.5 text-xs text-slate-600">
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                            {trackingLabels[v.trackingMode] || v.trackingMode}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            value={isChecked ? qty : 0}
                            onChange={(num) => {
                              setQuantities((curr) => ({ ...curr, [v._id]: num }));
                              if (num > 0) {
                                setCheckedVariantIds((curr) => new Set(curr).add(v._id));
                              } else {
                                setCheckedVariantIds((curr) => {
                                  const next = new Set(curr);
                                  next.delete(v._id);
                                  return next;
                                });
                              }
                            }}
                            placeholder="0"
                            className={`w-full rounded border px-2 py-1 text-xs text-right font-bold outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-sm ${
                              isChecked
                                ? "border-cyan-400 bg-white text-slate-900"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            value={cost}
                            onChange={(num) =>
                              setUnitCosts((curr) => ({ ...curr, [v._id]: num }))
                            }
                            placeholder="0 ₫"
                            className={`w-full rounded border px-2 py-1 text-xs text-right font-semibold outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-sm ${
                              isChecked
                                ? "border-cyan-400 bg-white text-slate-900"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                          />
                        </td>
                        <td className="p-2.5 text-right font-semibold tabular-nums text-xs text-slate-900">
                          {lineTotal > 0 ? `${lineTotal.toLocaleString("vi-VN")} ₫` : "0 ₫"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-5 text-xs">
            <div>
              <span className="text-slate-500">Đã chọn:</span>{" "}
              <strong className="font-bold text-slate-900">{selectedList.length} SKU</strong>
            </div>
            <div>
              <span className="text-slate-500">Tổng số lượng:</span>{" "}
              <strong className="font-bold text-cyan-800">{totalQuantity} máy</strong>
            </div>
            <div>
              <span className="text-slate-500">Tổng tiền dự kiến:</span>{" "}
              <strong className="font-bold text-slate-900">{totalAmount.toLocaleString("vi-VN")} ₫</strong>
            </div>
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={selectedList.length === 0}
              onClick={handleSubmit}
              className="rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Thêm {selectedList.length} SKU vào phiếu nhập
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
