import React from "react";
import { Download, Link2, Loader2, Pencil, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { tiktokShopApi, type TikTokShopProduct, type TikTokShopStatus } from "../../services/tiktokShopService";

export default function TikTokShopSettingsTab() {
  const [status, setStatus] = React.useState<TikTokShopStatus | null>(null);
  const [products, setProducts] = React.useState<TikTokShopProduct[]>([]);
  const [busy, setBusy] = React.useState("");

  const load = React.useCallback(async () => {
    const next = await tiktokShopApi.status();
    setStatus(next);
    if (next.connected) setProducts((await tiktokShopApi.products()).items);
    else setProducts([]);
  }, []);

  React.useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void load().catch((error) => toast.error(getApiErrorMessage(error, "Không thể tải trạng thái TikTok Shop.")));
    }, 0);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "TIKTOK_SHOP_CONNECTED") {
        toast.success("Đã kết nối TikTok Shop.");
        void load();
      }
      if (event.data?.type === "TIKTOK_SHOP_FAILED") toast.error(event.data?.error || "Không thể kết nối TikTok Shop.");
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("message", onMessage);
    };
  }, [load]);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try { await action(); } catch (error) { toast.error(getApiErrorMessage(error, "Không thể xử lý yêu cầu TikTok Shop.")); } finally { setBusy(""); }
  };

  const connect = () => run("connect", async () => {
    const { authUrl } = await tiktokShopApi.authorizationUrl();
    const popup = window.open(authUrl, "tiktok-shop-oauth", "popup=yes,width=760,height=780");
    if (!popup) throw new Error("Trình duyệt đã chặn cửa sổ kết nối. Hãy cho phép popup rồi thử lại.");
  });

  const sync = () => run("sync", async () => {
    const result = await tiktokShopApi.syncProducts();
    const summary = `Đã đồng bộ ${result.total} sản phẩm; ghép được ${result.matched} sản phẩm với SKU nội bộ. Chi tiết: đủ ${result.complete}, thiếu ${result.incomplete}, lỗi tải ${result.detailFailed}.`;
    if (result.detailFailed || result.incomplete) toast.error(summary);
    else toast.success(summary);
    await load();
  });

  const pushInventoryAndPrices = () => run("push", async () => {
    const result = await tiktokShopApi.syncInventoryAndPrices();
    if (result.failed) toast.error(`Đã cập nhật ${result.updated} SKU; ${result.failed} SKU lỗi. Xem chi tiết trong danh sách.`);
    else toast.success(`Đã đẩy giá và tồn kho của ${result.updated} SKU lên TikTok Shop.`);
    await load();
  });

  const importProducts = () => run("import", async () => {
    const result = await tiktokShopApi.importProducts();
    const summary = `Đã tạo ${result.createdProducts} sản phẩm, ${result.createdVariants} SKU và nhập ${result.importedStock} đơn vị tồn kho.`;
    if (result.failed) toast.error(`${summary} Có ${result.failed} sản phẩm lỗi. ${result.errors[0] || ""}`.trim());
    else toast.success(summary);
    await load();
  });

  const disconnect = (connectionId: string) => run(`disconnect:${connectionId}`, async () => {
    if (!window.confirm("Ngắt tài khoản seller này và xóa danh mục kênh đã đồng bộ? Sản phẩm nội bộ không bị xóa.")) return;
    await tiktokShopApi.disconnect(connectionId);
    toast.success("Đã ngắt kết nối TikTok Shop.");
    await load();
  });

  const editProduct = (product: TikTokShopProduct) => {
    const localProductId = product.skus.find((sku) => sku.localProductId)?.localProductId;
    if (!localProductId) {
      toast.error("Sản phẩm chưa được liên kết với kho. Hãy bấm “Nhập vào kho” trước.");
      return;
    }
    window.history.pushState(null, "", `/kho-san-pham?sub=san-pham&editProduct=${encodeURIComponent(localProductId)}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (!status) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800"><ShoppingBag className="h-5 w-5" />TikTok Shop</h2>
          <p className="mt-1 text-xs text-slate-500">Đồng bộ cả danh sách và chi tiết sản phẩm TikTok; kiểm tra mô tả, danh mục, ảnh, giá, tồn kho và ghép SKU nội bộ.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {status.connected ? "Đã kết nối" : "Chưa kết nối"}
        </span>
      </div>

      {!status.connected ? (
        <button type="button" disabled={Boolean(busy)} onClick={connect} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
          {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Kết nối TikTok Shop
        </button>
      ) : (
        <>
          <div className="space-y-3">
            {status.connections.map((connection, index) => <div key={connection.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-sm font-bold text-slate-800">Tài khoản seller {index + 1}</p><p className="mt-0.5 text-[10px] text-slate-400">Seller ID: {connection.openId}</p></div>
                <button type="button" disabled={Boolean(busy)} onClick={() => disconnect(connection.id)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  {busy === `disconnect:${connection.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Ngắt
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">{connection.shops.map((shop) => <div key={shop.cipher} className="rounded-md bg-slate-50 p-2"><p className="text-xs font-semibold text-slate-800">{shop.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{shop.code || shop.id || "Shop đã ủy quyền"}{shop.region ? ` · ${shop.region}` : ""}</p></div>)}</div>
              {connection.sync?.error ? <p className="mt-2 text-xs text-rose-600">{connection.sync.error}</p> : null}
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={Boolean(busy)} onClick={connect} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Thêm tài khoản seller
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={sync} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Đồng bộ sản phẩm
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={importProducts} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">
              {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Nhập vào kho
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={pushInventoryAndPrices} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy === "push" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Đẩy giá & tồn kho
            </button>
          </div>
          <p className="text-[11px] text-slate-500">“Nhập vào kho” tạo các sản phẩm/SKU còn thiếu trong kho mặc định của chi nhánh hiện tại. SKU đã tồn tại chỉ được liên kết, không ghi đè tồn kho. Sau đó giá và tồn khả dụng sẽ tự động đẩy lên TikTok.</p>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Đã kết nối <strong>{status.connections.length} tài khoản seller</strong> và <strong>{status.shops.length} shop</strong>.</div>
        </>
      )}

      {products.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Sản phẩm TikTok</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Trạng thái ghép</th><th className="px-3 py-2">Kiểm tra thông tin</th><th className="px-3 py-2">Đẩy dữ liệu</th><th className="px-3 py-2 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{products.map((product) => <tr key={product._id}><td className="px-3 py-2"><p className="font-semibold text-slate-800">{product.title}</p><p className="text-[10px] text-slate-400">{product.tiktokProductId} · {product.status}</p></td><td className="px-3 py-2 text-slate-600">{product.skus.map((sku) => sku.sellerSku || sku.skuId).filter(Boolean).join(", ") || "—"}</td><td className="px-3 py-2"><span className={product.skus.some((sku) => sku.localVariantId) ? "text-emerald-700" : "text-amber-700"}>{product.skus.some((sku) => sku.localVariantId) ? "Đã ghép SKU nội bộ" : "Chưa ghép"}</span></td><td className="max-w-xs px-3 py-2"><span className={product.detailsSyncStatus === "complete" ? "text-emerald-700" : product.detailsSyncStatus === "failed" ? "text-rose-700" : "text-amber-700"}>{product.detailsSyncStatus === "complete" ? "Đủ thông tin" : product.detailsSyncStatus === "failed" ? `Lỗi tải: ${product.detailsSyncError || "không tải được chi tiết"}` : product.missingInfo?.length ? `Thiếu: ${product.missingInfo.join(", ")}` : "Chưa kiểm tra chi tiết"}</span></td><td className="max-w-xs px-3 py-2"><span className={product.lastOutboundSyncStatus === "failed" ? "text-rose-700" : product.lastOutboundSyncStatus === "success" ? "text-emerald-700" : "text-slate-500"}>{product.lastOutboundSyncStatus === "failed" ? product.lastOutboundSyncError || "Lỗi" : product.lastOutboundSyncStatus === "success" ? "Đã đồng bộ" : "Chưa đồng bộ"}</span></td><td className="px-3 py-2 text-right"><button type="button" onClick={() => editProduct(product)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Sửa sản phẩm</button></td></tr>)}</tbody></table></div>}
    </section>
  );
}
