/**
 * POST /api/connect/accounts/create
 *
 * Legt einen V2-Connected-Account für den aktiven Workspace an.
 *
 * Nur Workspace-Owner darf diese Route aufrufen. Wenn schon ein
 * Connect-Account existiert, gibt die Route die existierende
 * stripe_account_id zurück (idempotent — verhindert Mehrfach-Erstellung).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import {
  createWorkspaceConnectAccount,
  getWorkspaceConnectAccount,
} from "@/lib/connect/account";

const bodySchema = z.object({
  display_name: z.string().trim().min(1).max(200),
  contact_email: z.string().trim().email(),
});

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "no_workspace" }, { status: 401 });
  if (!isOwner(active.role)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }
  // Stripe Connect ist Admin-only (ADMIN_EMAILS-Whitelist).
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }

  // Idempotenz: wenn schon ein Account existiert, einfach zurückgeben.
  const existing = await getWorkspaceConnectAccount(active.id);
  if (existing) {
    return NextResponse.json({
      account_id: existing.stripeAccountId,
      already_existed: true,
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  try {
    const accountId = await createWorkspaceConnectAccount({
      workspaceId: active.id,
      displayName: parsed.data.display_name,
      contactEmail: parsed.data.contact_email,
    });
    return NextResponse.json({ account_id: accountId, already_existed: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[connect:accounts/create]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
