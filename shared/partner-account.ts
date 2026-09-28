export type AccountProfile = {
  accountType?: "internal" | "partner";
  role?: string;
  permissions?: readonly string[];
};

/** Recognize older portal accounts that were created before accountType existed. */
export function isPartnerAccount(profile?: AccountProfile | null): boolean {
  if (!profile) return false;
  if (profile.accountType === "partner") return true;
  if (profile.role === "admin" || profile.role === "superadmin") return false;
  const permissions = new Set(profile.permissions || []);
  return (permissions.has("partner-self:read") || permissions.has("partner-self:manage"))
    && !["*", "partner:read", "partner:manage"].some(permission => permissions.has(permission));
}

export function internalAccounts<T extends AccountProfile>(profiles: T[]): T[] {
  return profiles.filter(profile => !isPartnerAccount(profile));
}
