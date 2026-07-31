/**
 * Admin-Whitelist für Test-Bypass der DD- und Onboarding-Paywalls.
 *
 * Setup: eine kommagetrennte Liste von E-Mails in der ENV
 *   DD_ADMIN_EMAILS="patrick@example.com,test@internal.de"
 *
 * User mit diesen Adressen bekommen in der UI einen zusätzlichen
 * „Test-Freischaltung"-Button, der die Paywall ohne Stripe-Zahlung
 * umgeht. Server-Actions verifizieren die Berechtigung dabei
 * selbst — der Button ist NICHT die einzige Prüfung.
 *
 * ENV-Vergleich ist case-insensitive und getrimmt (übliche Copy-Paste-
 * Fehler bei Emails werden toleriert).
 */

/** Case-insensitive Prüfung ob eine E-Mail im Test-Bypass gelistet ist. */
export function isDdAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.DD_ADMIN_EMAILS;
  if (!raw) return false;
  const target = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
