/**
 * POST /api/billing/checkout
 *
 * Erstellt eine Stripe Checkout Session für einen Workspace-Owner.
 * Stripe übernimmt den kompletten Zahlungs-Flow — wir geben den User nur
 * an Stripe weiter und warten auf das Webhook-Event.
 *
 * Body: { lookupKey: "imm_starter_year" | "imm_pro_year" | "imm_portfolio_year" }
 * Response: { url: string }  → Client redirected
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { getStripe } from "@/lib/billing/stripe";
import { TIERS } from "@/lib/billing/tiers";

const bodySchema = z.object({
  lookupKey: z.string().min(1),
});

function getBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  // Fallback: aus dem Request rekonstruieren
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
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
  const lookupKey = parsed.data.lookupKey;

  const tier = TIERS.find((t) => t.lookupKey === lookupKey);
  if (!tier || !tier.lookupKey) {
    return NextResponse.json({ error: "unknown_tier" }, { status: 400 });
  }

  const stripe = getStripe();

  // Price-ID via lookup_key auflösen
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    return NextResponse.json(
      {
        error: "price_not_configured",
        hint: "Führe scripts/stripe-setup.mjs aus, um die Prices in Stripe anzulegen.",
      },
      { status: 500 }
    );
  }

  // User-E-Mail für Stripe — wenn vorhanden, vorausfüllen
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData.user?.email;

  // Existierender Customer? Wenn ja, dem Checkout mitgeben.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("workspace_id", active.id)
    .maybeSingle();

  const base = getBaseUrl(req);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    // Wir hängen die Workspace-ID an die Subscription, damit der Webhook
    // die DB-Zeile zuordnen kann.
    subscription_data: {
      metadata: {
        workspace_id: active.id,
        tier_lookup_key: lookupKey,
      },
    },
    // Falls schon Stripe-Customer existiert, wiederverwenden — sonst
    // Email vorausfüllen und Stripe legt automatisch einen Customer an.
    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : userEmail
        ? { customer_email: userEmail }
        : {}),
    // Auch auf der Session-Ebene hinterlegen — für das
    // checkout.session.completed-Event.
    client_reference_id: active.id,
    metadata: {
      workspace_id: active.id,
      tier_lookup_key: lookupKey,
    },
    success_url: `${base}/einstellungen/abrechnung?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/einstellungen/abrechnung?status=cancelled`,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    // Kleinunternehmer (§19 UStG): keine USt. ausweisen, kein Tax-ID-
    // Collection. Falls du die KU-Grenze überschreitest, hier auf true
    // umschalten + Stripe Tax im Dashboard aktivieren.
    automatic_tax: { enabled: false },
    tax_id_collection: { enabled: false },
    locale: "de",
  });

  if (!session.url) {
    return NextResponse.json({ error: "no_session_url" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
