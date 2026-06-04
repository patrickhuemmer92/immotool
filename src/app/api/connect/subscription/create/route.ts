/**
 * POST /api/connect/subscription/create
 *
 * Erzeugt eine Checkout-Session, in der der Connected Account selbst
 * (nicht ein Endkunde) ein Plattform-Abonnement bucht — z. B. ein
 * "Premium-Listing"-Plan. Der Trick: bei V2-Connected-Accounts kann
 * dieselbe Account-ID sowohl als Merchant als auch als Customer
 * fungieren — `customer_account` statt `customer`.
 *
 * Body: leer (Owner ist authentifiziert, Workspace ist aktiv).
 */

import { NextResponse } from "next/server";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import {
  getStripe,
  getBaseUrl,
  getPlatformSubscriptionPriceId,
} from "@/lib/connect/stripe";
import { getWorkspaceConnectAccount } from "@/lib/connect/account";

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  if (!isOwner(active.role)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }

  const connect = await getWorkspaceConnectAccount(active.id);
  if (!connect) {
    return NextResponse.json({ error: "no_account" }, { status: 400 });
  }

  let priceId: string;
  try {
    priceId = getPlatformSubscriptionPriceId();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "no_price";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const stripe = getStripe();
  const base = getBaseUrl(req);

  // customer_account ist die V2-Variante von customer. Wir bezahlen
  // die Subscription über den Plattform-Workspace (KEIN stripeAccount-
  // Header), aber der Connected Account ist der Subscriber.
  // Cast nötig, weil customer_account im JS-SDK-Type noch fehlt.
  const params = {
    customer_account: connect.stripeAccountId,
    mode: "subscription" as const,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/connect?status=subscribed&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/connect?status=subscription_cancelled`,
  } as unknown as Parameters<typeof stripe.checkout.sessions.create>[0];

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    return NextResponse.json({ error: "no_session_url" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
