/**
 * POST /api/connect/checkout/create
 *
 * Direct-Charge-Checkout: Der Endkunde des Connected Accounts kauft ein
 * Produkt, Geld fließt auf das Connected-Account-Guthaben, die Plattform
 * behält die `application_fee_amount` ein.
 *
 * Body: { account_id, product_id, quantity? }
 *
 * NB: Diese Route wird von der Storefront (`/connect/storefront/[id]`)
 * aufgerufen — sie ist NICHT auf einen authentifizierten Workspace-User
 * angewiesen, sondern wirkt im Namen des Endkunden. Validierung des
 * Connected Accounts erfolgt anhand der Stripe-API.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, getBaseUrl } from "@/lib/connect/stripe";

const bodySchema = z.object({
  account_id: z.string().min(1),
  product_id: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
});

// Plattform-Gebühr in Prozent vom Verkaufspreis. Wenn STRIPE_PLATFORM_FEE_BPS
// gesetzt ist (Basispunkte, 100 = 1 %), wird der Wert verwendet, sonst 2 %.
const DEFAULT_FEE_BPS = 200;

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const stripe = getStripe();

  // Produkt + Default-Preis vom Connected Account abrufen — wir lesen
  // direkt von Stripe, damit der Endkunde die UI nicht manipulieren kann.
  const product = await stripe.products.retrieve(
    parsed.data.product_id,
    { expand: ["default_price"] },
    { stripeAccount: parsed.data.account_id }
  );

  const defaultPrice = product.default_price;
  if (!defaultPrice || typeof defaultPrice === "string") {
    return NextResponse.json(
      { error: "no_default_price" },
      { status: 400 }
    );
  }
  const unitAmount = defaultPrice.unit_amount;
  const currency = defaultPrice.currency;
  if (unitAmount == null) {
    return NextResponse.json({ error: "price_missing_unit_amount" }, { status: 400 });
  }

  const feeBps = Number(process.env.STRIPE_PLATFORM_FEE_BPS ?? DEFAULT_FEE_BPS);
  const applicationFeeAmount = Math.max(
    1,
    Math.round((unitAmount * parsed.data.quantity * feeBps) / 10000)
  );

  const base = getBaseUrl(req);

  // Direct-Charge: stripeAccount-Header sorgt dafür, dass der Charge
  // auf dem Connected Account entsteht. application_fee_amount holt die
  // Plattform-Gebühr automatisch zurück auf die Plattform.
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: product.name },
            unit_amount: unitAmount,
          },
          quantity: parsed.data.quantity,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
      },
      success_url: `${base}/connect/storefront/${parsed.data.account_id}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/connect/storefront/${parsed.data.account_id}?status=cancelled`,
    },
    {
      stripeAccount: parsed.data.account_id,
    }
  );

  if (!session.url) {
    return NextResponse.json({ error: "no_session_url" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
