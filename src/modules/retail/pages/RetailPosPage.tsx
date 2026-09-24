import React from "react";
import CollaboratorPicker from "../../partners/CollaboratorPicker";
import {
  Camera,
  Check,
  ChevronDown,
  HelpCircle,
  Keyboard,
  Pause,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Ticket,
  Trash2,
  User,
  X,
} from "lucide-react";
import { customerApi } from "../../customer-management/customerApi";
import BarcodeScannerDialog from "../components/pos/BarcodeScannerDialog";
import CheckoutSuccessDialog from "../components/pos/CheckoutSuccessDialog";
import CustomerCouponOffers from "../components/coupons/CustomerCouponOffers";
import CustomerPicker from "../components/pos/CustomerPicker";
import DiscountInput from "../components/pos/DiscountInput";
import HeldDraftsBar from "../components/pos/HeldDraftsBar";
import OrderAdjustments from "../components/pos/OrderAdjustments";
import { QuantityInput } from "../components/pos/QuantityInput";
import PaymentDialog from "../components/pos/PaymentDialog";
import PosShortcutHelp from "../components/pos/PosShortcutHelp";
import ScanFeedback, {
  playScanTone,
  type ScanFeedbackKind,
} from "../components/pos/ScanFeedback";
import RetailOfflineQueuePanel from "../components/pos/RetailOfflineQueuePanel";
import { SerialPicker, UnitBarcodePicker } from "../components/pos/RetailUnitPickerDialog";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailProductsApi } from "../api/retailProducts.api";
import {
  initialRetailCart,
  retailCartReducer,
  type RetailCartState,
} from "../hooks/retailCart";
import { buildRetailOrderInput } from "../hooks/retailOrderInput";
import { useRetailScope } from "../hooks/useRetailScope";
import { useRetailPosShortcuts } from "../hooks/useRetailPosShortcuts";
import { createHidScannerBuffer } from "../hooks/retailScannerInput";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import {
  createIndexedDbRetailOfflineQueue,
  createMemoryRetailOfflineQueue,
  createRetailOfflineOrder,
  type OfflineScope,
  type RetailOfflineOrder,
} from "../offline/retailOfflineQueue";
import { isRetailNetworkFailure, syncRetailOfflineQueue } from "../offline/retailOfflineSync";
import type {
  RetailOrder,
  RetailOrderResult,
  RetailPaymentInput,
  RetailProduct,
  RetailScope,
} from "../types";
import { toast } from "../../../pages/Toast";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function RetailPosPage() {
  const { scope, userProfile, branchName, activeBranch } = useRetailScope() as any;
  const branchDisplayName =
    branchName ||
    activeBranch?.name ||
    userProfile?.branchName ||
    (scope?.branchId && !/^[0-9a-fA-F]{24}$/.test(scope.branchId) ? scope.branchId : "");
  const [cart, dispatch] = React.useReducer(
    retailCartReducer,
    initialRetailCart,
  );
  const [products, setProducts] = React.useState<RetailProduct[]>([]);
  const [drafts, setDrafts] = React.useState<RetailOrder[]>([]);
  const [draft, setDraft] = React.useState<RetailOrder | null>(null);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [billingProfiles, setBillingProfiles] = React.useState<any[]>([]);
  const [scanning, setScanning] = React.useState(false);
  const [completed, setCompleted] = React.useState<RetailOrderResult | null>(
    null,
  );
  const [help, setHelp] = React.useState(false);
  const [scanFeedback, setScanFeedback] = React.useState<{
    kind: ScanFeedbackKind;
    text: string;
  } | null>(null);
  const [reloading, setReloading] = React.useState(false);

  const searchRef = React.useRef<HTMLInputElement>(null);
  const queueRef = React.useRef(
    typeof indexedDB === "undefined"
      ? createMemoryRetailOfflineQueue()
      : createIndexedDbRetailOfflineQueue(),
  );
  const [offlineItems, setOfflineItems] = React.useState<RetailOfflineOrder[]>([]);
  const offlineScope =
    scope && userProfile?.uid ? { ...scope, userId: userProfile.uid } : null;

  const openPayment = () => {
    if (!cart.quote || cart.quoteDirty) return;
    if (!cart.customer?._id) {
      toast.error("Vui lòng chọn khách hàng trước khi thanh toán.");
      return;
    }
    setPaying(true);
  };

  const refreshOffline = React.useCallback(() => {
    if (offlineScope) {
      void queueRef.current
        .list(offlineScope)
        .then((items) => setOfflineItems(items.filter((item) => item.status !== "synced")));
    }
  }, [offlineScope?.companyCode, offlineScope?.branchId, offlineScope?.userId]);

  useRetailPosShortcuts(
    React.useMemo(
      () => ({
        focusSearch: () => searchRef.current?.focus(),
        openPayment,
        holdDraft: () =>
          (
            Array.from(document.querySelectorAll("button")).find((button) =>
              button.textContent?.includes("Treo đơn"),
            ) as HTMLButtonElement | undefined
          )?.click(),
        openScanner: () => setScanning(true),
        openHelp: () => setHelp(true),
      }),
      [openPayment],
    ),
  );

  const show = React.useCallback(
    (cause: unknown) =>
      toast.error(
        cause instanceof Error ? cause.message : "Không xử lý được yêu cầu.",
      ),
    [],
  );

  const refreshDrafts = React.useCallback(() => {
    if (scope) {
      void retailOrdersApi
        .list(scope, { heldOnly: true, limit: 5 })
        .then((data) => setDrafts(data.items))
        .catch(show);
    }
  }, [scope?.companyCode, scope?.branchId, show]);

  const refreshCatalog = React.useCallback(async () => {
    if (!scope) return;
    setReloading(true);
    try {
      const data = await retailProductsApi.list(scope, { q, limit: 500 });
      setProducts(data.items);
      refreshDrafts();
    } catch (error) {
      show(error);
    } finally {
      setReloading(false);
    }
  }, [scope?.companyCode, scope?.branchId, q, refreshDrafts, show]);

  React.useEffect(() => {
    if (!scope) return;
    refreshDrafts();
  }, [scope?.companyCode, scope?.branchId, refreshDrafts, show]);

  React.useEffect(() => {
    if (!scope) return;
    const timer = window.setTimeout(
      () =>
        void retailProductsApi
          .list(scope, { q, limit: 500 })
          .then((data) => setProducts(data.items))
          .catch(show),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [scope?.companyCode, scope?.branchId, q, show]);

  React.useEffect(() => {
    if (!scope || !cart.lines.length || !cart.quoteDirty) return;
    let current = true;
    const timer = window.setTimeout(
      () =>
        void retailOrdersApi
          .quote(scope, buildRetailOrderInput(cart))
          .then((quote) => {
            if (current) dispatch({ type: "quote", quote });
          })
          .catch((error) => {
            if (current) {
              dispatch({ type: "quoteFailed" });
              show(error);
            }
          }),
      180,
    );
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [scope, cart, show]);

  React.useEffect(() => {
    if (!scope || !cart.customer?._id) {
      setBillingProfiles([]);
      dispatch({ type: "billingProfile", billingProfile: null });
      return;
    }
    void customerApi
      .billingProfiles(cart.customer._id, scope.companyCode)
      .then((items) => {
        const active = items.filter((item) => item.status === "active");
        setBillingProfiles(active);
        const selected =
          active.find((item) => item._id === cart.billingProfile?._id) ||
          active.find((item) => item.isDefault) ||
          null;
        dispatch({ type: "billingProfile", billingProfile: selected });
      })
      .catch(() => {
        setBillingProfiles([]);
        dispatch({ type: "billingProfile", billingProfile: null });
      });
  }, [scope?.companyCode, cart.customer?._id]);

  React.useEffect(() => {
    refreshOffline();
  }, [refreshOffline]);

  if (!scope) return <Notice />;

  const scan = async (barcode: string) => {
    try {
      const warranty = await retailWarrantyService.lookup(barcode);
      if (warranty.found && warranty.status === "sold") {
        const soldDate = warranty.sold?.at
          ? new Date(warranty.sold.at).toLocaleDateString("vi-VN")
          : "không rõ ngày";
        const endDate = warranty.customerWarranty?.endAt
          ? new Date(warranty.customerWarranty.endAt).toLocaleDateString("vi-VN")
          : "không xác định";
        setScanFeedback({
          kind: "warning",
          text: `Máy đã bán ngày ${soldDate} — còn bảo hành khách đến ${endDate}`,
        });
        playScanTone("warning");
        return;
      }
      if (
        warranty.found &&
        warranty.status === "in_stock" &&
        (warranty.gapMonths || 0) > 0
      ) {
        setScanFeedback({
          kind: "warning",
          text: `Cảnh báo: bảo hành nhà cung cấp ngắn hơn cam kết khách ${warranty.gapMonths} tháng — shop sẽ chịu phần chênh lệch`,
        });
        playScanTone("warning");
      }
      const result = await retailProductsApi.list(scope, { barcode, limit: 1 });
      const product = result.items[0];
      if (!product) {
        setScanFeedback({ kind: "not-found", text: "Không tìm thấy sản phẩm" });
        playScanTone("not-found");
        return;
      }
      const line = cart.lines.find((item) => item.product._id === product._id);
      const unitField =
        product.trackingMode === "serial"
          ? ("serialNumbers" as const)
          : product.trackingMode === "unit_barcode"
          ? ("internalBarcodes" as const)
          : null;
      const scannedUnit =
        product.trackingMode === "serial"
          ? product.matchedSerialNumber
          : product.trackingMode === "unit_barcode"
          ? product.matchedInternalBarcode
          : undefined;
      if (unitField && scannedUnit) {
        const current = line?.[unitField] || [];
        if (current.includes(scannedUnit)) {
          setScanFeedback({
            kind: "duplicate",
            text: `${scannedUnit} đã có trong đơn`,
          });
          playScanTone("duplicate");
          return;
        }
        const next = [...current, scannedUnit];
        if (!line) dispatch({ type: "add", product });
        dispatch({
          type: "quantity",
          productId: product._id,
          quantity: next.length,
        });
        dispatch(
          unitField === "serialNumbers"
            ? { type: "serials", productId: product._id, serialNumbers: next }
            : {
                type: "internalBarcodes",
                productId: product._id,
                internalBarcodes: next,
              },
        );
        setQ("");
        setScanFeedback({
          kind: "success",
          text: `Đã thêm ${product.name} (${scannedUnit})`,
        });
        playScanTone("success");
        return;
      }
      const duplicate = Boolean(line);
      dispatch({ type: "add", product });
      setQ("");
      const kind = duplicate ? "duplicate" : "success";
      setScanFeedback({
        kind,
        text: duplicate
          ? `Đã tăng số lượng ${product.name}`
          : `Đã thêm ${product.name}`,
      });
      playScanTone(kind);
    } catch (error) {
      show(error);
    }
  };

  const addProductToCart = (product: RetailProduct, clearSearch = false) => {
    const current =
      cart.lines.find((line) => line.product._id === product._id)?.quantity || 0;
    if (product.stock <= current) {
      toast.error(`${product.name} không còn đủ tồn khả dụng.`);
      return;
    }
    dispatch({ type: "add", product });
    if (clearSearch) setQ("");
  };

  const openDraft = (value: RetailOrder) => {
    setDraft(value);
    dispatch({
      type: "load",
      collaboratorId: value.collaboratorId,
      lines: value.items.map((item) => ({
        product: {
          _id: item.productId,
          sku: item.sku,
          name: item.productName,
          category: "",
          unit: item.unit,
          stock: 0,
          price: item.unitPrice,
        },
        quantity: item.quantity,
        discount: { type: "amount", value: item.discountAmount },
        serialNumbers: item.serialNumbers,
      })),
      customer: value.customerId
        ? {
            _id: value.customerId,
            customerCode: value.customerSnapshot?.customerCode || value.customerId,
            companyCode: scope.companyCode,
            type: value.billingProfileId ? "vat" : "regular",
            name: value.customerName || "Khách hàng",
            phone: value.customerPhone,
          }
        : null,
      billingProfile:
        value.billingProfileId && value.billingSnapshot
          ? {
              _id: value.billingProfileId,
              customerId: value.customerId || "",
              legalName: value.billingSnapshot.legalName,
              taxId: value.billingSnapshot.taxId,
              address: value.billingSnapshot.address,
              invoiceEmail: value.billingSnapshot.invoiceEmail,
              contactName: value.billingSnapshot.contactName,
              isDefault: false,
              status: "active",
              version: 0,
            }
          : null,
      couponCode: value.couponCode,
      orderDiscount: {
        type: "amount",
        value: value.couponCode ? 0 : value.orderDiscount,
      },
      taxRate: value.taxRate,
      shippingFee: value.shippingFee,
    });
    toast.info(`Đang xử lý đơn treo #${value._id.slice(-6)}`);
  };

  const saveDraft = async () => {
    if (!cart.lines.length) return;
    if (!cart.customer?._id) {
      toast.error("Vui lòng chọn khách hàng trước khi lưu đơn.");
      return;
    }
    setBusy(true);
    try {
      const input = buildRetailOrderInput(cart);
      if (draft)
        await retailOrdersApi.updateDraft(scope, draft._id, {
          ...input,
          version: draft.version,
        });
      else await retailOrdersApi.createDraft(scope, input);
      dispatch({ type: "reset" });
      setDraft(null);
      refreshDrafts();
      toast.success("Đã treo đơn. Đơn không giữ tồn kho.");
    } catch (error) {
      show(error);
    } finally {
      setBusy(false);
    }
  };

  const checkout = async (payments: RetailPaymentInput[], dueDate?: string) => {
    if (!cart.quote || cart.quoteDirty) return;
    const customerId = cart.customer?._id;
    setBusy(true);
    const key = crypto.randomUUID();
    const input = { ...buildRetailOrderInput(cart), dueDate };
    let savedId = draft?._id;
    try {
      const saved = draft
        ? await retailOrdersApi.updateDraft(scope, draft._id, {
            ...input,
            version: draft.version,
          })
        : await retailOrdersApi.createDraft(scope, input);
      savedId = saved._id;
      const result = await retailOrdersApi.confirm(scope, saved._id, {
        expectedGrandTotal: cart.quote.grandTotal,
        payments,
        idempotencyKey: key,
      });
      finish(result);
      setPaying(false);
    } catch (error) {
      const attempt = await retailOrdersApi
        .idempotency(scope, key)
        .catch(() => null);
      if (attempt?.status === "completed" && attempt.order && attempt.invoice) {
        finish({ order: attempt.order, invoice: attempt.invoice });
        setPaying(false);
      } else if (offlineScope && isRetailNetworkFailure(error)) {
        await queueRef.current.put(
          createRetailOfflineOrder(
            offlineScope,
            {
              draftId: savedId,
              input,
              expectedGrandTotal: cart.quote.grandTotal,
              payments,
            },
            key,
          ),
        );
        dispatch({ type: "reset" });
        setDraft(null);
        setPaying(false);
        toast.info("Đơn đang chờ đồng bộ khi có mạng.");
        refreshOffline();
      } else {
        if (error instanceof Error && /tồn|không đủ/i.test(error.message)) {
          await retailProductsApi
            .list(scope, { q, limit: 500 })
            .then((data) => setProducts(data.items))
            .catch(() => undefined);
        }
        if (savedId && !draft)
          await retailOrdersApi
            .cancel(scope, savedId, {
              reason: "Tự động hủy draft sau khi thanh toán thất bại.",
            })
            .catch(() => {});
        show(error);
      }
    } finally {
      setBusy(false);
    }
  };

  const finish = (result: RetailOrderResult) => {
    setCompleted(result);
    setDraft(null);
    setPaying(false);
    refreshDrafts();
  };

  const newOrder = () => {
    dispatch({ type: "reset" });
    setCompleted(null);
    setDraft(null);
  };

  const syncOffline = async (activeScope: OfflineScope) => {
    const results = await syncRetailOfflineQueue(queueRef.current, activeScope, {
      check: (key) => retailOrdersApi.idempotency(activeScope, key),
      send: async (item) => {
        const payload = item.payload as any;
        const order = payload.draftId
          ? { _id: payload.draftId }
          : await retailOrdersApi.createDraft(activeScope, payload.input);
        return retailOrdersApi.confirm(activeScope, order._id, {
          expectedGrandTotal: payload.expectedGrandTotal,
          payments: payload.payments,
          idempotencyKey: item.idempotencyKey,
        });
      },
    });
    refreshOffline();
    return results;
  };

  return (
    <section className="grid min-h-[75vh] gap-5 lg:grid-cols-[1fr_450px]">
      <HidScannerListener onScan={(value) => void scan(value)} />
      {offlineScope && (
        <OnlineRetailSync scope={offlineScope} sync={syncOffline} />
      )}

      {/* Main Catalog Column */}
      <main className="space-y-4">
        {/* Top Header Card */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-600 text-white shadow-md shadow-cyan-500/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Bán hàng
                </h1>
                {branchDisplayName && (
                  <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                    {branchDisplayName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Thu ngân: <span className="font-semibold text-slate-700">{userProfile?.displayName || userProfile?.email || "Nhân viên"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              onClick={() => setScanning(true)}
              title="Quét mã vạch bằng camera"
            >
              <Camera className="h-4 w-4 text-cyan-600" />
              <span className="hidden sm:inline">Quét camera</span>
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              onClick={() => setHelp(true)}
              title="Xem danh sách phím tắt POS (F1)"
            >
              <Keyboard className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Phím tắt</span>
            </button>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
              onClick={() => void refreshCatalog()}
              disabled={reloading}
              title="Làm mới danh sách sản phẩm"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 ${reloading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* Held Drafts Bar */}
        <HeldDraftsBar
          drafts={drafts}
          activeId={draft?._id}
          onOpen={openDraft}
        />

        {/* Product Search & Barcode Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            autoFocus
            aria-label="Tìm hoặc quét sản phẩm"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-24 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tên sản phẩm, SKU hoặc mã vạch..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const product = products[0];
              if (product) addProductToCart(product, true);
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400 shadow-2xs">
              Enter ↵
            </kbd>
          </div>
        </div>

        {scanFeedback && <ScanFeedback {...scanFeedback} />}

        {/* Product Catalog Grid */}
        <ProductGrid products={products} onAdd={addProductToCart} />
      </main>

      {/* Cart & Checkout Panel */}
      <CartPanel
        scope={scope}
        cart={cart}
        billingProfiles={billingProfiles}
        busy={busy}
        canPay={true}
        dispatch={dispatch}
        onHold={saveDraft}
        onPay={openPayment}
      />

      <RetailOfflineQueuePanel
        items={offlineItems}
        onRetry={(id) =>
          void queueRef.current
            .update(id, { status: "pending", lastError: undefined })
            .then(() => offlineScope && syncOffline(offlineScope))
        }
        onRemove={(id) =>
          void queueRef.current.remove(id).then(refreshOffline)
        }
      />

      {paying && cart.quote && (
        <PaymentDialog
          total={cart.quote.grandTotal}
          busy={busy}
          customerId={cart.customer?._id}
          onClose={() => setPaying(false)}
          onSubmit={checkout}
        />
      )}

      {scanning && (
        <BarcodeScannerDialog
          onScan={(value) => void scan(value)}
          onClose={() => setScanning(false)}
        />
      )}

      {completed && (
        <CheckoutSuccessDialog
          result={completed}
          onNewOrder={newOrder}
          onClose={() => setCompleted(null)}
        />
      )}

      {help && <PosShortcutHelp onClose={() => setHelp(false)} />}
    </section>
  );
}

type ProductGroup = { key: string; name: string; variants: RetailProduct[] };

function groupProductsBySku(products: RetailProduct[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const product of products) {
    const key = product.productId || product._id;
    const suffix = product.variantName ? ` - ${product.variantName}` : "";
    const baseName =
      suffix && product.name.endsWith(suffix)
        ? product.name.slice(0, -suffix.length)
        : product.name;
    const existing = groups.get(key);
    if (existing) existing.variants.push(product);
    else groups.set(key, { key, name: baseName, variants: [product] });
  }
  return Array.from(groups.values());
}

function ProductCard({
  group,
  onAdd,
}: {
  group: ProductGroup;
  onAdd: (product: RetailProduct) => void;
}) {
  const defaultId = (
    group.variants.find((variant) => variant.stock > 0) || group.variants[0]
  )._id;
  const [selectedId, setSelectedId] = React.useState(defaultId);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!group.variants.some((variant) => variant._id === selectedId))
      setSelectedId(defaultId);
  }, [group.variants, selectedId, defaultId]);

  const selected =
    group.variants.find((variant) => variant._id === selectedId) ||
    group.variants[0];
  const totalStock = group.variants.reduce(
    (sum, variant) => sum + Math.max(0, variant.stock),
    0,
  );
  const isSoldOut = selected.stock <= 0;

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-cyan-400 hover:shadow-md">
      <button
        type="button"
        disabled={isSoldOut}
        className="w-full text-left transition active:scale-[0.99] disabled:opacity-50"
        onClick={() => onAdd(selected)}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="block font-bold text-slate-900 group-hover:text-cyan-700 transition">
            {group.name}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isSoldOut
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {isSoldOut ? "Hết tồn" : `Tồn: ${selected.stock}`}
          </span>
        </div>

        <span className="mt-1 block font-mono text-xs text-slate-500">
          {selected.sku} · Tồn {selected.stock > 0 ? selected.stock : "Hết tồn khả dụng"}
        </span>

        <span className="mt-2.5 block font-mono text-base font-bold text-cyan-700">
          {money(selected.price)}
        </span>
      </button>

      {group.variants.length > 1 && (
        <div className="relative mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Chọn SKU cho ${group.name}`}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-cyan-400 hover:bg-white"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-700">
                {selected.variantName || selected.sku}
              </span>
              <span className="block text-[10px] text-slate-400">
                {group.variants.length} SKU · Tồn tổng {totalStock}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
              />
              <ul
                role="listbox"
                className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl"
              >
                {group.variants.map((variant) => {
                  const active = variant._id === selected._id;
                  const soldOut = variant.stock <= 0;
                  return (
                    <li key={variant._id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={soldOut}
                        onClick={() => {
                          setSelectedId(variant._id);
                          setOpen(false);
                          onAdd(variant);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                          soldOut
                            ? "cursor-not-allowed opacity-45"
                            : "hover:bg-cyan-50"
                        } ${active ? "bg-cyan-50/70" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800">
                            {variant.variantName || variant.sku}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-slate-400">
                            {variant.sku}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono font-semibold text-cyan-700">
                            {money(variant.price)}
                          </span>
                          <span
                            className={`block text-[10px] ${
                              soldOut ? "text-rose-500 font-semibold" : "text-slate-400"
                            }`}
                          >
                            {soldOut ? "Hết tồn" : `Tồn ${variant.stock}`}
                          </span>
                        </span>
                        <Check
                          className={`h-4 w-4 shrink-0 ${
                            active ? "text-cyan-600" : "invisible"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProductGrid({
  products,
  onAdd,
}: {
  products: RetailProduct[];
  onAdd: (product: RetailProduct) => void;
}) {
  const groups = React.useMemo(() => groupProductsBySku(products), [products]);

  if (groups.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
        <Store className="mb-2 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium">Không tìm thấy sản phẩm nào.</p>
        <p className="text-xs text-slate-400">Hãy thử từ khóa khác hoặc quét mã vạch.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <ProductCard key={group.key} group={group} onAdd={onAdd} />
      ))}
    </div>
  );
}

function HidScannerListener({ onScan }: { onScan(value: string): void }) {
  const callback = React.useRef(onScan);
  callback.current = onScan;
  React.useEffect(() => {
    const scanner = createHidScannerBuffer({
      timeoutMs: 50,
      minLength: 3,
      onScan: (value) => callback.current(value),
    });
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !target ||
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
        scanner.keydown(event);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return null;
}

function OnlineRetailSync({
  scope,
  sync,
}: {
  scope: OfflineScope;
  sync(scope: OfflineScope): Promise<unknown>;
}) {
  const callback = React.useRef(sync);
  callback.current = sync;
  React.useEffect(() => {
    const run = () => void callback.current(scope);
    window.addEventListener("online", run);
    if (navigator.onLine) run();
    return () => window.removeEventListener("online", run);
  }, [scope.companyCode, scope.branchId, scope.userId]);
  return null;
}

function CartPanel({
  scope,
  cart,
  billingProfiles,
  busy,
  canPay,
  dispatch,
  onHold,
  onPay,
}: {
  scope: RetailScope;
  cart: RetailCartState;
  billingProfiles: any[];
  busy: boolean;
  canPay: boolean;
  dispatch: React.Dispatch<any>;
  onHold: () => Promise<void>;
  onPay: () => void;
}) {
  const totalItemCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <aside className="flex flex-col rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <span>Giỏ hàng</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {totalItemCount} món
          </span>
        </h2>

        {cart.lines.length > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: "reset" })}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-rose-600"
            title="Xóa toàn bộ giỏ hàng"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Xóa giỏ</span>
          </button>
        )}
      </div>

      {/* Customer & Partner selector */}
      <div className="mt-3.5 space-y-2.5">
        <CollaboratorPicker
          value={cart.collaboratorId}
          onChange={(collaboratorId) =>
            dispatch({ type: "collaborator", collaboratorId })
          }
        />
        <CustomerPicker
          scope={scope}
          value={cart.customer}
          onChange={(customer) => dispatch({ type: "customer", customer })}
        />
        <CustomerCouponOffers
          key={scope.companyCode + scope.branchId + (cart.customer?._id || "")}
          scope={scope}
          customerId={cart.customer?._id}
          selectedCode={cart.couponCode}
          onApply={(code) => dispatch({ type: "coupon", code })}
        />

        {cart.customer?.type === "vat" && (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-sm">
            <p className="font-semibold text-amber-900">Hoa don VAT</p>
            <select
              aria-label="Ho so VAT"
              value={cart.billingProfile?._id || ""}
              onChange={(event) =>
                dispatch({
                  type: "billingProfile",
                  billingProfile:
                    billingProfiles.find((item) => item._id === event.target.value) ||
                    null,
                })
              }
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xs"
            >
              <option value="">Chon ho so xuat VAT</option>
              {billingProfiles.map((profile) => (
                <option key={profile._id} value={profile._id}>
                  {profile.legalName} - {profile.taxId}
                </option>
              ))}
            </select>
            {!billingProfiles.length && (
              <p className="text-xs text-amber-700">
                Khach nay chua co ho so VAT dang hoat dong.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cart Items List */}
      <div className="my-4 flex-1 space-y-3 overflow-y-auto max-h-[38vh] pr-1">
        {cart.lines.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-slate-400">
            <ShoppingCart className="mb-2 h-7 w-7 text-slate-300" />
            <p className="text-xs font-medium text-slate-500">Giỏ hàng đang trống</p>
            <p className="text-[11px] text-slate-400">Chọn sản phẩm bên trái hoặc quét mã vạch</p>
          </div>
        ) : (
          cart.lines.map((line) => (
            <div
              key={line.product._id}
              className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-3 transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm text-slate-900">
                    {line.product.name}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {money(line.product.price)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <QuantityInput
                    ariaLabel={`Số lượng ${line.product.name}`}
                    value={line.quantity}
                    onQuantityChange={(quantity) =>
                      dispatch({
                        type: "quantity",
                        productId: line.product._id,
                        quantity,
                      })
                    }
                  />

                  <button
                    type="button"
                    aria-label={`Xóa ${line.product.name}`}
                    onClick={() =>
                      dispatch({ type: "remove", productId: line.product._id })
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <DiscountInput
                label={`Giảm giá ${line.product.name}`}
                value={line.discount}
                onChange={(discount) =>
                  dispatch({
                    type: "lineDiscount",
                    productId: line.product._id,
                    discount,
                  })
                }
              />

              {line.product.trackingMode === "serial" && (
                <SerialPicker
                  productId={line.product.productId || line.product._id}
                  variantId={line.product.variantId}
                  quantity={line.quantity}
                  value={line.serialNumbers || []}
                  onChange={(serialNumbers) =>
                    dispatch({
                      type: "serials",
                      productId: line.product._id,
                      serialNumbers,
                    })
                  }
                />
              )}

              {line.product.trackingMode === "unit_barcode" && (
                <UnitBarcodePicker
                  productId={line.product._id}
                  variantId={line.product.variantId}
                  quantity={line.quantity}
                  value={line.internalBarcodes || []}
                  onChange={(internalBarcodes) =>
                    dispatch({
                      type: "internalBarcodes",
                      productId: line.product._id,
                      internalBarcodes,
                    })
                  }
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Adjustments & Coupons */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <OrderAdjustments
          orderDiscount={cart.orderDiscount}
          taxRate={cart.taxRate}
          shippingFee={cart.shippingFee}
          onChange={(value) => dispatch({ type: "orderAdjustments", ...value })}
        />

        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Ticket className="h-3.5 w-3.5 text-cyan-600" />
            Mã ưu đãi
          </label>
          <div className="relative mt-1.5 flex items-center">
            <input
              aria-label="Mã ưu đãi"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 font-mono text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              maxLength={32}
              placeholder="Nhập mã ưu đãi..."
              value={cart.couponCode || ""}
              onChange={(event) =>
                dispatch({ type: "coupon", code: event.target.value })
              }
            />
            {cart.couponCode && (
              <button
                type="button"
                onClick={() => dispatch({ type: "coupon", code: "" })}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                title="Xóa mã"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {cart.couponCode && (
            <div className="mt-1.5 text-[11px]">
              {cart.quoteDirty ? (
                <span className="text-slate-500">
                  Đang kiểm tra mã và tính lại đơn...
                </span>
              ) : cart.quote && Number(cart.quote.orderDiscount || 0) > 0 ? (
                <span className="font-semibold text-emerald-700">
                  ✓ Đã áp dụng giảm {money(Number(cart.quote.orderDiscount || 0))}
                </span>
              ) : (
                <span className="text-amber-700">
                  Chưa áp dụng được mã. Kiểm tra điều kiện đơn hoặc xóa mã để tiếp tục.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary and Buttons */}
      <div className="mt-4 pt-3.5 border-t border-slate-100">
        <div className="flex items-baseline justify-between text-base font-bold text-slate-900">
          <span>Tổng tiền</span>
          <span className="font-mono text-2xl text-cyan-700">
            {money(cart.quote?.grandTotal || 0)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={!cart.lines.length || busy}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3.5 font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-40"
            onClick={() => void onHold()}
          >
            <Pause className="h-4 w-4 text-slate-500" />
            Treo đơn
          </button>

          <button
            type="button"
            disabled={
              !cart.lines.length ||
              !cart.quote ||
              cart.quoteDirty ||
              !canPay ||
              busy
            }
            className="rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 font-bold text-white shadow-md shadow-cyan-600/25 transition hover:from-cyan-700 hover:to-blue-700 hover:shadow-cyan-600/35 active:scale-95 disabled:opacity-40"
            onClick={onPay}
          >
            Thanh toán
          </button>
        </div>
      </div>
    </aside>
  );
}

function Notice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
      Vui lòng chọn chi nhánh.
    </div>
  );
}
