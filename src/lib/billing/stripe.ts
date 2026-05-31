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

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY ist nicht gesetzt. Trage sk_test_... in .env.local ein."
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
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}
