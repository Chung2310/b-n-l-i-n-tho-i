export type RetailTabSlug = "ban-hang" | "don-hang" | "doi-tra" | "hoa-don" | "bao-cao" | "cai-dat" | "ma-uu-dai";

const OPERATIONAL_TABS: RetailTabSlug[] = ["ban-hang", "don-hang", "doi-tra", "hoa-don", "bao-cao"];
// These tabs have no data-changing workflow; the other retail tabs require retail:manage.
const READ_SAFE_TABS: RetailTabSlug[] = ["doi-tra", "hoa-don", "bao-cao"];

export function getAllowedRetailTabSlugs(permissions: readonly string[] = []): RetailTabSlug[] {
  const granted = new Set(permissions);
  if (granted.has("*") || granted.has("retail:manage")) return [...OPERATIONAL_TABS, "ma-uu-dai", "cai-dat"];
  if (granted.has("retail:read")) return READ_SAFE_TABS;
  return [];
}
