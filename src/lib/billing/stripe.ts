/**
 * Stripe-Client (server-only). Lazy initialized — wirft erst beim ersten
 * Aufruf, wenn STRIPE_SECRET_KEY fehlt.
 *
 * Sandbox vs. Live: Wird allein über STRIPE_SECRET_KEY gesteuert
 * (sk_test_... vs. sk_live_...). Webhook-Secret ist pro Endpoint anders
 * und liegt in STRIPE_WEBHOOK_SECRET.
 */

import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Server-Keys, die Stripe akzeptiert: normale Secret-Keys (sk_) und
 * Restricted Keys (rk_). Alles andere — z. B. ein Publishable Key (pk_),
 * eine Object-ID oder ein Key aus einem anderen Dienst — führt sonst erst
 * beim ersten API-Call zu einem 401 `StripeAuthenticationError`, weit weg
 * von der eigentlichen Ursache.
 */
const VALID_KEY_PREFIXES = ["sk_", "rk_"] as const;

/** Key für Log-/Fehlerausgaben kürzen — nie das ganze Secret loggen. */
function maskKey(key: string): string {
  const head = key.slice(0, 8);
  const tail = key.length > 12 ? key.slice(-4) : "";
  return tail ? `${head}…${tail}` : `${head}…`;
}

export function getStripe(): Stripe {
  if (cached) return cached;
  const raw = process.env.STRIPE_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "STRIPE_SECRET_KEY ist nicht gesetzt. Trage sk_test_... in .env.local ein."
    );
  }
  // Copy/Paste aus dem Dashboard schleppt gern Whitespace oder Quotes mit —
  // Stripe schickt dafür ebenfalls ein 401 zurück.
  const key = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!VALID_KEY_PREFIXES.some((p) => key.startsWith(p))) {
    throw new Error(
      `STRIPE_SECRET_KEY hat kein gültiges Stripe-Key-Prefix (Wert: ${maskKey(key)}). ` +
        "Erwartet wird ein Secret Key (sk_test_... / sk_live_...) oder ein " +
        "Restricted Key (rk_test_... / rk_live_...) aus Stripe → Developers → " +
        "API keys. Publishable Keys (pk_...), Object-IDs (price_..., sub_...) " +
        "und Keys anderer Dienste funktionieren nicht."
    );
  }
  cached = new Stripe(key, {
    // Pin a stable API version — Stripe deprecated old versions over time,
    // aber unsere Implementierung soll deterministisch bleiben.
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });
  return cached;
}

/**
 * Heuristik: Erkennt anhand des Key-Prefixes, ob wir im Test- oder Live-
 * Modus sind. Nur zur UI-Anzeige — wir verlassen uns nicht darauf für
 * Security-Entscheidungen.
 */
export function stripeMode(): "test" | "live" | "unknown" {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  // sk_ und rk_ (Restricted Key) tragen beide den Modus im zweiten Segment.
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return "unknown";
}
