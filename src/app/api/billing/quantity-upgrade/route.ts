/**
 * POST /api/billing/quantity-upgrade
 *
 * Aktualisiert die Quantity der bestehenden Workspace-Subscription auf
 * einen neuen Wert (typischerweise: aktuelle Objekt-Anzahl). Stripe
 * regelt die Proration automatisch (= sofortige Anpassung des aktuellen
 * Periodenbetrags).
 *
 * Wird vom Property-Create-Flow aufgerufen, wenn der User beim Anlegen
 * eines neuen Objekts die gebuchte Quantity überschreitet — der UI-Dialog
 * zeigt dem User den (von Stripe berechneten) Aufpreis an, er bestätigt,
 * dann ruft die UI diese Route.
 *
 * Body: { quantity: number }
 * Response: { ok: true, subscribed_quantity: N }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";

const bodySchema = z.object({
  quantity: z.number().int().min(1).max(999),
});

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  if (!isOwner(active.role)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const newQuantity = parsed.data.quantity;

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("workspace_id", active.id)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "no_subscription", hint: "Lege zuerst per /api/billing/checkout eine Subscription an." },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  // Aktuelles Item finden (Tiered-Subscriptions haben i. d. R. genau ein Item).
  const subscription = await stripe.subscriptions.retrieve(
    sub.stripe_subscription_id
  );
  const item = subscription.items.data[0];
  if (!item) {
    return NextResponse.json(
      { error: "no_subscription_item" },
      { status: 500 }
    );
  }

  // Quantity-Update mit Proration → Stripe verlangt sofort die Differenz.
  // `proration_behavior: "always_invoice"` → Stripe stellt einen Invoice
  // sofort an, der die Differenz abbucht (ohne nächste Periode abzuwarten).
  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [
      {
        id: item.id,
        quantity: newQuantity,
      },
    ],
    proration_behavior: "always_invoice",
  });

  // DB-Cache aktualisieren — Webhook tut das auch, aber wir wollen die UI
  // sofort konsistent haben.
  await supabase.rpc("upsert_subscription", {
    p_workspace_id: active.id,
    p_stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: item.price.id,
    p_tier_lookup_key: item.price.lookup_key ?? null,
    p_status: subscription.status,
    p_current_period_start: null,
    p_current_period_end: null,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_canceled_at: null,
    p_trial_end: null,
    p_subscribed_quantity: newQuantity,
  });

  return NextResponse.json({ ok: true, subscribed_quantity: newQuantity });
}
