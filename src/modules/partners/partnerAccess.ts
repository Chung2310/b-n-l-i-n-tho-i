import { isPartnerAccount, type AccountProfile } from "../../../shared/partner-account";

/**
 * Partner accounts are deliberately provisioned with only the self-view
 * permission. Keeping this check in one place lets routing and navigation use
 * the same boundary as the partner page.
 */
export function isPartnerPortalProfile(profile?: AccountProfile | null) {
  return isPartnerAccount(profile);
}

