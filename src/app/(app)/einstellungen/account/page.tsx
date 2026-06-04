import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AccountClient } from "./account-client";

/**
 * Account-Bereich in den Settings — bündelt DSGVO-relevante Funktionen:
 *   - Daten-Export (Art. 15 / Art. 20 DSGVO)
 *   - Account-Löschung (Art. 17 DSGVO)
 *
 * Beide Aktionen betreffen den eingeloggten User direkt (nicht den
 * aktiven Workspace).
 */
export default async function AccountPage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  return (
    <AccountClient
      userEmail={user.email ?? ""}
      userId={user.id}
      createdAt={user.created_at ?? null}
    />
  );
}
