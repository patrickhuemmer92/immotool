/**
 * POST /api/account/delete
 *
 * Löscht den eingeloggten User-Account inkl. aller verknüpften Daten.
 *
 * Cascade-Delete-Pfad (Migration 0001 hat ON DELETE CASCADE überall):
 *   auth.users
 *     → workspaces (via owner_user_id)
 *         → properties → tenants, loans, pnl_snapshots, valuations,
 *           portfolio_valuations, property_images, investment_plans,
 *           portfolio_properties, simulations
 *         → owners, owner_members, property_owners
 *         → subscriptions
 *         → settings
 *         → connect_accounts
 *         → portfolios
 *     → workspace_members (via user_id)
 *
 * Wichtige Einschränkungen:
 *   - User muss seine eigene E-Mail-Adresse zur Bestätigung im Body
 *     mitsenden (Schutz vor versehentlichem Klick).
 *   - SUPABASE_SERVICE_ROLE_KEY ist Pflicht — auth.admin-Operationen
 *     gehen nicht mit dem anon-Key.
 *
 * DSGVO Art. 17 (Recht auf Löschung).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  confirm_email: z.string().trim().email(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // Defense in depth: User muss seine eigene E-Mail nochmal eintippen.
  const userEmail = (user.email ?? "").trim().toLowerCase();
  const confirmEmail = parsed.data.confirm_email.trim().toLowerCase();
  if (!userEmail || confirmEmail !== userEmail) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }

  // Service-Role-Client für admin.deleteUser. Pflicht: env-Variable.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    console.error(
      "[account:delete] SUPABASE_SERVICE_ROLE_KEY oder NEXT_PUBLIC_SUPABASE_URL fehlt"
    );
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // auth.admin.deleteUser löscht den User komplett. Cascade-Deletes in
  // unserem Schema räumen den Rest auf (workspaces, properties, etc.).
  const { error } = await admin.auth.admin.deleteUser(user.id, true);
  if (error) {
    console.error("[account:delete] auth.admin.deleteUser failed:", error);
    return NextResponse.json(
      { error: "delete_failed", details: error.message },
      { status: 500 }
    );
  }

  // Server-Session auf diesem Client clearen — der User ist eh weg.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
