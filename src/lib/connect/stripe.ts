/**
 * Stripe-Client für Connect-Operationen.
 *
 * Wir nutzen denselben Singleton wie für Billing (lib/billing/stripe.ts)
 * — der Stripe-Secret-Key entscheidet (Test- vs. Live-Modus), das gilt
 * auch für Connect-Accounts. V2-Endpoints (z. B. `stripe.v2.core.accounts`)
 * stehen im selben Client zur Verfügung.
 *
 * Die env-Variablen für Connect:
 *   - STRIPE_SECRET_KEY                       (geteilt mit Billing, sk_test_/sk_live_)
 *   - STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID   (Price-ID für Plattform-Subscription)
 *   - STRIPE_WEBHOOK_SECRET_THIN              (V2-Account-Update Webhook-Secret)
 *   - STRIPE_WEBHOOK_SECRET_CONNECT_SNAPSHOT  (Subscription-Snapshot Webhook-Secret)
 *
 * NEXT_PUBLIC_APP_URL wird für return_url/refresh_url/success_url genutzt;
 * fällt zurück auf die Request-Origin, falls nicht gesetzt.
 */

import "server-only";
import { getStripe } from "@/lib/billing/stripe";

export { getStripe };

/**
 * Liefert die Plattform-Subscription-Price-ID oder wirft einen klaren
 * Fehler. Wird bei Subscription-Checkout aufgerufen.
 *
 * PLATZHALTER: Lege im Stripe-Dashboard ein Produkt + recurring Price
 * an (z. B. "Premium-Listing 29 €/Monat") und kopiere die Price-ID
 * (Format: price_...) in STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID.
 */
export function getPlatformSubscriptionPriceId(): string {
  const id = process.env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID;
  if (!id) {
    throw new Error(
      "STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID ist nicht gesetzt. " +
        "Lege im Stripe-Dashboard ein recurring-Produkt an und trage " +
        "die Price-ID (Format: price_...) in deine .env.local ein."
    );
  }
  return id;
}

/**
 * Origin/Base-URL für return_url, success_url, cancel_url etc.
 * Priorität: NEXT_PUBLIC_APP_URL > Request-Origin > Fallback.
 */
export function getBaseUrl(req: Request | null = null): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (req) {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  }
  return "http://localhost:3000";
}
