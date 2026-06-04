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
  const previousQuantity = item.quantity ?? 0;
  const updatedSub = await stripe.subscriptions.update(
    sub.stripe_subscription_id,
    {
      items: [
        {
          id: item.id,
          quantity: newQuantity,
        },
      ],
      proration_behavior: "always_invoice",
    }
  );

  // Letzte Invoice holen — der proration-Effekt steht in invoice.total
  // (positiv = Belastung, negativ = Gutschrift / Credit für Restzeit).
  // amount_paid zeigt, was tatsächlich von der Karte eingezogen wurde
  // (Credit landet als account_balance, wird nicht direkt ausgezahlt).
  let prorationTotalCents = 0;
  let amountPaidCents = 0;
  let currency = "eur";
  if (updatedSub.latest_invoice) {
    const invoiceId =
      typeof updatedSub.latest_invoice === "string"
        ? updatedSub.latest_invoice
        : updatedSub.latest_invoice.id;
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      prorationTotalCents = invoice.total ?? 0;
      amountPaidCents = invoice.amount_paid ?? 0;
      currency = invoice.currency ?? "eur";
    } catch (err) {
      console.warn(
        "[quantity-upgrade] konnte Invoice nicht laden:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // DB-Cache aktualisieren — Webhook tut das auch, aber wir wollen die UI
  // sofort konsistent haben.
  await supabase.rpc("upsert_subscription", {
    p_workspace_id: active.id,
    p_stripe_customer_id:
      typeof updatedSub.customer === "string"
        ? updatedSub.customer
        : updatedSub.customer.id,
    p_stripe_subscription_id: updatedSub.id,
    p_stripe_price_id: item.price.id,
    p_tier_lookup_key: item.price.lookup_key ?? null,
    p_status: updatedSub.status,
    p_current_period_start: null,
    p_current_period_end: null,
    p_cancel_at_period_end: updatedSub.cancel_at_period_end,
    p_canceled_at: null,
    p_trial_end: null,
    p_subscribed_quantity: newQuantity,
  });

  return NextResponse.json({
    ok: true,
    subscribed_quantity: newQuantity,
    previous_quantity: previousQuantity,
    /** Total der Proration-Invoice in Cent. Positiv = Belastung,
     *  negativ = Gutschrift (Credit für Restperiode). */
    proration_total_cents: prorationTotalCents,
    /** Tatsächlich von der Karte eingezogener Betrag. Bei Downgrade
     *  in der Regel 0 (Credit landet im Account-Balance). */
    amount_paid_cents: amountPaidCents,
    currency,
  });
}
