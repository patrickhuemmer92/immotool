/**
 * POST /api/billing/checkout
 *
 * Erstellt eine Stripe Checkout Session für die Workspace-Subscription
 * (Modell D: ein einziger Tiered-Price + quantity = Anzahl Objekte).
 *
 * Stripe rechnet anhand der Quantity automatisch die richtige Tier-Stufe
 * aus (1 → 0 €, 2-5 → 39,99 € etc.) — wir müssen nichts mitsteuern als
 * die gewünschte Quantity.
 *
 * Body: { quantity: number }  — wie viele Objekte will der User abdecken?
 * Response: { url: string }   — Client redirected zum Stripe-Checkout
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { getStripe } from "@/lib/billing/stripe";

const bodySchema = z.object({
  quantity: z.number().int().min(2).max(999),
});

function getBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

/** Wirft mit klarer Message, wenn STRIPE_TIERED_PRICE_ID fehlt. */
function getTieredPriceId(): string {
  const id = process.env.STRIPE_TIERED_PRICE_ID;
  if (!id) {
    throw new Error(
      "STRIPE_TIERED_PRICE_ID ist nicht gesetzt. Lege im Stripe-Dashboard " +
        "ein Produkt mit Tiered-Pricing an (1=0€, 2-5=39,99€, …) und " +
        "trage die Price-ID (Format: price_...) in .env.local ein."
    );
  }
  return id;
}

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
  const quantity = parsed.data.quantity;

  let priceId: string;
  try {
    priceId = getTieredPriceId();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "no_price";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const stripe = getStripe();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData.user?.email;

  // Bestehender Customer? Wenn ja, wiederverwenden, damit Karte/Tax-IDs
  // erhalten bleiben.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("workspace_id", active.id)
    .maybeSingle();

  const base = getBaseUrl(req);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity }],
    subscription_data: {
      metadata: {
        workspace_id: active.id,
        subscribed_quantity: String(quantity),
      },
    },
    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : userEmail
        ? { customer_email: userEmail }
        : {}),
    client_reference_id: active.id,
    metadata: {
      workspace_id: active.id,
      subscribed_quantity: String(quantity),
    },
    success_url: `${base}/einstellungen/abrechnung?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/einstellungen/abrechnung?status=cancelled`,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    // Kleinunternehmer (§19 UStG): keine USt., keine Tax-ID-Collection.
    automatic_tax: { enabled: false },
    tax_id_collection: { enabled: false },
    locale: "de",
  });

  if (!session.url) {
    return NextResponse.json({ error: "no_session_url" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
