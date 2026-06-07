/**
 * POST /api/billing/cancel
 *
 * § 312k BGB Kündigungs-Funktion. Nimmt die Erklärung des Verbrauchers
 * entgegen, schreibt sie ins Audit-Log (cancellations) und kündigt die
 * zugehörige Stripe-Subscription.
 *
 * Body: {
 *   workspace_id: string,
 *   kind: "ordentlich" | "fristlos",
 *   requested_date: string | null,
 *   reason: string | null
 * }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { getStripe } from "@/lib/billing/stripe";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  kind: z.enum(["ordentlich", "fristlos"]),
  requested_date: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  }
  if (!isOwner(active.role)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // Workspace muss zur Session passen (Defensive Cross-Check).
  if (parsed.data.workspace_id !== active.id) {
    return NextResponse.json({ error: "workspace_mismatch" }, { status: 403 });
  }

  // Bei fristloser Kündigung ist die Begründung Pflicht.
  if (parsed.data.kind === "fristlos" && !parsed.data.reason?.trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Aktive Subscription holen.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("workspace_id", active.id)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "no_active_subscription" },
      { status: 404 }
    );
  }

  // Stripe kündigen — primärer Schritt. Wenn der scheitert, brechen wir
  // ab. Audit-Eintrag schreiben wir trotzdem (mit stripe_cancel_result =
  // "stripe_error"), damit die Erklärung dokumentiert ist.
  let stripeResult: string | null = null;
  let stripeCancelAt: number | null = null;
  let stripeStatus: string | null = null;
  let stripeError: string | null = null;

  const stripe = getStripe();
  try {
    if (parsed.data.kind === "fristlos") {
      // Sofortige Kündigung → Subscription wird auf "canceled" gesetzt,
      // current_period_end ist der Stichtag des Wegfalls aller Leistungen.
      const result = await stripe.subscriptions.cancel(
        sub.stripe_subscription_id
      );
      stripeResult = result.status;
      stripeStatus = result.status;
      stripeCancelAt = result.canceled_at ?? Math.floor(Date.now() / 1000);
    } else {
      // Ordentliche Kündigung → cancel_at_period_end=true. Subscription
      // läuft bis zum Periodenende weiter, dann automatisch gecancelt.
      const result = await stripe.subscriptions.update(
        sub.stripe_subscription_id,
        { cancel_at_period_end: true }
      );
      stripeResult = `${result.status}+cancel_at_period_end`;
      stripeStatus = result.status;
      // cancel_at sollte nach update({cancel_at_period_end: true})
      // gesetzt sein; falls nicht, fallback auf items[0].current_period_end
      // (Stripe-API-Migration: top-level current_period_end ist deprecated).
      const itemEnd = result.items?.data?.[0]?.current_period_end ?? null;
      stripeCancelAt = result.cancel_at ?? itemEnd;
    }
  } catch (err) {
    console.error("[billing:cancel] stripe error:", err);
    stripeResult = "stripe_error";
    stripeError = err instanceof Error ? err.message : "unknown_stripe_error";
  }

  // Subscriptions-Tabelle synchron updaten — der Webhook würde es auch
  // tun, aber für sofortiges UI-Feedback (z. B. Premium-Gate auf
  // existierenden Sessions) ist das wichtig.
  if (!stripeError && stripeStatus) {
    await supabase
      .from("subscriptions")
      .update({
        status: stripeStatus,
        cancel_at_period_end: parsed.data.kind !== "fristlos",
        canceled_at: stripeCancelAt
          ? new Date(stripeCancelAt * 1000).toISOString()
          : null,
      })
      .eq("workspace_id", active.id);
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const { error: logError } = await supabase.from("cancellations").insert({
    workspace_id: active.id,
    user_id: userId,
    kind: parsed.data.kind,
    requested_date: parsed.data.requested_date ?? null,
    reason: parsed.data.reason ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
    stripe_subscription_id: sub?.stripe_subscription_id ?? null,
    stripe_cancel_result: stripeResult,
  });

  if (logError) {
    console.error("[billing:cancel] log insert failed:", logError);
    // Auch hier: Stripe ist evtl. schon gekündigt — wir geben dennoch
    // einen Fehler zurück, weil der Audit-Trail unvollständig ist.
    return NextResponse.json(
      { error: "log_failed", details: logError.message },
      { status: 500 }
    );
  }

  // Wenn Stripe ablehnt, gib das an den Client weiter — UI zeigt dann
  // den konkreten Fehler statt einer falschen Erfolgsmeldung.
  if (stripeError) {
    return NextResponse.json(
      { error: "stripe_failed", details: stripeError },
      { status: 502 }
    );
  }

  // TODO: Bestätigungs-Mail über Custom-SMTP versenden, sobald
  // eingerichtet (Resend etc.). Stripe sendet bereits seine Standard-
  // Mail zur Kündigungsbestätigung — die ist aber § 312k Abs. 3 BGB
  // nicht 1:1 entsprechend (Eingangszeit + Wortlaut der Erklärung).

  return NextResponse.json({
    ok: true,
    kind: parsed.data.kind,
    effective_at: stripeCancelAt
      ? new Date(stripeCancelAt * 1000).toISOString()
      : null,
    stripe_status: stripeStatus,
  });
}
