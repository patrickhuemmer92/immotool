import type { Metadata } from "next";
import Link from "next/link";
import { PRICING_TIERS } from "@/lib/billing/pricing";
import {
  ArrowRight,
  CheckCircle2,
  MinusCircle,
} from "../_components/icons";

export const metadata: Metadata = {
  title: "Preise — EstateAbly",
  description:
    "Transparente Jahrespreise nach Objekt-Anzahl. 1 Objekt dauerhaft kostenlos. 7-Tage-Premium-Trial ohne Kreditkarte. Volle Funktionen ab 39,99 € pro Jahr.",
  openGraph: {
    title: "Preise — EstateAbly",
    description:
      "Transparente Jahrespreise nach Objekt-Anzahl. Ab 0 € für 1 Objekt — 7 Tage alle Funktionen testen.",
    locale: "de_DE",
    type: "website",
  },
};

/**
 * Pricing-Page. Greift die echten Tier-Stufen aus
 * `src/lib/billing/pricing.ts` ab, damit Landing-Anzeige und
 * Checkout-Logik niemals auseinanderlaufen — wenn Stripe-Stufen geändert
 * werden, ändert sich automatisch die Anzeige hier mit.
 *
 * Server-Component: kein State, alles statisch aus den TIERS gerendert.
 */

const TIER_HIGHLIGHT_INDEX = 1; // Starter (2–5 Objekte) ist die meistgekaufte Stufe.

function quantityRange(min: number, max: number | null): string {
  if (max == null) return `${min}+ Objekte`;
  if (min === max) return min === 1 ? "1 Objekt" : `${min} Objekte`;
  return `${min}–${max} Objekte`;
}

function formatEuro(value: number): string {
  if (value === 0) return "0 €";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const COMMON_FEATURES = [
  "Unbegrenzte Eigentümer & Portfolios",
  "Cashflow-Rechner vor & nach Steuer",
  "Darlehensrechner mit Tilgungsplan",
  "AfA-Übersicht je Objekt",
  "Investitionsplan Objekt × Jahr",
  "Bank-ready Factbook-PDF",
  "Mitglieder einladen (Bank, Steuerberater)",
  "DSGVO-konform, gehostet in der EU",
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Was passiert nach den 7 Trial-Tagen?",
    a: "Sie behalten dauerhaft kostenlosen Zugriff für 1 Objekt mit allen Grundfunktionen — inklusive Factbook-PDF. Erst wenn Sie ein zweites Objekt anlegen, ist ein bezahltes Abo nötig.",
  },
  {
    q: "Brauche ich eine Kreditkarte für den Trial?",
    a: "Nein. Der Trial wird automatisch beim Anlegen Ihres Kontos gestartet. Wenn Sie nach 7 Tagen weiter Premium nutzen wollen, hinterlegen Sie erst dann eine Zahlungsmethode.",
  },
  {
    q: "Kann ich jederzeit kündigen?",
    a: "Ja. Über § 312k BGB ist im Konto-Menü ein Kündigungs-Button hinterlegt, mit einem Klick lässt sich das Abo zum Ende der Laufzeit beenden. Sie behalten danach den Free-Tier-Zugriff für 1 Objekt.",
  },
  {
    q: "Wie funktioniert die Abrechnung?",
    a: "Jahresabrechnung über Stripe in Euro. Der Preis richtet sich nach Ihrer aktuellen Objekt-Anzahl. Legen Sie ein weiteres Objekt an, das in eine höhere Stufe rutscht, rechnen wir den anteiligen Differenzbetrag auf den nächsten Zyklus.",
  },
  {
    q: "Welche Zahlungsmethoden gibt es?",
    a: "SEPA-Lastschrift und alle gängigen Kreditkarten (Visa, Mastercard, American Express). Die Abwicklung läuft über Stripe — Ihre Zahlungsdaten erreichen unseren Server nicht.",
  },
  {
    q: "Was ist mit Kleinunternehmer-Regelung (§ 19 UStG)?",
    a: "EstateAbly nutzt aktuell § 19 UStG, daher weisen wir keine Umsatzsteuer aus. Rechnungen erhalten Sie automatisch nach jeder Buchung im Stripe-Kunden-Portal.",
  },
];

export default function PricingPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-mk">
        <div className="bg-grid absolute inset-0 opacity-50" />
        <div className="absolute -right-20 -top-20 h-[480px] w-[480px] rounded-full bg-[color:var(--mk-primary)]/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-12 pt-24 text-center md:pt-32">
          <span className="eyebrow">Preise</span>
          <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            Klare Preise.{" "}
            <span className="text-mk-primary">Keine Überraschungen.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-mk-muted md:text-xl">
            Ein Objekt ist dauerhaft kostenlos. Wenn Ihr Bestand wächst, wachsen die Funktionen mit — bezahlt wird jährlich, nach Objekt-Anzahl.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[color:var(--mk-primary)]/30 bg-[color:var(--mk-primary)]/10 px-4 py-1.5 text-sm font-medium text-mk-primary">
            <CheckCircle2 className="size-4" />7 Tage Premium gratis testen — keine Kreditkarte nötig
          </div>
        </div>
      </section>

      {/* TIERS */}
      <section className="border-b border-mk py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-4 lg:grid-cols-5 lg:gap-3">
            {PRICING_TIERS.map((tier, i) => {
              const highlight = i === TIER_HIGHLIGHT_INDEX;
              return (
                <div
                  key={tier.label}
                  className={
                    highlight
                      ? "relative flex flex-col rounded-2xl border border-[color:var(--mk-primary)] bg-mk-surface-elevated p-6 shadow-2xl shadow-black/30"
                      : "relative flex flex-col rounded-2xl border border-mk bg-mk-surface p-6"
                  }
                >
                  {highlight ? (
                    <span className="absolute -top-3 right-6 rounded-full bg-[color:var(--mk-primary)] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--mk-primary-foreground)]">
                      Beliebteste
                    </span>
                  ) : null}
                  <div className="text-sm font-semibold uppercase tracking-widest text-mk-muted">
                    {tier.label}
                  </div>
                  <div className="mt-2 text-xs text-mk-muted">
                    {quantityRange(tier.minQty, tier.maxQty)}
                  </div>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tabular-nums">
                      {formatEuro(tier.yearlyEur)}
                    </span>
                    <span className="text-xs text-mk-muted">/ Jahr</span>
                  </div>
                  {tier.yearlyEur === 0 ? (
                    <p className="mt-3 text-xs leading-relaxed text-mk-muted">
                      Dauerhaft kostenlos. Inklusive Factbook-PDF.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-mk-muted">
                      Alle Funktionen. Jährliche Abrechnung über Stripe.
                    </p>
                  )}
                  <Link
                    href="/signup"
                    className={
                      highlight
                        ? "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--mk-primary)] px-4 py-2.5 text-sm font-semibold text-[color:var(--mk-primary-foreground)] transition-opacity hover:opacity-90"
                        : "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md border border-mk bg-mk-surface-elevated px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-mk-surface"
                    }
                  >
                    {tier.yearlyEur === 0 ? "Loslegen" : "Jetzt starten"}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-xs text-mk-muted">
            Preise inkl. § 19 UStG (Kleinunternehmerregelung) — keine Umsatzsteuer ausgewiesen. Stand: {new Date().getFullYear()}.
          </p>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="border-b border-mk py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <span className="eyebrow">In jedem Tarif</span>
            <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight md:text-4xl">
              Funktionen sind nicht gestaffelt. Nur die Objekt-Anzahl.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-mk-muted">
              Alle Tarife enthalten den vollen Funktionsumfang. Wir staffeln nicht nach Features — nur nach Größe Ihres Portfolios.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {COMMON_FEATURES.map((f) => (
              <div
                key={f}
                className="flex items-start gap-3 rounded-lg border border-mk bg-mk-surface p-4"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mk-primary" />
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NOT INCLUDED */}
      <section className="border-b border-mk py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <span className="eyebrow">Nicht im Funktionsumfang</span>
            <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight md:text-4xl">
              Fokussiert auf Bestandsverwaltung — nicht alles in einem.
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(
              [
                [
                  "Doppelte Buchführung",
                  "Übernimmt Ihr Steuerberater per DATEV.",
                ],
                [
                  "Hausverwaltung",
                  "Kein WEG-Modul, keine Mieterkommunikation.",
                ],
                [
                  "Asset-Management für Fonds",
                  "Wir richten uns an private und mittelständische Bestände.",
                ],
                [
                  "Makler-Listings",
                  "Kein Tool zum Listen oder Verkaufen von Drittobjekten.",
                ],
              ] as const
            ).map(([t, b]) => (
              <li
                key={t}
                className="flex gap-3 rounded-lg border border-mk p-4"
              >
                <MinusCircle className="mt-0.5 size-5 shrink-0 text-mk-muted" />
                <div>
                  <div className="font-semibold text-mk-muted">{t}</div>
                  <div className="mt-1 text-sm text-mk-muted">{b}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-mk py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <span className="eyebrow">Häufige Fragen</span>
            <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight md:text-4xl">
              Antworten, bevor Sie fragen.
            </h2>
          </div>
          <dl className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-lg border border-mk bg-mk-surface p-5 open:bg-mk-surface-elevated"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                  <span>{q}</span>
                  <span className="text-mk-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-mk-muted">
                  {a}
                </p>
              </details>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-2xl border border-mk bg-mk-surface p-10 text-center md:p-16">
            <div className="bg-grid absolute inset-0 opacity-50" />
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[color:var(--mk-primary)]/15 blur-3xl" />
            <div className="relative">
              <span className="eyebrow">Jetzt starten</span>
              <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-5xl">
                7 Tage Premium gratis. Danach 1 Objekt dauerhaft kostenlos.
              </h2>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-md bg-[color:var(--mk-primary)] px-6 py-3 text-sm font-semibold text-[color:var(--mk-primary-foreground)] transition-opacity hover:opacity-90"
                >
                  Kostenlos starten <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-md border border-mk px-6 py-3 text-sm font-semibold transition-colors hover:bg-mk-surface-elevated"
                >
                  Zur Übersicht
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
