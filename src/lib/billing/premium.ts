/**
 * Premium-Status pro Workspace — Modell D.
 *
 * Geschäftsregel:
 *   - 1 Objekt          → kostenlos, ALLE Features verfügbar
 *   - 2+ Objekte + Abo  → Premium aktiv (sofern subscribed_quantity ≥ propertyCount)
 *   - 2+ Objekte ohne Abo → "Free continue"-Modus: Premium-Features gelockt,
 *                          aber User kann beliebig viele Objekte anlegen
 *
 * Premium-Features (gelockt im Free-continue-Modus):
 *   - Factbook (PDF-Export)
 *   - Portfolios (Gruppierung)
 *   - Cashflow-Rechner
 *   - Simulation
 *
 * Quelle: src/lib/billing/premium.ts ist die EINZIGE Stelle, an der diese
 * Server-Regel implementiert ist. Konstanten und Helper sind in
 * src/lib/billing/pricing.ts (Client-safe).
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FREE_TIER_LIMIT } from "./pricing";

// Re-exporte, damit Server-Code nur aus diesem Modul importieren muss.
export {
  PRICING_TIERS,
  tierForQuantity,
  FREE_TIER_LIMIT,
  type PricingTier,
} from "./pricing";

/** Subscription-Status, die als "aktiv" zählen (zahlend + kurze Grace). */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type PremiumStatus = {
  /** Anzahl Objekte im Workspace. */
  propertyCount: number;
  /** subscribed_quantity aus DB (=Quantity, die der User in Stripe gebucht hat). */
  subscribedQuantity: number;
  /** Stripe-Subscription-Status (active/trialing/past_due/null). */
  subscriptionStatus: string | null;
  /** Stripe-Customer-ID falls vorhanden — für Portal-Sessions. */
  stripeCustomerId: string | null;
  /** Stripe-Subscription-ID falls vorhanden — für Quantity-Updates. */
  stripeSubscriptionId: string | null;
  /** Stripe trial_end timestamp falls vorhanden. */
  stripeTrialEnd: string | null;
  /** 7-Tage-Workspace-Setup-Trial (workspaces.trial_ends_at). NULL = legacy
   *  Workspace ohne Trial-Wert; ansonsten ISO timestamp wann der Trial endet. */
  signupTrialEndsAt: string | null;
  /** Convenience: true wenn signupTrialEndsAt in der Zukunft liegt. */
  inSignupTrial: boolean;
  /**
   * KERN-FLAG: Hat dieser Workspace Premium-Features verfügbar?
   * true wenn (propertyCount ≤ 1) ODER (active subscription + subscribed_quantity ≥ propertyCount)
   */
  isPremium: boolean;
  /**
   * Hilfsflag für UI: Hat der User aktuell ein zahlendes Abo?
   * Unterscheidet sich von isPremium: "1 Objekt ohne Abo" → isPremium=true, hasPaidSubscription=false.
   */
  hasPaidSubscription: boolean;
  /**
   * Wäre Quantity-Upgrade nötig, um isPremium zu erreichen? Nur relevant,
   * wenn hasPaidSubscription=true und subscribed_quantity < propertyCount.
   */
  needsQuantityUpgrade: boolean;
  /** Minimum nötige Quantity, damit isPremium=true gilt. */
  requiredQuantity: number;
};

export async function getPremiumStatus(
  workspaceId: string
): Promise<PremiumStatus> {
  const supabase = await createClient();
  const [{ count: propertyCount }, { data: sub }, { data: ws }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase
        .from("subscriptions")
        .select(
          "stripe_customer_id, stripe_subscription_id, status, subscribed_quantity, trial_end"
        )
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("workspaces")
        .select("trial_ends_at")
        .eq("id", workspaceId)
        .maybeSingle(),
    ]);

  const count = propertyCount ?? 0;
  const subStatus = sub?.status ?? null;
  const subQty = sub?.subscribed_quantity ?? 0;
  const hasPaidSubscription = subStatus
    ? ACTIVE_STATUSES.has(subStatus) && subQty >= 2
    : false;

  const signupTrialEndsAt = ws?.trial_ends_at ?? null;
  const inSignupTrial =
    signupTrialEndsAt != null &&
    new Date(signupTrialEndsAt).getTime() > Date.now();

  const requiredQuantity = Math.max(1, count);

  const isPremiumByFree = count <= FREE_TIER_LIMIT;
  const isPremiumByPaid =
    !!subStatus && ACTIVE_STATUSES.has(subStatus) && subQty >= count;

  // Während des Workspace-Trials hat der User volle Premium-Features —
  // auch über das Free-Limit hinaus. Nach Ablauf greifen die normalen
  // Regeln (1 Objekt frei, ab 2 wird Abo benötigt).
  const isPremium = isPremiumByFree || isPremiumByPaid || inSignupTrial;

  const needsQuantityUpgrade =
    !!subStatus && ACTIVE_STATUSES.has(subStatus) && subQty < count;

  return {
    propertyCount: count,
    subscribedQuantity: subQty,
    subscriptionStatus: subStatus,
    stripeCustomerId: sub?.stripe_customer_id ?? null,
    stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    stripeTrialEnd: sub?.trial_end ?? null,
    signupTrialEndsAt,
    inSignupTrial,
    isPremium,
    hasPaidSubscription,
    needsQuantityUpgrade,
    requiredQuantity,
  };
}
