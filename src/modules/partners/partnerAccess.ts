import type { UserProfile } from "../../types";

/**
 * Partner accounts are deliberately provisioned with only the self-view
 * permission. Keeping this check in one place lets routing and navigation use
 * the same boundary as the partner page.
 */
export function isPartnerPortalProfile(profile?: Pick<UserProfile, "role" | "permissions"> | null) {
  if (!profile || profile.role === "admin" || profile.role === "superadmin") return false;
  const permissions = new Set(profile.permissions || []);
  if (permissions.has("*")) return false;
  const selfOnly = permissions.has("partner-self:read") || permissions.has("partner-self:manage");
  const management = permissions.has("partner:read") || permissions.has("partner:manage");
  return selfOnly && !management;
}

