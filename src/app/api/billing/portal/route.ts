/**
 * POST /api/billing/portal
 *
 * Erstellt eine Stripe Customer Portal Session. Im Portal kann der User:
 *   - Rechnungen + Zahlungshistorie ansehen
 *   - Zahlungsmethode aktualisieren
 *   - Plan wechseln (zwischen Starter / Pro / Portfolio)
 *   - Abo kündigen
 *
 * Wir bauen nichts davon selbst — Stripe hostet das komplett.
 *
 * Response: { url: string }  → Client redirected
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { getStripe } from "@/lib/billing/stripe";

function getBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  if (!isOwner(active.role)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("workspace_id", active.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_customer", hint: "Workspace hat noch keine Subscription." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${getBaseUrl(req)}/einstellungen/abrechnung`,
    locale: "de",
  });

  return NextResponse.json({ url: session.url });
}
