/**
 * Subscription tier helpers.
 * Free tier is the default. Pro is unlocked manually (simulated upgrade for now).
 * The 15-day rule: after 15 days on Free, we surface a Pro upsell alert.
 */
export const TRIAL_DAYS = 15;

export type SubscriptionTier = "free" | "pro";

export interface ProfileWithTier {
  subscription_tier: SubscriptionTier;
  pro_since: string | null;
  created_at: string;
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function shouldShowProUpsell(p: ProfileWithTier | null | undefined) {
  if (!p) return false;
  if (p.subscription_tier === "pro") return false;
  return daysSince(p.created_at) >= TRIAL_DAYS;
}

/** Friendly label for tier badge. */
export function tierLabel(t: SubscriptionTier) {
  return t === "pro" ? "Pro" : "Free";
}

export const PRO_FEATURES = [
  "Promoted placement — appear first on dashboards",
  "Marketplace ads for your products",
  "Verified Pro badge for trust",
  "Priority booking notifications",
  "Advanced analytics on your activity",
  "Unlimited bookings & product listings",
];

export const FREE_FEATURES = [
  "Account creation & profile",
  "Browse experts, stores, products",
  "Up to 5 active bookings",
  "Basic listings (no promotion)",
  "Standard support",
];
