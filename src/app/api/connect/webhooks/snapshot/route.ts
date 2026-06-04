/**
 * POST /api/connect/webhooks/snapshot
 *
 * Empfängt klassische Snapshot-Events vom Plattform-Workspace —
 * insbesondere Subscription-Lifecycle-Events für die Plattform-
 * Subscription des Connected Accounts.
 *
 * Im Stripe-Dashboard zu abonnieren:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.paid
 *   - invoice.payment_failed
 *   - payment_method.attached / detached
 *   - customer.updated
 *   - customer.tax_id.created / updated / deleted
 *
 * Webhook-Secret: STRIPE_WEBHOOK_SECRET_CONNECT_SNAPSHOT.
 * Im Dev:
 *   stripe listen --forward-to localhost:3000/api/connect/webhooks/snapshot
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/connect/stripe";

export const runtime = "nodejs";

function tsFromUnix(unix: number | null | undefined): string | null {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

/** Supabase-Client für Service-Writes — fällt auf anon + RPC zurück. */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt");
  if (!serviceKey) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) throw new Error("Supabase keys fehlen");
    return createServiceClient(url, anonKey);
  }
  return createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function syncPlatformSubscription(subscription: Stripe.Subscription) {
  // Bei V2-Connected-Accounts liefert Stripe `customer_account` statt
  // `customer` (Account-ID statt Customer-ID). Wir kennen die Konvention
  // aus den V2-Docs — fallback auf die alte customer-ID, falls vorhanden.
  const subWithAccount = subscription as Stripe.Subscription & {
    customer_account?: string | null;
  };
  const stripeAccountId =
    subWithAccount.customer_account ??
    (typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id);

  if (!stripeAccountId?.startsWith("acct_")) {
    // Nicht unsere Connect-Subscription — wahrscheinlich Workspace-Tier
    // (siehe /api/billing/webhook). Hier ignorieren.
    return;
  }

  const supabase = getSupabaseAdmin();
  const sub = subscription as Stripe.Subscription & {
    current_period_end?: number;
  };
  const { error } = await supabase.rpc(
    "update_connect_platform_subscription",
    {
      p_stripe_account_id: stripeAccountId,
      p_subscription_id: subscription.id,
      p_status: subscription.status,
      p_current_period_end: tsFromUnix(sub.current_period_end),
    }
  );
  if (error) {
    console.error(
      "[connect:webhooks/snapshot] update_connect_platform_subscription Fehler:",
      error
    );
  }
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET_CONNECT_SNAPSHOT;
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
    console.error("[connect:webhooks/snapshot] Signatur ungültig:", msg);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // -------- Subscription lifecycle --------
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncPlatformSubscription(subscription);
        // Checkliste (siehe Brief):
        //   - .updated: Upgrade/Downgrade/Pause/Reactivate behandeln
        //   - .deleted: Kündigung — Plattform-Zugang ggf. revoken
        // TODO: Bei aktiver Subscription → erweiterte Features im
        //       Workspace freischalten (DB-Flag setzen).
        break;
      }

      // -------- Invoice --------
      case "invoice.paid":
      case "invoice.payment_failed": {
        // TODO: Bei .paid → User informieren ("Rechnung beglichen").
        //       Bei .payment_failed → User-Warnung + ggf. Workspace-
        //       Downgrade nach X Failed-Attempts.
        const invoice = event.data.object as Stripe.Invoice;
        const customerAccount = (invoice as Stripe.Invoice & {
          customer_account?: string | null;
        }).customer_account;
        console.log(
          `[connect:webhooks/snapshot] ${event.type} for ${customerAccount ?? invoice.customer}`
        );
        break;
      }

      // -------- Payment-Method / Customer changes --------
      case "payment_method.attached":
      case "payment_method.detached":
      case "customer.updated":
      case "customer.tax_id.created":
      case "customer.tax_id.updated":
      case "customer.tax_id.deleted":
      case "billing_portal.configuration.created":
      case "billing_portal.configuration.updated":
      case "billing_portal.session.created":
        // Informativ — keine zwingenden DB-Updates. Loggen für Debug.
        console.log(`[connect:webhooks/snapshot] info-event: ${event.type}`);
        break;

      default:
        // Andere Events ignorieren — nur die in der Liste abonnieren.
        break;
    }
  } catch (err) {
    console.error("[connect:webhooks/snapshot] Handler-Fehler:", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
