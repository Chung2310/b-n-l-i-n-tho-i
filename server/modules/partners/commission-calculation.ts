export type CommissionRule = { kind: "phone" | "accessory"; sku?: string; category?: string; amount?: number; rateBps?: number };
export type CommissionPolicy = { phoneAmount: number; accessoryBps: number; repairBps: number; rules: CommissionRule[] };
export type CommissionLine = { line: number; label: string; kind: "phone" | "accessory" | "repair"; quantity: number; base: number; amount: number; rate: number };
export const defaultPolicy: CommissionPolicy = { phoneAmount: 200000, accessoryBps: 1000, repairBps: 1000, rules: [] };
export const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status, statusCode: status });
export function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw invalid("Giá trị số không hợp lệ.");
  return Number(value);
}
export function validatePolicy(input: any): CommissionPolicy {
  if (!input || typeof input !== "object") throw invalid("Thiếu cấu hình chính sách.");
  if (!Array.isArray(input.rules) || input.rules.length > 500) throw invalid("Danh sách quy tắc không hợp lệ.");
  const seen = new Set<string>();
  const rules = input.rules.map((r: any) => {
    if (!["phone", "accessory"].includes(r.kind)) throw invalid("Loại hoa hồng không hợp lệ.");
    const sku = String(r.sku || "").trim(), category = String(r.category || "").trim();
    if ((!sku && !category) || (sku && category)) throw invalid("Mỗi quy tắc chọn SKU hoặc nhóm hàng.");
    const key = sku ? `sku:${sku}` : `category:${category}`;
    if (seen.has(key)) throw invalid("Quy tắc SKU/nhóm bị trùng."); seen.add(key);
    return { kind: r.kind, ...(sku ? { sku } : { category }), ...(r.kind === "phone" ? { amount: integer(r.amount ?? input.phoneAmount, 150000, 300000) } : { rateBps: integer(r.rateBps ?? input.accessoryBps, 1000, 1500) }) };
  });
  return { phoneAmount: integer(input.phoneAmount, 150000, 300000), accessoryBps: integer(input.accessoryBps, 1000, 1500), repairBps: integer(input.repairBps, 1000, 1500), rules };
}
/** Allocate the order discount with a deterministic largest-remainder method. */
export function allocateBases(items: Array<{ lineTotal: number }>, discount: number) {
  const total = items.reduce((s, i) => s + integer(i.lineTotal, 0), 0);
  integer(discount, 0, total);
  if (!total) return items.map(() => 0);
  const net = total - discount;
  const values = items.map((i, index) => ({ index, value: Math.floor(i.lineTotal * net / total), fraction: (i.lineTotal * net) % total }));
  let remainder = net - values.reduce((s, i) => s + i.value, 0);
  for (const row of [...values].sort((a, b) => b.fraction - a.fraction || a.index - b.index)) if (remainder-- > 0) row.value++;
  return values.map(i => i.value);
}
export function retailLines(order: any, policy: CommissionPolicy): CommissionLine[] {
  const bases = allocateBases(order.items, Number(order.orderDiscount || 0));
  return order.items.map((item: any, line: number) => {
    const rule = policy.rules.find(r => r.sku === item.sku) || policy.rules.find(r => r.category && r.category === item.category);
    if (!rule) throw invalid(`Chưa cấu hình hoa hồng cho SKU ${item.sku}.`);
    const quantity = integer(item.quantity, 1);
    const rate = rule.kind === "phone" ? rule.amount! : rule.rateBps!;
    return { line, label: String(item.productName), kind: rule.kind, quantity, base: bases[line], rate, amount: rule.kind === "phone" ? quantity * rate : Math.round(bases[line] * rate / 10000) };
  });
}
export function repairLines(ticket: any, policy: CommissionPolicy): CommissionLine[] {
  const labor = integer(Number(ticket.laborFee || 0), 0);
  const gross = labor + integer(Number(ticket.partRevenue || 0), 0);
  const total = integer(Number(ticket.totalAmount || 0), 0);
  const base = gross ? Math.round(labor * Math.min(gross, total) / gross) : 0;
  return [{ line: 0, label: "Tiền công sửa chữa sau giảm giá", kind: "repair", quantity: 1, base, rate: policy.repairBps, amount: Math.round(base * policy.repairBps / 10000) }];
}
export function remainingLine(line: CommissionLine, returnedQuantity: number, refundedBase = 0) {
  const quantity = Math.max(0, line.quantity - returnedQuantity);
  const base = Math.max(0, Math.round(line.base * quantity / line.quantity) - refundedBase);
  const amount = line.kind === "phone" ? Math.round(line.amount * quantity / line.quantity * (line.base && quantity ? base / (line.base * quantity / line.quantity) : 1)) : Math.round(base * line.rate / 10000);
  return { amount: Math.min(line.amount, Math.max(0, amount)), machines: line.kind === "phone" ? quantity : 0 };
}
export function monthKey(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date(date));
}
export function kpiBonus(machines: number) { return machines >= 20 ? 2500000 : machines >= 10 ? 1000000 : 0; }
