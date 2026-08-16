/**
 * POST /api/onboarding/checkout
 * Body: { onboarding_project_id }
 *
 * Stripe One-Off (29 €) für KI-Onboarding. Gilt für bis zu 20 Objekten
 * oder ein Mehrfamilienhaus mit bis zu 20 Wohneinheiten — wir enforcen
 * das erst beim Confirm, nicht beim Checkout. Der Nutzer sieht das im
 * Paywall-Text.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { getStripe } from "@/lib/billing/stripe";

const bodySchema = z.object({
  onboarding_project_id: z.string().uuid(),
});

function getBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function getOnboardingPriceId(): string {
  const id = process.env.STRIPE_ONBOARDING_PRICE_ID;
  if (!id) {
    throw new Error(
      "STRIPE_ONBOARDING_PRICE_ID nicht gesetzt. Lege im Stripe-Dashboard " +
        'ein Produkt "KI-Onboarding" mit One-Time-Preis 29 € an.'
    );
  }
  return id;
}

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active)
    return NextResponse.json({ error: "no_workspace" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("id, name, paid, premium_unlock")
    .eq("id", parsed.data.onboarding_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project)
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  if (project.paid || project.premium_unlock) {
    return NextResponse.json({ error: "already_unlocked" }, { status: 400 });
  }

  let priceId: string;
  try {
    priceId = getOnboardingPriceId();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "no_price" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const base = getBaseUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/onboarding/${project.id}?paid=1`,
    cancel_url: `${base}/onboarding/${project.id}?checkout_cancelled=1`,
    metadata: {
      onboarding_project_id: project.id,
      workspace_id: active.id,
    },
    client_reference_id: project.id,
    payment_intent_data: {
      metadata: {
        onboarding_project_id: project.id,
        workspace_id: active.id,
        product: "ki_onboarding_one_off",
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
