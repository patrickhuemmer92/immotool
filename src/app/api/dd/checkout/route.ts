/**
 * POST /api/dd/checkout
 * Body: { dd_project_id }
 *
 * Erstellt eine Stripe Checkout Session für den One-Off-Kauf einer
 * DD-Analyse (29 €). Nutzt STRIPE_DD_PRICE_ID (One-Time-Price, keine
 * Subscription). Der Webhook markiert `dd_projects.paid = true` nach
 * erfolgreicher Zahlung.
 *
 * Response: { url: string } → Client redirected zu Stripe.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { getStripe } from "@/lib/billing/stripe";

const bodySchema = z.object({
  dd_project_id: z.string().uuid(),
});

function getBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function getDdPriceId(): string {
  const id = process.env.STRIPE_DD_PRICE_ID;
  if (!id) {
    throw new Error(
      "STRIPE_DD_PRICE_ID nicht gesetzt. Lege im Stripe-Dashboard ein " +
        'Produkt "DD-Analyse" mit One-Time-Preis 29 € an und trage die ' +
        "Price-ID (Format: price_...) in .env.local ein."
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
    .from("dd_projects")
    .select("id, name, paid")
    .eq("id", parsed.data.dd_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }
  if (project.paid) {
    return NextResponse.json({ error: "already_paid" }, { status: 400 });
  }

  let priceId: string;
  try {
    priceId = getDdPriceId();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "no_price" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const base = getBaseUrl(req);

  const session = await stripe.checkout.sessions.create({
    mode: "payment", // One-off, keine Subscription
    line_items: [{ price: priceId, quantity: 1 }],
    // Success-Return: zurück zur Detail-Seite. Der Webhook macht das
    // "paid"-Flip; die Erfolgsseite pollt einfach oder zeigt „läuft noch".
    success_url: `${base}/analyse/${project.id}?paid=1`,
    cancel_url: `${base}/analyse/${project.id}?checkout_cancelled=1`,
    // Metadata: brauchen wir im Webhook, um das Projekt zu identifizieren
    metadata: {
      dd_project_id: project.id,
      workspace_id: active.id,
    },
    // Für spätere Refunds / Support: Referenz zurück ins UI
    client_reference_id: project.id,
    payment_intent_data: {
      metadata: {
        dd_project_id: project.id,
        workspace_id: active.id,
        product: "dd_analysis_one_off",
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
