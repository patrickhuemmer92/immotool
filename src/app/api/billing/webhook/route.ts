/**
 * POST /api/billing/webhook
 *
 * Stripe-Webhook-Endpoint. Validiert die Signatur und spiegelt
 * Subscription-Änderungen in die DB-Tabelle `subscriptions`.
 *
 * In Stripe Dashboard zu abonnieren:
 *   - checkout.session.completed
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *
 * Webhook-Secret kommt aus STRIPE_WEBHOOK_SECRET (whsec_...).
 * Im Dev via `stripe listen --forward-to localhost:3000/api/billing/webhook`.
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/billing/stripe";
import { tierByLookupKey } from "@/lib/billing/tiers";

export const runtime = "nodejs"; // Webhook braucht Raw-Body (kein Edge)

/**
 * Supabase-Service-Client (umgeht RLS). Webhook hat keinen User-Kontext,
 * daher brauchen wir den Service-Role-Key. Falls nicht gesetzt, fallen
 * wir auf die security-definer-RPC `upsert_subscription` zurück, die
 * auch mit anon-Key funktioniert.
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt");
  if (!serviceKey) {
    // Fallback: anon-Key + RPC (security definer).
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) throw new Error("Supabase keys fehlen");
    return createServiceClient(url, anonKey);
  }
  return createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function tsFromUnix(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  workspaceIdFallback?: string | null
) {
  const supabase = getSupabaseAdmin();

  // Workspace-ID aus Metadata oder Fallback aus checkout-session
  const workspaceId =
    (subscription.metadata?.workspace_id as string | undefined) ??
    workspaceIdFallback ??
    null;

  if (!workspaceId) {
    // Letzte Chance: Per Customer-ID nachschauen (Subscription-Update für
    // existierenden Customer, z. B. via Customer Portal Plan-Wechsel).
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const { data } = await supabase
      .rpc("workspace_id_for_customer", { p_customer_id: customerId });
    const found = (data as string | null) ?? null;
    if (!found) {
      console.error(
        "[stripe-webhook] Kann Workspace nicht bestimmen — Subscription:",
        subscription.id,
        "Customer:",
        customerId
      );
      return;
    }
    return syncSubscriptionForWorkspace(found, subscription);
  }

  return syncSubscriptionForWorkspace(workspaceId, subscription);
}

async function syncSubscriptionForWorkspace(
  workspaceId: string,
  subscription: Stripe.Subscription
) {
  const supabase = getSupabaseAdmin();

  const item = subscription.items.data[0];
  const price = item?.price;
  const lookupKey = price?.lookup_key ?? null;
  const tier = tierByLookupKey(lookupKey);

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Cast: Stripe-Types markieren some optional fields as undefined je nach
  // API-Version — `current_period_start/end` sind aber bei Subscriptions
  // immer vorhanden.
  const sub = subscription as Stripe.Subscription & {
    current_period_start: number;
    current_period_end: number;
  };

  const { error } = await supabase.rpc("upsert_subscription", {
    p_workspace_id: workspaceId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: price?.id ?? null,
    p_tier_lookup_key: tier.lookupKey,
    p_status: subscription.status,
    p_current_period_start: tsFromUnix(sub.current_period_start),
    p_current_period_end: tsFromUnix(sub.current_period_end),
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_canceled_at: tsFromUnix(subscription.canceled_at),
    p_trial_end: tsFromUnix(subscription.trial_end),
  });

  if (error) {
    console.error(
      "[stripe-webhook] upsert_subscription RPC fehlgeschlagen:",
      error
    );
  }
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "no_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[stripe-webhook] Signatur ungültig:", msg);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        const wsId =
          (session.metadata?.workspace_id as string | undefined) ??
          (session.client_reference_id as string | null) ??
          null;
        await syncSubscription(subscription, wsId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      default:
        // Andere Events ignorieren — wir abonnieren nur die obigen.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] Handler-Fehler:", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
