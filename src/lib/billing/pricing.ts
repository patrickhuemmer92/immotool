/**
 * Client-safe Pricing-Konstanten und Helper.
 *
 * Mirror der Stripe-Tiered-Price-Stufen (price_1TebkVCV9IFgKxCiOJEDPCYm).
 * Bei Änderung im Stripe-Dashboard bitte hier mit-pflegen — die ECHTE
 * Berechnung passiert immer in Stripe, das hier ist nur für UI-Anzeige.
 *
 * Diese Datei ist BEWUSST nicht "server-only", damit Client-Komponenten
 * (z. B. der Quantity-Slider in der Billing-UI) die Stufen rendern können.
 * Server-Premium-Logik liegt weiter in src/lib/billing/premium.ts.
 */

export type PricingTier = {
  minQty: number;
  maxQty: number | null;
  yearlyEur: number;
  label: string;
};

export const PRICING_TIERS: readonly PricingTier[] = [
  { minQty: 1, maxQty: 1, yearlyEur: 0, label: "Free" },
  { minQty: 2, maxQty: 5, yearlyEur: 39.99, label: "Starter" },
  { minQty: 6, maxQty: 10, yearlyEur: 49.99, label: "Plus" },
  { minQty: 11, maxQty: 25, yearlyEur: 99.99, label: "Pro" },
  { minQty: 26, maxQty: null, yearlyEur: 149.99, label: "Portfolio" },
] as const;

export function tierForQuantity(quantity: number): PricingTier {
  for (const t of PRICING_TIERS) {
    if (
      quantity >= t.minQty &&
      (t.maxQty == null || quantity <= t.maxQty)
    ) {
      return t;
    }
  }
  return PRICING_TIERS[PRICING_TIERS.length - 1];
}

/** Free-Tier-Schwelle — bis zu so vielen Objekten ist alles frei. */
export const FREE_TIER_LIMIT = 1;
