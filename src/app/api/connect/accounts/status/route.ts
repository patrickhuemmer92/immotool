/**
 * GET /api/connect/accounts/status
 *
 * Liefert den Live-Onboarding-Status vom Stripe-Endpoint. Wird auf der
 * /connect-Page sowohl beim ersten Render als auch nach Rückkehr vom
 * Onboarding-Link (per ?accountId=...) aufgerufen.
 *
 * KEIN DB-Cache — Status ist hier immer aus der Stripe-API direkt.
 */

import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import {
  getAccountStatus,
  getWorkspaceConnectAccount,
} from "@/lib/connect/account";

export async function GET() {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }

  const connect = await getWorkspaceConnectAccount(active.id);
  if (!connect) {
    return NextResponse.json({ status: "no_account" });
  }

  try {
    const status = await getAccountStatus(connect.stripeAccountId);
    return NextResponse.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[connect:accounts/status]", msg);
    return NextResponse.json(
      { error: msg, account_id: connect.stripeAccountId },
      { status: 500 }
    );
  }
}
