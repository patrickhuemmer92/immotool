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

  // Stripe kündigen (cancel_at_period_end bei ordentlich, sofort bei fristlos).
  let stripeResult: string | null = null;
  if (sub?.stripe_subscription_id) {
    const stripe = getStripe();
    try {
      if (parsed.data.kind === "fristlos") {
        const result = await stripe.subscriptions.cancel(
          sub.stripe_subscription_id
        );
        stripeResult = result.status;
      } else {
        const result = await stripe.subscriptions.update(
          sub.stripe_subscription_id,
          { cancel_at_period_end: true }
        );
        stripeResult = `${result.status}+cancel_at_period_end`;
      }
    } catch (err) {
      console.error("[billing:cancel] stripe error:", err);
      // Wir loggen die Kündigungserklärung trotzdem — der Verbraucher
      // hat seine Erklärung abgegeben, der Anbieter muss sie verarbeiten.
      stripeResult = "stripe_error";
    }
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

  // TODO: Bestätigungs-Mail über Custom-SMTP versenden, sobald
  // eingerichtet (Resend etc.). Aktuell muss das manuell + via
  // Stripe-Standard-Mails abgewickelt werden.

  return NextResponse.json({ ok: true });
}
