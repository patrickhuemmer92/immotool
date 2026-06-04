/**
 * POST /api/connect/products/create
 *
 * Erstellt ein V1-Product auf dem Connected Account. Der Stripe-Account
 * Header (`stripeAccount`) sorgt dafür, dass das Produkt im Stripe-
 * Workspace des Connected Accounts angelegt wird, nicht im Plattform-
 * Workspace.
 *
 * Body: { name, description?, price_eur, currency? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import { getStripe } from "@/lib/connect/stripe";
import { getWorkspaceConnectAccount } from "@/lib/connect/account";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  price_eur: z
    .number()
    .or(z.string().transform((v) => Number(v.replace(",", "."))))
    .refine((n) => Number.isFinite(n) && n > 0, "invalid_price"),
  currency: z.string().length(3).optional().default("eur"),
});

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  if (!canEdit(active.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }

  const connect = await getWorkspaceConnectAccount(active.id);
  if (!connect) {
    return NextResponse.json({ error: "no_account" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_body", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  // Preis in kleinster Währungseinheit (Cents). 12.50 EUR → 1250.
  const priceInCents = Math.round(parsed.data.price_eur * 100);

  // V1-Endpoint. Der zweite Parameter (`stripeAccount`) ist die JS-SDK-
  // Variante des Stripe-Account-Headers — das Produkt landet im Stripe-
  // Workspace des Connected Accounts.
  const product = await stripe.products.create(
    {
      name: parsed.data.name,
      description: parsed.data.description ?? undefined,
      default_price_data: {
        unit_amount: priceInCents,
        currency: parsed.data.currency,
      },
    },
    {
      stripeAccount: connect.stripeAccountId,
    }
  );

  return NextResponse.json({
    product_id: product.id,
    default_price: product.default_price,
  });
}
