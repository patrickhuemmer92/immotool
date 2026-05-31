#!/usr/bin/env node
/**
 * Erstellt / aktualisiert die immotool-Produkte + Prices in Stripe.
 *
 * Verwendung (Test-Modus):
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
 *
 * Verwendung (Live-Modus, ACHTUNG):
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs
 *
 * Idempotent dank `lookup_key` — re-runs erzeugen keine Duplikate, sondern
 * aktualisieren Metadaten / Beträge bei Bedarf (Stripe lässt allerdings
 * keinen Preis-Update zu — bei Preisänderung muss alter Price deaktiviert
 * + neuer Price angelegt werden).
 *
 * Output: Eine Liste mit allen Stripe-Price-IDs, die auch direkt in den
 * Stripe Customer Portal zu konfigurieren sind.
 */

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error(
    "FEHLT: STRIPE_SECRET_KEY (sk_test_... oder sk_live_...) als Env-Variable."
  );
  process.exit(1);
}

const MODE = KEY.startsWith("sk_live_")
  ? "LIVE"
  : KEY.startsWith("sk_test_")
    ? "TEST"
    : "UNKNOWN";

console.log(`\n=== Stripe-Setup (${MODE}) ===\n`);

const stripe = new Stripe(KEY, { apiVersion: "2026-05-27.dahlia" });

const TIERS = [
  {
    lookupKey: "imm_starter_year",
    productName: "immotool Starter",
    description: "2–9 Objekte. Jährliche Abrechnung.",
    priceCents: 3900,
    metadata: { tier: "starter", min_objects: "2", max_objects: "9" },
  },
  {
    lookupKey: "imm_pro_year",
    productName: "immotool Pro",
    description: "10–24 Objekte. Jährliche Abrechnung.",
    priceCents: 11900,
    metadata: { tier: "pro", min_objects: "10", max_objects: "24" },
  },
  {
    lookupKey: "imm_portfolio_year",
    productName: "immotool Portfolio",
    description: "Ab 25 Objekte. Jährliche Abrechnung.",
    priceCents: 19900,
    metadata: { tier: "portfolio", min_objects: "25", max_objects: "∞" },
  },
];

/**
 * Sucht ein Produkt anhand metadata.tier, weil Stripe keinen Lookup-Key
 * auf Produkten kennt (nur auf Prices). Idempotent dank Metadaten-Match.
 */
async function findProductByTier(tier) {
  const list = await stripe.products.search({
    query: `metadata['tier']:'${tier}'`,
  });
  return list.data[0] ?? null;
}

async function ensureProduct(spec) {
  const existing = await findProductByTier(spec.metadata.tier);
  if (existing) {
    console.log(
      `  ↻ Produkt existiert: ${existing.id} (${spec.productName})`
    );
    // Update Beschreibung + Metadaten (idempotent)
    return stripe.products.update(existing.id, {
      name: spec.productName,
      description: spec.description,
      metadata: spec.metadata,
    });
  }
  console.log(`  + Erzeuge Produkt: ${spec.productName}`);
  return stripe.products.create({
    name: spec.productName,
    description: spec.description,
    metadata: spec.metadata,
  });
}

async function findPriceByLookupKey(lookupKey) {
  const list = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return list.data[0] ?? null;
}

async function ensurePrice(product, spec) {
  const existing = await findPriceByLookupKey(spec.lookupKey);
  if (existing) {
    // Stripe erlaubt nur Aktivierungs-Toggle + Metadaten-Update auf Prices.
    // Bei Preisänderung muss der alte Price archiviert + ein neuer mit
    // demselben lookup_key (Transfer) angelegt werden.
    if (
      existing.unit_amount !== spec.priceCents ||
      existing.currency !== "eur"
    ) {
      console.log(
        `  ⚠ Price ${spec.lookupKey} hat anderen Betrag oder Currency. ` +
          `Aktueller Wert: ${(existing.unit_amount ?? 0) / 100} ${existing.currency.toUpperCase()}, ` +
          `Soll: ${spec.priceCents / 100} EUR. Erzeuge neuen Price + transferiere lookup_key.`
      );
      // alten Price archivieren
      await stripe.prices.update(existing.id, { active: false });
      const updated = await stripe.prices.create({
        product: product.id,
        currency: "eur",
        unit_amount: spec.priceCents,
        recurring: { interval: "year" },
        lookup_key: spec.lookupKey,
        transfer_lookup_key: true,
        metadata: { tier: spec.metadata.tier },
      });
      return updated;
    }
    console.log(
      `  ↻ Price existiert: ${existing.id} (${spec.lookupKey} → ${spec.priceCents / 100} EUR/Jahr)`
    );
    return existing;
  }
  console.log(
    `  + Erzeuge Price: ${spec.lookupKey} (${spec.priceCents / 100} EUR/Jahr)`
  );
  return stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: spec.priceCents,
    recurring: { interval: "year" },
    lookup_key: spec.lookupKey,
    metadata: { tier: spec.metadata.tier },
  });
}

const results = [];

for (const tier of TIERS) {
  console.log(`\n[${tier.metadata.tier}]`);
  const product = await ensureProduct(tier);
  const price = await ensurePrice(product, tier);
  results.push({
    tier: tier.metadata.tier,
    product_id: product.id,
    price_id: price.id,
    lookup_key: tier.lookupKey,
    amount_eur: tier.priceCents / 100,
  });
}

console.log("\n=== Ergebnis ===\n");
console.table(results);

console.log(`
Nächste Schritte:

  1) Stripe Customer Portal aktivieren / konfigurieren:
     ${MODE === "LIVE" ? "https://dashboard.stripe.com/settings/billing/portal" : "https://dashboard.stripe.com/test/settings/billing/portal"}

     Empfohlene Einstellungen:
       - "Kunden können Abos kündigen" → ja, sofort oder zum Periodenende
       - "Kunden können Pläne wechseln" → ja, alle 3 Prices oben hinzufügen
       - "Rechnungshistorie sichtbar" → ja
       - "Zahlungsmethoden aktualisieren" → ja

  2) Webhook-Endpoint anlegen:
     ${MODE === "LIVE" ? "https://dashboard.stripe.com/webhooks" : "https://dashboard.stripe.com/test/webhooks"}

     URL: https://<deine-domain>/api/billing/webhook
     Events zu abonnieren:
       - checkout.session.completed
       - customer.subscription.created
       - customer.subscription.updated
       - customer.subscription.deleted

     Webhook-Secret als STRIPE_WEBHOOK_SECRET in Vercel (bzw. .env.local) eintragen.

  3) Im Dev (lokal) Webhook forwarden:
       stripe listen --forward-to localhost:3000/api/billing/webhook
     Den dort gezeigten whsec_... in .env.local als STRIPE_WEBHOOK_SECRET setzen.
`);
