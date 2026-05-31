/**
 * Tier-Definitionen — Source of Truth für Pricing + Limits.
 *
 * Free hat keinen Stripe-Eintrag und ist der Default für jeden neuen
 * Workspace. Die übrigen Tiers werden in Stripe als Products + Prices
 * mit den hier definierten `lookup_key`s angelegt (siehe
 * scripts/stripe-setup.mjs).
 *
 * `maxObjects` = inklusive Obergrenze. Bei `maxObjects: null` keine
 * Begrenzung (Portfolio-Tier).
 */

export type TierKey =
  | "free"
  | "imm_starter_year"
  | "imm_pro_year"
  | "imm_portfolio_year";

export interface Tier {
  key: TierKey;
  /** Stripe lookup_key — bei Free `null` (kein Stripe-Eintrag). */
  lookupKey: string | null;
  /** UI-Label (deutsch). */
  name: string;
  /** Inkl. Obergrenze Objekte. `null` = unbegrenzt. */
  maxObjects: number | null;
  /** Mindestanzahl Objekte, ab der dieser Tier nötig wird. */
  minObjects: number;
  /** Preis in EUR pro Jahr. */
  priceEurYear: number;
}

export const TIERS: readonly Tier[] = [
  {
    key: "free",
    lookupKey: null,
    name: "Free",
    minObjects: 0,
    maxObjects: 1,
    priceEurYear: 0,
  },
  {
    key: "imm_starter_year",
    lookupKey: "imm_starter_year",
    name: "Starter",
    minObjects: 2,
    maxObjects: 9,
    priceEurYear: 39,
  },
  {
    key: "imm_pro_year",
    lookupKey: "imm_pro_year",
    name: "Pro",
    minObjects: 10,
    maxObjects: 24,
    priceEurYear: 119,
  },
  {
    key: "imm_portfolio_year",
    lookupKey: "imm_portfolio_year",
    name: "Portfolio",
    minObjects: 25,
    maxObjects: null,
    priceEurYear: 199,
  },
] as const;

export const FREE_TIER: Tier = TIERS[0];

export function tierByLookupKey(lookupKey: string | null | undefined): Tier {
  if (!lookupKey) return FREE_TIER;
  return TIERS.find((t) => t.lookupKey === lookupKey) ?? FREE_TIER;
}

export function tierByKey(key: TierKey): Tier {
  return TIERS.find((t) => t.key === key) ?? FREE_TIER;
}

/**
 * Welcher Tier wird für die gegebene Objekt-Anzahl benötigt?
 * Gibt den kleinsten Tier zurück, dessen Limit die Anzahl noch deckt.
 */
export function requiredTierForCount(count: number): Tier {
  for (const t of TIERS) {
    if (t.maxObjects === null || count <= t.maxObjects) return t;
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Darf der Workspace bei aktuellem Tier ein weiteres Objekt anlegen?
 */
export function canCreateProperty(
  currentTier: Tier,
  currentCount: number
): boolean {
  if (currentTier.maxObjects === null) return true;
  return currentCount < currentTier.maxObjects;
}

/**
 * Welche Subscription-Status sind als "zahlend / privilegiert" zu werten?
 * past_due lassen wir bewusst noch durchgehen (Grace Period — Stripe
 * versucht typischerweise mehrfach abzubuchen, bevor unpaid).
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);
