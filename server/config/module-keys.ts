/** Các nghiệp vụ còn được bật/tắt theo doanh nghiệp. */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "customer", "retail", "repair", "finance", "marketing"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const DEFAULT_MODULE_KEYS = MODULE_KEYS.filter((key) => key !== "retail" && key !== "finance" && key !== "marketing") as Exclude<ModuleKey, "retail" | "finance" | "marketing">[];
export function isModuleKey(v: string): v is ModuleKey { return (MODULE_KEYS as readonly string[]).includes(v); }
export function sanitizeModuleKeys(input: unknown): ModuleKey[] {
  if (!Array.isArray(input)) return [...DEFAULT_MODULE_KEYS];
  const cleaned = [...new Set(input.filter((v): v is ModuleKey => typeof v === "string" && isModuleKey(v)))];
  return cleaned.length === 0 ? [...DEFAULT_MODULE_KEYS] : cleaned;
}