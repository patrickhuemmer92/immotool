/**
 * POST /api/connect/accounts/onboarding-link
 *
 * Erstellt einen V2 AccountLink für hosted KYC-Onboarding.
 * Workspace muss bereits einen Connect-Account haben.
 *
 * Response: { url } — Client redirected zum Stripe-Onboarding.
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
    return NextResponse.json(
      { error: "no_account", hint: "Lege zuerst per POST /api/connect/accounts/create einen Account an." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const base = getBaseUrl(req);

  // V2 AccountLinks — derselbe Cast-Pattern wie in lib/connect/account.ts
  // (Type-Paket markiert V2 Endpoints noch nicht vollständig).
  const link = (await (stripe as unknown as {
    v2: {
      core: {
        accountLinks: {
          create: (
            params: Record<string, unknown>
          ) => Promise<{ url: string; expires_at: number }>;
        };
      };
    };
  }).v2.core.accountLinks.create({
    account: connect.stripeAccountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant", "customer"],
        refresh_url: `${base}/connect?refresh=true`,
        return_url: `${base}/connect?accountId=${connect.stripeAccountId}`,
      },
    },
  })) as { url: string; expires_at: number };

  return NextResponse.json({ url: link.url, expires_at: link.expires_at });
}
