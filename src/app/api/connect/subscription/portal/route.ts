/**
 * POST /api/connect/subscription/portal
 *
 * Erzeugt eine Stripe Billing Portal Session für den Connected Account —
 * dort kann der Workspace-Owner sein Plattform-Abonnement verwalten
 * (Rechnungen, Zahlungsmethode, Kündigung).
 *
 * Verwendet `customer_account` (V2-Variante) statt `customer`, weil
 * der Subscription-Customer ein V2-Connected-Account ist.
 */

import { NextResponse } from "next/server";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { getStripe, getBaseUrl } from "@/lib/connect/stripe";
import { getWorkspaceConnectAccount } from "@/lib/connect/account";

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  if (!isOwner(active.role)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const connect = await getWorkspaceConnectAccount(active.id);
  if (!connect) {
    return NextResponse.json({ error: "no_account" }, { status: 400 });
  }

  const stripe = getStripe();
  const base = getBaseUrl(req);

  // customer_account fehlt noch im offiziellen Type — Cast nötig.
  const params = {
    customer_account: connect.stripeAccountId,
    return_url: `${base}/connect`,
    locale: "de",
  } as unknown as Parameters<typeof stripe.billingPortal.sessions.create>[0];

  const session = await stripe.billingPortal.sessions.create(params);
  return NextResponse.json({ url: session.url });
}
