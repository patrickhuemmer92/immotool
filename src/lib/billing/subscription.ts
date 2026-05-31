/**
 * Server-side Helpers für Subscription-Status + Tier-Lookup.
 *
 * Wir lesen aus der DB-Tabelle `subscriptions` (= Cache des Stripe-State,
 * gepflegt durch den Webhook). Damit ist der Tier-Check ein einziger
 * Supabase-Read — keine Stripe-API-Roundtrips beim Page-Render.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  FREE_TIER,
  tierByLookupKey,
  type Tier,
} from "./tiers";

export interface WorkspaceBillingState {
  /** Effektiver Tier (Free, falls keine aktive Subscription). */
  tier: Tier;
  /** Anzahl Objekte im Workspace. */
  propertyCount: number;
  /** Stripe-Customer-ID, falls bereits angelegt — sonst null. */
  stripeCustomerId: string | null;
  /** Stripe-Subscription-ID, falls aktiv — sonst null. */
  stripeSubscriptionId: string | null;
  /** Roher Stripe-Status. */
  status: string | null;
  /** Hat User aktive (= zahlende) Subscription? */
  hasActiveSubscription: boolean;
  /** Ende der aktuellen Periode (für UI). */
  currentPeriodEnd: string | null;
  /** Subscription endet am Periodenende (Kündigung gesetzt)? */
  cancelAtPeriodEnd: boolean;
}

export async function getWorkspaceBilling(
  workspaceId: string
): Promise<WorkspaceBillingState> {
  const supabase = await createClient();

  const [{ data: sub }, { count: propertyCount }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "stripe_customer_id, stripe_subscription_id, tier_lookup_key, status, current_period_end, cancel_at_period_end"
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
  ]);

  const status: string | null = sub?.status ?? null;
  const hasActive = status ? ACTIVE_SUBSCRIPTION_STATUSES.has(status) : false;
  const tier = hasActive
    ? tierByLookupKey(sub?.tier_lookup_key)
    : FREE_TIER;

  return {
    tier,
    propertyCount: propertyCount ?? 0,
    stripeCustomerId: sub?.stripe_customer_id ?? null,
    stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    status,
    hasActiveSubscription: hasActive,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
  };
}
