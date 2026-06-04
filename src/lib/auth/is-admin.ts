/**
 * Admin-Whitelist auf E-Mail-Basis.
 *
 * Die Liste der Admin-Adressen wird aus der ENV-Variable ADMIN_EMAILS
 * gelesen (comma-separated). Wenn nicht gesetzt → niemand ist Admin
 * (sicher per default).
 *
 * Beispiel .env.local:
 *   ADMIN_EMAILS=patrick.huemmer@gmx.net,backup-admin@example.com
 *
 * Diese Funktion ist BEWUSST simpel — keine Rolle in der DB, keine
 * Multi-Tenant-Logik. Sie schützt experimentelle / interne Features,
 * die nicht für alle User sichtbar sein sollen (z. B. Stripe Connect).
 *
 * Für richtige Rollen/Permissions im Multi-Tenant-Kontext nutzen wir
 * weiterhin workspace_members.role.
 */

import { createClient } from "@/lib/supabase/server";

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/** Ist die angegebene E-Mail in der Admin-Whitelist? */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Liest den aktuell eingeloggten User aus Supabase und prüft, ob seine
 * E-Mail in der Admin-Whitelist steht. Server-only — verwendet Supabase
 * Server-Client (Cookie-basierter Auth-Context).
 *
 * Returns false, wenn kein User eingeloggt oder ADMIN_EMAILS leer ist.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return isAdminEmail(data.user?.email ?? null);
}
