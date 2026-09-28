import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package,
  Search,
  SlidersHorizontal,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Tag,
  CheckCircle2,
  History,
  RotateCw,
  X,
  Percent,
  Check,
  Info,
} from "lucide-react";
import { partnerRequest } from "./partnerApi";
import { toast } from "../../pages/Toast";

export type Rule = {
  kind: "phone" | "accessory";
  amount?: number;
  rateBps?: number;
};

export type Data = {
  products: { _id: string; name: string; categoryCode: string }[];
  variants: { _id: string; productId: string; sku: string; displayName?: string }[];
  categories: { code: string; name: string; parentCode?: string }[];
  configurations: { sku: string; rule: Rule | null }[];
  legacyRules: {
    policyId: string;
    partnerId: string;
    effectiveAt: string;
    rule: Rule & { sku: string };
  }[];
};

type Node = {
  key: string;
  name: string;
  children: Node[];
  sku?: string;
  isCategory?: boolean;
  isProduct?: boolean;
};

const rate = (r: Rule) =>
  r.kind === "phone"
    ? `${Number(r.amount || 0).toLocaleString("vi-VN")} đ/máy`
    : `${Number(r.rateBps || 0) / 100}%`;

const PHONE_PRESETS = [150000, 200000, 250000, 300000];
const ACCESSORY_PRESETS = [10, 12, 15];

export function ProductCommissions() {
  const [data, setData] = useState<Data>();
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "configured" | "default">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string[]>([]);
  const [kind, setKind] = useState<Rule["kind"]>("phone");
  const [value, setValue] = useState("200000");
  const [busy, setBusy] = useState(false);

  // Manage collapsed state for category/product nodes
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const toggleCollapse = (key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedKeys(new Set());

  const load = useCallback(async () => {
    try {
      const res = await partnerRequest<Data>("/product-commissions");
      setData(res);
    } catch (e) {
      toast.error((e as Error).message || "Không thể tải danh mục hoa hồng sản phẩm.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const configure = (skus: string[]) => {
    if (!skus.length) return;
    const rule = data?.configurations.find((c) => c.sku === skus[0])?.rule;
    setKind(rule?.kind || "phone");
    setValue(
      String(
        rule
          ? rule.kind === "phone"
            ? rule.amount
            : (rule.rateBps || 0) / 100
          : 200000
      )
    );
    setEditing(skus);
  };

  const save = async (reset = false) => {
    if (busy) return;
    setBusy(true);
    try {
      await partnerRequest("/product-commissions", "PUT", {
        skus: editing,
        rule: reset
          ? null
          : {
              kind,
              ...(kind === "phone"
                ? { amount: Number(value) }
                : { rateBps: Math.round(Number(value) * 100) }),
            },
      });
      setEditing([]);
      setSelected([]);
      toast.success(
        reset
          ? "Đã khôi phục về chính sách chung."
          : "Đã lưu cấu hình hoa hồng sản phẩm."
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Không thể lưu cấu hình.");
    } finally {
      setBusy(false);
    }
  };

  // Build tree from categories, products, and variants
  const roots = useMemo(() => {
    if (!data) return [];

    const cats = new Map<string, Node>();
    for (const c of data.categories) {
      cats.set(c.code.trim().toUpperCase(), {
        key: `cat-${c.code}`,
        name: c.name,
        children: [],
        isCategory: true,
      });
    }

    const result: Node[] = [];

    for (const c of data.categories) {
      const codeKey = c.code.trim().toUpperCase();
      const visited = new Set([codeKey]);
      let parent = c.parentCode?.trim().toUpperCase();
      let cycle = false;
      while (parent) {
        if (visited.has(parent)) {
          cycle = true;
          break;
        }
        visited.add(parent);
        const parentCategory = data.categories.find(
          (x) => x.code.trim().toUpperCase() === parent
        );
        parent = parentCategory?.parentCode?.trim().toUpperCase();
      }

      const node = cats.get(codeKey)!;
      const parentKey = c.parentCode?.trim().toUpperCase();
      if (!cycle && parentKey && cats.has(parentKey)) {
        cats.get(parentKey)!.children.push(node);
      } else {
        result.push(node);
      }
    }

    for (const p of data.products) {
      const children = data.variants
        .filter((v) => String(v.productId) === String(p._id))
        .map((v) => ({
          key: `var-${v._id}`,
          name: `${v.displayName || p.name} · ${v.sku}`,
          sku: v.sku,
          children: [],
        }));
      if (!children.length) continue;

      const node: Node = {
        key: `prod-${p._id}`,
        name: p.name,
        children,
        isProduct: true,
      };

      const catKey = p.categoryCode?.trim().toUpperCase();
      const cat = catKey ? cats.get(catKey) : undefined;
      if (cat) cat.children.push(node);
      else result.push(node);
    }

    // Filter by query and filterMode
    const filter = (node: Node, matched = false): Node | null => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        matched || !q || node.name.toLowerCase().includes(q) || (node.sku && node.sku.toLowerCase().includes(q));

      if (node.sku) {
        if (!matchesQuery) return null;
        if (filterMode === "configured") {
          const config = data.configurations.find((c) => c.sku === node.sku);
          if (!config?.rule) return null;
        } else if (filterMode === "default") {
          const config = data.configurations.find((c) => c.sku === node.sku);
          if (config?.rule) return null;
        }
        return node;
      }

      const children = node.children
        .map((n) => filter(n, matchesQuery && !node.sku))
        .filter((n): n is Node => !!n);

      return children.length ? { ...node, children } : null;
    };

    return result.map((n) => filter(n)).filter((n): n is Node => !!n);
  }, [data, query, filterMode]);

  const skusOf = useCallback((n: Node): string[] => (n.sku ? [n.sku] : n.children.flatMap(skusOf)), []);

  const allVisibleSkus = useMemo(() => roots.flatMap(skusOf), [roots, skusOf]);

  const toggleSelectAll = () => {
    if (selected.length === allVisibleSkus.length && allVisibleSkus.length > 0) {
      setSelected([]);
    } else {
      setSelected(allVisibleSkus);
    }
  };

  // Stats
  const totalVariants = data?.variants.length || 0;
  const customConfiguredCount = data?.configurations.filter((c) => c.rule).length || 0;
  const defaultPolicyCount = Math.max(0, totalVariants - customConfiguredCount);

  // Render tree node
  function renderNode(node: Node, level = 0): React.ReactNode {
    const skus = skusOf(node);
    const checked = skus.length > 0 && skus.every((s) => selected.includes(s));
    const partiallyChecked = !checked && skus.some((s) => selected.includes(s));
    const configuration = data?.configurations.find((c) => c.sku === node.sku);
    const legacy = configuration ? [] : data?.legacyRules.filter((r) => r.rule.sku === node.sku) || [];

    const isCollapsed = collapsedKeys.has(node.key);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      setSelected((old) =>
        checked
          ? old.filter((s) => !skus.includes(s))
          : [...new Set([...old, ...skus])]
      );
    };

    if (node.sku) {
      // Leaf variant node
      return (
        <div
          key={node.key}
          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white p-3 hover:border-cyan-200 hover:bg-cyan-50/20 transition shadow-2xs ml-4 sm:ml-8"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <input
              type="checkbox"
              aria-label={`Chọn ${node.name}`}
              checked={checked}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer shrink-0"
            />
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 shrink-0">
              <Tag className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {node.name.split(" · ")[0]}
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {node.sku}
                </span>
              </div>
              <div className="mt-1">
                {configuration?.rule ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Mức riêng: {rate(configuration.rule)}</span>
                  </span>
                ) : legacy.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/90 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    <History className="h-3 w-3" />
                    <span>
                      Mức SKU cũ:{" "}
                      {legacy
                        .map(
                          (l) =>
                            `${rate(l.rule)} (${
                              l.partnerId ? "CTV riêng" : "chung"
                            }, ${new Date(l.effectiveAt).toLocaleDateString("vi-VN")})`
                        )
                        .join("; ")}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 font-medium">
                    Áp dụng chính sách chung / chính sách CTV
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-cyan-700 shadow-2xs hover:bg-cyan-50 hover:border-cyan-300 transition cursor-pointer"
              onClick={() => configure(skus)}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Cấu hình</span>
            </button>
          </div>
        </div>
      );
    }

    // Branch node (Category or Product)
    const isCategory = node.isCategory;
    return (
      <div
        key={node.key}
        className={`rounded-2xl border transition ${
          isCategory
            ? "border-slate-200/90 bg-slate-50/50 shadow-xs mb-3.5"
            : "border-slate-200/70 bg-white shadow-2xs mb-2 ml-3 sm:ml-5"
        }`}
      >
        {/* Node Header Bar */}
        <div
          onClick={() => toggleCollapse(node.key)}
          className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl cursor-pointer select-none transition ${
            isCategory
              ? "bg-slate-100/70 hover:bg-slate-100"
              : "hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(node.key);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title={isCollapsed ? "Mở rộng" : "Thu gọn"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            <input
              type="checkbox"
              aria-label={`Chọn ${node.name}`}
              checked={checked}
              ref={(el) => {
                if (el) el.indeterminate = partiallyChecked;
              }}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer shrink-0"
            />

            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                isCategory
                  ? "bg-cyan-100/80 text-cyan-700 font-bold"
                  : "bg-indigo-50 text-indigo-600 font-semibold"
              }`}
            >
              {isCategory ? (
                <Folder className="h-4 w-4" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span
                className={`truncate ${
                  isCategory
                    ? "font-bold text-slate-900 text-sm"
                    : "font-semibold text-slate-800 text-xs sm:text-sm"
                }`}
              >
                {node.name}
              </span>
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600 font-mono">
                {skus.length} SKU
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50 transition cursor-pointer shadow-2xs"
              onClick={() => configure(skus)}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Cấu hình {isCategory ? "nhóm" : "máy"}</span>
            </button>
          </div>
        </div>

        {/* Node Children */}
        {!isCollapsed && (
          <div className="p-2 sm:p-3 space-y-2 border-t border-slate-200/50">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Banner & Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white shadow-md shadow-cyan-500/20">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Cấu hình hoa hồng sản phẩm
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Thiết lập mức chi trả hoa hồng riêng biệt cho từng dòng máy hoặc phụ kiện. Mức riêng sẽ được ưu tiên cao nhất cho mọi CTV.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            <span>Tải lại</span>
          </button>
        </div>

        {/* Metric Overview Cards: Separate, clear metric cards without confusing slashes */}
        {data && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-3 border-t border-slate-100">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <span className="block text-[11px] font-semibold text-slate-500">
                Nhóm ngành hàng
              </span>
              <span className="text-xl font-black text-slate-900">
                {data.categories.length} <span className="text-xs font-semibold text-slate-500">nhóm</span>
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <span className="block text-[11px] font-semibold text-slate-500">
                Tổng sản phẩm
              </span>
              <span className="text-xl font-black text-slate-900">
                {data.products.length} <span className="text-xs font-semibold text-slate-500">sản phẩm</span>
              </span>
            </div>

            <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/50 p-3">
              <span className="block text-[11px] font-bold text-cyan-800">
                Tổng biến thể (SKU)
              </span>
              <span className="text-xl font-black text-cyan-700">
                {totalVariants} <span className="text-xs font-semibold text-cyan-600">SKU</span>
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
              <span className="block text-[11px] font-bold text-emerald-800">
                Đã đặt mức riêng
              </span>
              <span className="text-xl font-black text-emerald-700">
                {customConfiguredCount} <span className="text-xs font-semibold text-emerald-600">SKU</span>
                {totalVariants > 0 && (
                  <span className="ml-1 text-xs font-medium text-emerald-600/80">
                    ({Math.round((customConfiguredCount / totalVariants) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Search, Filter and Selection Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Tìm sản phẩm"
              placeholder="Tìm nhóm, sản phẩm, SKU..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-9 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`rounded-lg px-2.5 py-1.5 font-bold transition cursor-pointer ${
                filterMode === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("configured")}
              className={`rounded-lg px-2.5 py-1.5 font-bold transition cursor-pointer ${
                filterMode === "configured"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Có mức riêng
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("default")}
              className={`rounded-lg px-2.5 py-1.5 font-bold transition cursor-pointer ${
                filterMode === "default"
                  ? "bg-white text-cyan-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chính sách chung
            </button>
          </div>
        </div>

        {/* Tree Expand Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <FolderOpen className="h-3.5 w-3.5 text-cyan-600" />
            <span>Mở rộng tất cả</span>
          </button>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <span>{selected.length === allVisibleSkus.length && allVisibleSkus.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span>
          </button>
        </div>
      </div>

      {/* Floating Selection Action Bar */}
      {selected.length > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300 bg-cyan-50/95 p-3.5 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-white font-bold text-xs">
              {selected.length}
            </span>
            <span className="text-xs font-bold text-cyan-900">
              Đang chọn {selected.length} biến thể (SKU)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!selected.length}
              onClick={() => configure(selected)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 hover:from-cyan-700 hover:to-teal-700 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Cấu hình đã chọn ({selected.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Configuration Modal Dialog */}
      {editing.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Cấu hình hoa hồng {editing.length} SKU
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editing.length <= 500
                      ? `Áp dụng đồng loạt cho ${editing.length} sản phẩm được chọn`
                      : "Vượt quá giới hạn tối đa 500 SKU mỗi lần cấu hình."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing([])}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              aria-label="Cấu hình hoa hồng sản phẩm"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-4"
            >
              <fieldset disabled={busy} className="space-y-4">
                {/* Rule Type Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Loại hoa hồng
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setKind("phone");
                        setValue("200000");
                      }}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        kind === "phone"
                          ? "border-cyan-500 bg-cyan-50/60 ring-2 ring-cyan-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                          kind === "phone"
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">
                          Điện thoại / Thiết bị
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          Mức cố định trên mỗi máy (đ/máy, từ 150k - 300k)
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setKind("accessory");
                        setValue("10");
                      }}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        kind === "accessory"
                          ? "border-cyan-500 bg-cyan-50/60 ring-2 ring-cyan-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                          kind === "accessory"
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Percent className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">
                          Phụ kiện / Doanh thu
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          Tỷ lệ theo doanh thu (% doanh thu, từ 10% - 15%)
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Value Input and Quick Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Mức riêng
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {kind === "phone" ? "Tối thiểu 150.000đ — Tối đa 300.000đ" : "Tối thiểu 10% — Tối đa 15%"}
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      autoFocus
                      required
                      type="number"
                      aria-label="Mức riêng"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-14 text-sm font-bold text-slate-900 shadow-2xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                      min={kind === "phone" ? 150000 : 10}
                      max={kind === "phone" ? 300000 : 15}
                      step={kind === "phone" ? 1000 : 0.1}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-bold text-slate-400">
                      {kind === "phone" ? "VNĐ/máy" : "% DT"}
                    </span>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1">
                      Mức nhanh:
                    </span>
                    {(kind === "phone" ? PHONE_PRESETS : ACCESSORY_PRESETS).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setValue(String(p))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs ${
                          Number(value) === p
                            ? "bg-cyan-50 border-cyan-400 text-cyan-800 font-bold"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {kind === "phone" ? `${(p / 1000).toLocaleString("vi-VN")}k` : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Helpful note */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-start gap-2">
                  <Info className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                  <span>
                    Mức này sẽ ghi đè chính sách chung và áp dụng cho tất cả CTV. Bấm <b>Dùng chính sách</b> nếu muốn gỡ bỏ mức riêng và quay lại theo chính sách chung.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditing([])}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={editing.length > 500 || busy}
                    onClick={() => void save(true)}
                    className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-800 hover:bg-orange-100 transition cursor-pointer shadow-2xs"
                  >
                    Dùng chính sách
                  </button>
                  <button
                    type="submit"
                    disabled={editing.length > 500 || busy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/20 hover:from-cyan-700 hover:to-teal-700 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Lưu cấu hình</span>
                      </>
                    )}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Main Hierarchy Tree Content */}
      <div className="space-y-3">
        {!data ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-slate-200 bg-white">
            <RotateCw className="h-7 w-7 text-cyan-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Đang tải danh mục sản phẩm...</p>
            <p className="text-xs text-slate-400 mt-1">Hệ thống đang nạp thông tin hoa hồng và các biến thể</p>
          </div>
        ) : roots.length ? (
          roots.map((root) => renderNode(root))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-slate-200 bg-white">
            <Package className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">Không có sản phẩm phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">
              Thử xóa từ khóa tìm kiếm hoặc đổi chế độ lọc để xem thêm
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
