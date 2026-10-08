import { initialRetailCart, type RetailCartState } from "../hooks/retailCart";
import type { RetailOrder } from "../types";

export function readPosCart(key: string): { cart: RetailCartState; draft: RetailOrder | null; error?: string } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { cart: initialRetailCart, draft: null };
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.cart?.lines) || value.cart.lines.some((line: any) => !line.product?._id || !Number.isSafeInteger(line.quantity) || line.quantity <= 0)) throw new Error("Invalid saved cart");
    return { cart: { ...initialRetailCart, ...value.cart, quote: null, quoteDirty: value.cart.lines.length > 0 }, draft: value.draft || null };
  } catch {
    // Keep the original record for recovery; never turn it into a confirmed sale.
    return { cart: initialRetailCart, draft: null, error: "Không đọc được giỏ đã lưu. Bản lưu gốc đang được giữ để phục hồi." };
  }
}

export function savePosCart(key: string, cart: RetailCartState, draft: RetailOrder | null) {
  if (!cart.lines.length) { localStorage.removeItem(key); return; }
  localStorage.setItem(key, JSON.stringify({ version: 1, cart: { ...cart, quote: null, quoteDirty: true }, draft }));
}
