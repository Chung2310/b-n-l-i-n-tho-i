import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Folder, FolderTree, Pencil, Plus, Tag } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import {
  type CatalogProductDetail,
  type ProductCatalogStatus,
  type ProductCatalogType,
  type ProductResource,
  type ProductTrackingMode,
  type ProductVariant,
  type VariantInput,
  productCatalogService,
} from "../../../services/productCatalogService";
import { generateEAN13, type Option, type GeneratedVariant, cleanOptionSlug } from "../../../hooks/useVariantMatrix";
import { buildMatrixVariantInput } from "../productVariantPayload";
import { shouldCreateInitialPrice } from "../productCatalogCreation";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";
import {
  type ProductForm,
  type Resources,
  type VariantModalMode,
  buildCategoryTree3,
  emptyProductForm,
  emptyVariant,
  inputClassName,
  statusLabels,
  trackingLabels,
  typeLabels,
} from "./catalogConstants";
import { Field, ImageUploadBox, Modal, NumberInput } from "./catalogUi";
import { VariantMatrixBuilder } from "./VariantMatrixBuilder";

interface ProductEditorModalProps {
  product: CatalogProductDetail | null;
  resources: Resources;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDataChanged: () => Promise<void>;
  onVariantAction: (product: CatalogProductDetail, mode: VariantModalMode, ids?: string[], variant?: ProductVariant) => void;
}

export function ProductEditorModal({
  product,
  resources,
  onClose,
  onSaved,
  onDataChanged,
  onVariantAction,
}: ProductEditorModalProps) {
  const isEditing = Boolean(product);
  const [form, setForm] = useState<ProductForm>(() =>
    product
      ? {
          productCode: product.productCode,
          name: product.name,
          productType: product.productType,
          categoryCode: product.categoryCode,
          brandCode: product.brandCode || "",
          baseUnitCode: product.baseUnitCode,
          shortDescription: product.shortDescription || "",
          description: product.description || "",
          manufacturer: product.manufacturer || "",
          countryOfOrigin: product.countryOfOrigin || "",
          taxCategory: product.taxCategory || "",
          warrantyMonths: product.warrantyMonths || 0,
          status: product.status,
          mediaIds: product.mediaIds || [],
        }
      : emptyProductForm()
  );

  const [variant, setVariant] = useState<VariantInput>(() =>
    product ? emptyVariant(product.baseUnitCode, product.productType) : emptyVariant()
  );
  const [submitting, setSubmitting] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [deleteVariantIds, setDeleteVariantIds] = useState<string[] | null>(null);
  const [deletingVariants, setDeletingVariants] = useState(false);
  const [variantImages, setVariantImages] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries((product?.variants || []).map((item) => [item._id, item.mediaIds?.[0]]))
  );
  const [variantQuery, setVariantQuery] = useState("");
  const [pricesByVariant, setPricesByVariant] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!product) return;
    void productCatalogService
      .listPrices()
      .then((prices) => setPricesByVariant(Object.fromEntries(prices.map((price) => [price.variantId, price.sellingPrice]))))
      .catch(() => {});
  }, [product?._id]);

  // Handle category change: auto-set tracking mode based on category defaults
  const handleCategoryChange = (categoryCode: string) => {
    setField("categoryCode", categoryCode);
    const cat = resources.categories.find((c) => c.code === categoryCode);
    if (cat?.defaultTrackingMode && form.productType !== "service") {
      setVariant((curr) => ({ ...curr, trackingMode: cat.defaultTrackingMode! }));
    }
  };

  // Matrix generation state
  const [options, setOptions] = useState<Option[]>([]);
  const [variantsMatrix, setVariantsMatrix] = useState<GeneratedVariant[]>([]);

  const visibleVariants = useMemo(() => {
    const keyword = variantQuery.trim().toLowerCase();
    if (!product || !keyword) return product?.variants || [];
    return product.variants.filter((item) =>
      [item.sku, item.displayName, item.barcode].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [product, variantQuery]);

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const confirmDeleteVariants = async () => {
    if (!deleteVariantIds?.length) return;
    setDeletingVariants(true);
    try {
      await productCatalogService.deleteVariants(deleteVariantIds);
      toast.success("Đã xóa các SKU chưa phát sinh giao dịch.");
      setDeleteVariantIds(null);
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa SKU đã chọn."));
    } finally {
      setDeletingVariants(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Tên sản phẩm không được để trống.");
      return;
    }
    if (!form.categoryCode) {
      toast.error("Vui lòng chọn danh mục.");
      return;
    }

    setSubmitting(true);
    const payload = {
      productCode: form.productCode || undefined,
      name: form.name.trim(),
      productType: form.productType,
      categoryCode: form.categoryCode,
      brandCode: form.brandCode || undefined,
      baseUnitCode: form.baseUnitCode,
      shortDescription: form.shortDescription || undefined,
      description: form.description || undefined,
      manufacturer: form.manufacturer || undefined,
      countryOfOrigin: form.countryOfOrigin || undefined,
      taxCategory: form.taxCategory || undefined,
      warrantyMonths: form.warrantyMonths,
      status: form.status,
      mediaIds: form.mediaIds,
    };

    try {
      if (product) {
        const { productCode: _productCode, productType: _productType, ...update } = payload;
        await productCatalogService.updateProduct(product._id, { ...update, brandCode: form.brandCode || null });
        toast.success("Đã cập nhật thông tin sản phẩm.");
      } else {
        if (options.some((o) => o.values.length > 0)) {
          // Bulk create via Matrix
          if (variantsMatrix.length === 0) {
            throw new Error("Không có SKU nào được sinh ra từ ma trận thuộc tính.");
          }

          const matrixPayloads = variantsMatrix.map((v) => {
            let sku = (v.sku || "").trim();
            if (!sku) {
              const skuSuffix = v.optionValues.map((opt) => cleanOptionSlug(opt.value)).join("-");
              sku = payload.productCode ? `${payload.productCode}-${skuSuffix}` : `SKU-${skuSuffix}-${generateEAN13().slice(9)}`;
            }
            return buildMatrixVariantInput({
              row: { ...v, sku },
              shared: variant,
              productCode: payload.productCode || "",
              baseUnitCode: form.baseUnitCode,
              productType: form.productType,
              fallbackSku: sku,
            });
          });

          const createdProduct = await productCatalogService.bulkCreateWithVariants({
            ...payload,
            variants: matrixPayloads,
          });

          // Atomically upsert prices for every generated variant
          if (createdProduct.variants && createdProduct.variants.length > 0) {
            await Promise.all(
              createdProduct.variants.map((v, idx) => {
                const matrixRow = variantsMatrix[idx];
                const sellingPrice = matrixRow ? Number(matrixRow.price || 0) : 0;
                const costPrice = matrixRow ? Number(matrixRow.costPrice || 0) : 0;
                return productCatalogService.upsertPrice(v._id, sellingPrice, costPrice);
              })
            );
          }

          toast.success(`Đã tạo thành công sản phẩm cùng ${createdProduct.variants?.length || matrixPayloads.length} biến thể kèm giá bán!`);
        } else {
          // Single create flow
          let sku = (variant.sku || "").trim();
          if (!sku) {
            sku = payload.productCode || `SKU-${generateEAN13().slice(6)}`;
          }
          const created = await productCatalogService.createProduct({
            ...payload,
            variant: {
              ...variant,
              sku,
              unitCode: variant.unitCode || form.baseUnitCode,
              trackingMode: form.productType === "service" ? "none" : variant.trackingMode,
            },
          });
          const createdVariant = created.variants?.[0];
          if (createdVariant && shouldCreateInitialPrice(form.status)) {
            await productCatalogService.upsertPrice(String(createdVariant._id), Number(variant.sellingPrice || 0), Number(variant.costPrice || 0));
          }
          toast.success("Đã tạo sản phẩm và SKU đầu tiên.");
        }
      }
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu sản phẩm."));
    } finally {
      setSubmitting(false);
    }
  };

  // 3-Level Category Tree for product dropdown
  const { tree: categoryTree } = useMemo(() => buildCategoryTree3(resources.categories), [resources.categories]);

  const typeOptions = useMemo<DropdownOption<ProductCatalogType>[]>(() => [
    { value: "physical", label: "Hàng hóa vật lý (quản lý kho, IMEI/SL)" },
    { value: "service", label: "Dịch vụ (sửa chữa, thay pin, không theo dõi kho)" },
  ], []);

  const categoryDropdownOptions = useMemo<DropdownOption<string>[]>(() => {
    const list: DropdownOption<string>[] = [];
    for (const root of categoryTree) {
      list.push({
        value: root.category.code,
        label: `[Cấp 1] ${root.category.name}`,
        icon: <Folder className="h-4 w-4 text-amber-500" />,
        className: "font-bold text-slate-900 bg-slate-50/80",
      });
      for (const l2 of root.children) {
        list.push({
          value: l2.category.code,
          label: `[Cấp 2] ${l2.category.name}`,
          icon: <FolderTree className="h-3.5 w-3.5 text-cyan-600 ml-3" />,
          className: "pl-5 font-semibold text-slate-800",
        });
        for (const l3 of l2.children) {
          list.push({
            value: l3.category.code,
            label: `[Cấp 3] ${l3.category.name}`,
            icon: <Tag className="h-3 w-3 text-slate-400 ml-6" />,
            className: "pl-9 text-slate-600 font-normal",
          });
        }
      }
    }
    return list;
  }, [categoryTree]);

  const brandDropdownOptions = useMemo<DropdownOption<string>[]>(() => [
    { value: "", label: "Không chọn thương hiệu" },
    ...resources.brands.map((item) => ({
      value: item.code,
      label: item.name,
    })),
  ], [resources.brands]);

  const statusDropdownOptions = useMemo<DropdownOption<ProductCatalogStatus>[]>(() => [
    { value: "draft", label: "Bản nháp", icon: <span className="h-2 w-2 rounded-full bg-amber-400" /> },
    { value: "active", label: "Đang kinh doanh", icon: <span className="h-2 w-2 rounded-full bg-emerald-500" /> },
    { value: "inactive", label: "Tạm ngừng kinh doanh", icon: <span className="h-2 w-2 rounded-full bg-slate-400" /> },
    { value: "archived", label: "Lưu trữ", icon: <span className="h-2 w-2 rounded-full bg-rose-400" /> },
  ], []);

  const selectedCategoryObj = resources.categories.find((c) => c.code === form.categoryCode);

  return (
    <>
      <Modal title={isEditing ? `Sản phẩm: ${product!.name}` : "Tạo sản phẩm & Ma trận Biến thể"} onClose={onClose} wide>
        <form noValidate onSubmit={submit} className="bg-slate-50/50 -m-5 p-5 space-y-5">
          {/* Khối 1: Thông tin cơ bản */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">1</span>
              Thông tin Đời máy / Sản phẩm
            </h4>
            <div className="grid gap-6 md:grid-cols-[140px_1fr]">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-700">Ảnh đại diện</label>
                <ImageUploadBox value={form.mediaIds[0]} onChange={(url) => setField("mediaIds", [url])} className="w-full aspect-square" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 h-fit">
                {isEditing && (
                  <Field label="Mã sản phẩm">
                    <input readOnly value={form.productCode} className={inputClassName("bg-slate-50 text-slate-500 font-mono")} />
                  </Field>
                )}
                <Field label="Tên sản phẩm / Đời máy *">
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    className={inputClassName()}
                    placeholder="VD: iPhone 16 Pro Max, Củ sạc 65W GaN..."
                  />
                </Field>
                <Field label="Loại sản phẩm">
                  <Dropdown<ProductCatalogType>
                    disabled={isEditing}
                    value={form.productType}
                    onChange={(productType) => {
                      setField("productType", productType);
                      setVariant((current) => ({
                        ...current,
                        trackingMode: productType === "service" ? "none" : current.trackingMode === "none" ? "quantity" : current.trackingMode,
                      }));
                    }}
                    options={typeOptions}
                    variant="form"
                    size="md"
                    className="w-full"
                    triggerClassName="w-full text-xs font-medium"
                  />
                </Field>
                <Field label="Danh mục sản phẩm *">
                  <div className="space-y-1">
                    <Dropdown<string>
                      value={form.categoryCode}
                      onChange={handleCategoryChange}
                      options={categoryDropdownOptions}
                      placeholder="-- Chọn thể loại / danh mục --"
                      searchable={true}
                      searchPlaceholder="Tìm kiếm danh mục..."
                      variant="form"
                      size="md"
                      className="w-full"
                      triggerClassName="w-full text-xs font-medium"
                    />
                    {selectedCategoryObj?.defaultTrackingMode && (
                      <p className="text-[11px] text-cyan-700 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Hình thức quản lý kho mặc định:{" "}
                        <strong>{trackingLabels[selectedCategoryObj.defaultTrackingMode]}</strong>
                      </p>
                    )}
                  </div>
                </Field>
                <Field label="Thương hiệu / Hãng">
                  <Dropdown<string>
                    value={form.brandCode}
                    onChange={(val) => setField("brandCode", val)}
                    options={brandDropdownOptions}
                    searchable={resources.brands.length > 8}
                    searchPlaceholder="Tìm hãng..."
                    placeholder="Không chọn thương hiệu"
                    variant="form"
                    size="md"
                    className="w-full"
                    triggerClassName="w-full text-xs font-medium"
                  />
                </Field>
                <Field label="Trạng thái">
                  <Dropdown<ProductCatalogStatus>
                    value={form.status}
                    onChange={(status) => setField("status", status)}
                    options={statusDropdownOptions}
                    variant="form"
                    size="md"
                    className="w-full"
                    triggerClassName="w-full text-xs font-medium"
                  />
                </Field>
                <Field label="Bảo hành khách hàng (tháng)">
                  <NumberInput value={form.warrantyMonths} onChange={(value) => setField("warrantyMonths", value)} className={inputClassName()} placeholder="0" />
                </Field>
              </div>
            </div>
          </div>

          {/* Khối 2: Bộ sinh Ma trận Biến thể (Khi tạo mới sản phẩm) */}
          {!isEditing && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">2</span>
                <span className="text-sm font-semibold text-slate-900">Thiết lập Biến thể &amp; Ma trận</span>
              </div>
              <VariantMatrixBuilder
                options={options}
                setOptions={setOptions}
                variantsMatrix={variantsMatrix}
                setVariantsMatrix={setVariantsMatrix}
                productType={form.productType}
                trackingMode={variant.trackingMode}
                onTrackingModeChange={(mode) => setVariant((c) => ({ ...c, trackingMode: mode }))}
                baseSku={form.productCode}
              />
            </div>
          )}

          {/* Khối 2: Danh sách SKU hiện hữu khi đang Edit sản phẩm */}
          {isEditing && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">2</span>
                  Danh sách biến thể SKU ({product!.variants.length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onVariantAction(product!, "bulk-create")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tạo nhanh nhiều SKU
                  </button>
                  <button
                    type="button"
                    onClick={() => onVariantAction(product!, "single")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm một SKU
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2.5 w-[50px]">Ảnh</th>
                      <th className="px-3 py-2.5">Mã SKU</th>
                      <th className="px-3 py-2.5">Tên biến thể</th>
                      <th className="px-3 py-2.5">Giá bán</th>
                      <th className="px-3 py-2.5">Theo dõi kho</th>
                      <th className="px-3 py-2.5">Trạng thái</th>
                      <th className="px-3 py-2.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {visibleVariants.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5">
                          <ImageUploadBox
                            value={variantImages[item._id] ?? item.mediaIds?.[0]}
                            onChange={(url) => {
                              setVariantImages((curr) => ({ ...curr, [item._id]: url }));
                              void productCatalogService.updateVariant(item._id, { mediaIds: [url] });
                            }}
                            className="h-10 w-10 !rounded-md"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-xs font-semibold text-slate-700">{item.sku}</div>
                          <div className="mt-0.5 font-sans text-[11px] text-slate-400">{item.barcode || "Chưa có mã vạch"}</div>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">{item.displayName || <span className="text-slate-400 italic">Mặc định</span>}</td>
                        <td className="px-3 py-2.5 font-semibold text-cyan-700">
                          {pricesByVariant[item._id] ? `${pricesByVariant[item._id].toLocaleString("vi-VN")} ₫` : <span className="text-rose-500 font-normal">Chưa có giá</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded">{trackingLabels[item.trackingMode]}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {item.status === "active" ? "Đang dùng" : "Ngừng dùng"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onVariantAction(product!, "edit", undefined, { ...item, sellingPrice: pricesByVariant[item._id] || 0 } as any)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-cyan-700"
                            title="Sửa SKU"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Khối 3: Thông tin mở rộng */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">3</span>
              Thông tin mở rộng &amp; Mô tả
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mô tả ngắn">
                <input value={form.shortDescription} onChange={(event) => setField("shortDescription", event.target.value)} className={inputClassName()} placeholder="Tóm tắt tính năng chính" />
              </Field>
              <Field label="Nhà sản xuất">
                <input value={form.manufacturer} onChange={(event) => setField("manufacturer", event.target.value)} className={inputClassName()} />
              </Field>
              <Field label="Xuất xứ">
                <input value={form.countryOfOrigin} onChange={(event) => setField("countryOfOrigin", event.target.value)} className={inputClassName()} />
              </Field>
              <Field label="Nhóm thuế">
                <input value={form.taxCategory} onChange={(event) => setField("taxCategory", event.target.value)} className={inputClassName()} />
              </Field>
            </div>
            <Field label="Mô tả chi tiết">
              <textarea rows={3} value={form.description} onChange={(event) => setField("description", event.target.value)} className={inputClassName("resize-y font-sans")} placeholder="Chi tiết sản phẩm..." />
            </Field>
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-8 flex justify-end gap-3 rounded-b-lg border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 shadow-sm transition-colors disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : `Tạo sản phẩm ${variantsMatrix.length > 0 ? `(${variantsMatrix.length} SKU)` : ""}`}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteVariantIds)}
        title="Xóa SKU đã chọn?"
        description={`Chỉ xóa được ${deleteVariantIds?.length || 0} SKU chưa có tồn kho hoặc lịch sử giao dịch. Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa SKU"
        tone="danger"
        isSubmitting={deletingVariants}
        onClose={() => !deletingVariants && setDeleteVariantIds(null)}
        onConfirm={confirmDeleteVariants}
      />
    </>
  );
}
