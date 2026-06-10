import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  LayoutDashboard,
  Users,
  Wallet,
  Banknote,
  Calculator,
  Hammer,
  UserPlus,
  FileDown,
  CheckCircle2,
  MinusCircle,
  Mail,
  ShieldCheck,
  Eye,
  Pencil,
  Search,
  Clock,
  FolderX,
} from "./_components/icons";

export const metadata: Metadata = {
  title: "EstateAbly — Das digitale Factbook für Ihr Immobilienportfolio",
  description:
    "Objekte, Cashflows, Darlehen, AfA und Investitionen an einem Ort. Auf Knopfdruck als Factbook-PDF für Ihre Bank, Ihren Steuerberater oder den Verkauf.",
  openGraph: {
    title:
      "EstateAbly — Das digitale Factbook für Ihr Immobilienportfolio",
    description:
      "Vollständiger Portfolio-Überblick für Bankgespräche, Steuerberater und Verkauf. Auf Knopfdruck als Factbook-PDF.",
    locale: "de_DE",
    type: "website",
  },
};

/* ---------- atoms ---------- */

function SectionHeader({
  eyebrow,
  title,
  sub,
  center,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={`mb-14 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight md:text-5xl">
        {title}
      </h2>
      {sub ? (
        <p className="mt-5 text-pretty text-lg leading-relaxed text-mk-muted">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-xl border border-mk bg-mk-surface p-6 transition-colors hover:border-[color:var(--mk-primary)]/40">
      <span className="grid size-10 place-items-center rounded-lg bg-[color:var(--mk-primary)]/10 text-mk-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-mk-muted">{body}</p>
    </div>
  );
}

function MockFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-mk bg-mk-surface shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between border-b border-mk bg-mk-surface-elevated px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-mk-muted/40" />
          <span className="size-2.5 rounded-full bg-mk-muted/40" />
          <span className="size-2.5 rounded-full bg-[color:var(--mk-primary)]/60" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-mk-muted">
          {title}
        </div>
        <div className="text-[11px] text-mk-muted">app.estateably.de</div>
      </div>
      {children}
    </div>
  );
}

/* ---------- mocks ---------- */

function DashboardMock() {
  const kpis: Array<[string, string]> = [
    ["Objekte", "12"],
    ["Marktwert", "2,84 M €"],
    ["Restschuld", "1,62 M €"],
    ["Eigenkapital", "1,22 M €"],
    ["LTV", "57,0 %"],
  ];
  return (
    <MockFrame title="Dashboard · Mein Portfolio">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="accent-bar" />
          <h4 className="text-lg font-bold">Dashboard</h4>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {kpis.map(([l, v]) => (
            <div
              key={l}
              className="rounded-lg border border-mk bg-mk-surface-elevated p-4"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-mk-muted">
                {l}
              </div>
              <div className="mt-2 text-lg font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-mk bg-mk-surface-elevated p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-mk-muted">
              Diversifikation nach Standort
            </div>
            <div className="mt-4 flex items-center gap-5">
              <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
                <circle
                  r="40"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  stroke="oklch(0.31 0.055 255)"
                  strokeWidth="20"
                />
                <circle
                  r="40"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  stroke="var(--mk-primary)"
                  strokeWidth="20"
                  strokeDasharray="125 251"
                />
                <circle
                  r="40"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  stroke="oklch(0.55 0.1 200)"
                  strokeWidth="20"
                  strokeDasharray="75 251"
                  strokeDashoffset="-125"
                />
                <circle
                  r="40"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  stroke="oklch(0.45 0.06 255)"
                  strokeWidth="20"
                  strokeDasharray="51 251"
                  strokeDashoffset="-200"
                />
              </svg>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[color:var(--mk-primary)]" />
                  Nürnberg · 50%
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: "oklch(0.55 0.1 200)" }}
                  />
                  Berlin · 30%
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: "oklch(0.45 0.06 255)" }}
                  />
                  Leipzig · 20%
                </li>
              </ul>
            </div>
          </div>
          <div className="rounded-lg border border-mk bg-mk-surface-elevated p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-mk-muted">
              Kaufpreis · Restschuld · Eigenkapital
            </div>
            <div className="mt-6 flex h-32 items-end gap-6 px-2">
              {(
                [
                  ["Anschaffung", 100, "oklch(0.55 0.1 200)"],
                  ["Restschuld", 78, "oklch(0.65 0.22 25)"],
                  ["Eigenkapital", 45, "var(--mk-primary)"],
                ] as const
              ).map(([l, h, c]) => (
                <div
                  key={l}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${h}%`, background: c }}
                  />
                  <span className="text-[10px] text-mk-muted">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

function ObjekteMock() {
  const rows = [
    [
      "Wohnung",
      "Designstraße 10, 90411 Nürnberg, EG",
      "75",
      "250.000 €",
      "269.375 €",
    ],
    [
      "Wohnung",
      "Musterstraße 1, 90402 Nürnberg, 2. OG",
      "50",
      "150.000 €",
      "161.250 €",
    ],
    [
      "Wohnung",
      "Teststraße 1, 90403 Nürnberg, 3. OG",
      "60",
      "200.000 €",
      "234.000 €",
    ],
  ];
  return (
    <MockFrame title="Objekte · Mein Portfolio">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="accent-bar" />
          <h4 className="text-lg font-bold">Objekte</h4>
        </div>
        <div className="mt-5 overflow-hidden rounded-lg border border-mk">
          <table className="w-full text-xs">
            <thead className="bg-mk-surface-elevated text-[10px] uppercase tracking-wider text-mk-muted">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Typ</th>
                <th className="px-3 py-3 text-left font-semibold">Adresse</th>
                <th className="px-3 py-3 text-right font-semibold">m²</th>
                <th className="px-3 py-3 text-right font-semibold">
                  Kaufpreis
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  Marktwert
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-mk">
                  <td className="px-3 py-3">
                    <span className="rounded bg-[color:var(--mk-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-mk-primary">
                      {r[0]}
                    </span>
                  </td>
                  <td className="px-3 py-3">{r[1]}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r[2]}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r[3]}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {r[4]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 rounded-lg border border-mk bg-mk-surface-elevated p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-mk-muted">
            Eigentümer
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between border-b border-mk pb-2">
              <span>Max Mustermann</span>
              <span className="text-xs text-mk-muted">60% Anteil</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Paula Mustermann</span>
              <span className="text-xs text-mk-muted">40% Anteil</span>
            </li>
          </ul>
        </div>
      </div>
    </MockFrame>
  );
}

function CashflowMock() {
  const rows = [
    ["Designstraße 10", "12.180", "−3.454", "−5.501", "−4.618", "−1.955"],
    ["Musterstraße 1", "9.000", "−3.780", "−2.604", "−2.606", "−1.057"],
    ["Teststraße 1", "11.100", "−2.898", "−3.390", "−3.266", "−218"],
    ["Σ", "32.280", "−10.132", "−11.495", "−10.490", "−3.230"],
  ];
  return (
    <MockFrame title="Cashflow-Rechner">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="accent-bar" />
          <h4 className="text-lg font-bold">Cashflow-Rechner</h4>
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg border border-mk">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-mk-surface-elevated text-[10px] uppercase tracking-wider text-mk-muted">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Objekt</th>
                <th className="px-3 py-3 text-right font-semibold">
                  Einnahmen
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  Betriebsk.
                </th>
                <th className="px-3 py-3 text-right font-semibold">Zinsen</th>
                <th className="px-3 py-3 text-right font-semibold">AfA</th>
                <th className="px-3 py-3 text-right font-semibold">
                  CF n. Steuer
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className={`border-t border-mk ${
                    i === rows.length - 1
                      ? "bg-mk-surface-elevated font-semibold"
                      : ""
                  }`}
                >
                  {r.map((c, j) => (
                    <td
                      key={j}
                      className={`px-3 py-3 tabular-nums ${
                        j === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {j === 0 ? c : `${c} €`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MockFrame>
  );
}

function DarlehenAfaMock() {
  return (
    <MockFrame title="Darlehen & AfA">
      <div className="grid gap-5 p-6 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-3">
            <div className="accent-bar" />
            <h4 className="font-bold">Darlehen</h4>
          </div>
          <div className="mt-4 space-y-2">
            {[
              ["Sparbank", "Musterstraße 1", "130.328 €"],
              ["Europa Bank", "Teststraße 1", "169.685 €"],
              ["Lokalbank", "Designstraße 10", "220.270 €"],
            ].map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-mk bg-mk-surface-elevated p-3 text-xs"
              >
                <div>
                  <div className="font-semibold">{r[0]}</div>
                  <div className="mt-0.5 text-mk-muted">{r[1]}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-mk-muted">
                    Restschuld
                  </div>
                  <div className="font-semibold tabular-nums">{r[2]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <div className="accent-bar" />
            <h4 className="font-bold">AfA pro Objekt</h4>
          </div>
          <div className="mt-4 space-y-2">
            {[
              ["Designstraße 10", "230.903 €", "2 %", "4.618 €"],
              ["Musterstraße 1", "130.280 €", "2 %", "2.606 €"],
              ["Teststraße 1", "163.313 €", "2 %", "3.266 €"],
            ].map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-mk bg-mk-surface-elevated p-3 text-xs"
              >
                <div className="font-semibold">{r[0]}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-mk-muted">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider">
                      Basis
                    </div>
                    <div className="mt-0.5 tabular-nums text-mk-foreground">
                      {r[1]}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider">
                      Satz
                    </div>
                    <div className="mt-0.5 tabular-nums text-mk-foreground">
                      {r[2]}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider">
                      Jahr
                    </div>
                    <div className="mt-0.5 tabular-nums text-mk-primary">
                      {r[3]}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border border-[color:var(--mk-primary)]/30 bg-[color:var(--mk-primary)]/10 p-3 text-xs">
              <span className="font-semibold text-mk-primary">
                Jährliche AfA gesamt
              </span>
              <span className="font-bold tabular-nums text-mk-primary">
                10.490 €
              </span>
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

function InvestMock() {
  const years = ["2026", "2027", "2028", "2030"];
  const rows: Array<[string, Array<string | null>]> = [
    ["Designstraße 10", [null, "10.000", "7.500", "2.500"]],
    ["Musterstraße 1", [null, null, "10.000", "8.500"]],
    ["Teststraße 1", ["7.500", "5.000", null, null]],
  ];
  return (
    <MockFrame title="Investitionen · Objekt × Jahr">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="accent-bar" />
          <h4 className="text-lg font-bold">Investitionen</h4>
        </div>
        <div className="mt-5 overflow-hidden rounded-lg border border-mk">
          <table className="w-full text-xs">
            <thead className="bg-mk-surface-elevated text-[10px] uppercase tracking-wider text-mk-muted">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Objekt</th>
                {years.map((y) => (
                  <th key={y} className="px-3 py-3 text-right font-semibold">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([obj, vals], i) => (
                <tr key={i} className="border-t border-mk">
                  <td className="px-3 py-3">{obj}</td>
                  {vals.map((v, j) => (
                    <td
                      key={j}
                      className="px-3 py-3 text-right tabular-nums"
                    >
                      {v ? (
                        <span className="rounded bg-[color:var(--mk-primary)]/10 px-2 py-1 text-mk-primary">
                          {v} €
                        </span>
                      ) : (
                        <span className="text-mk-muted/50">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MockFrame>
  );
}

function FactbookMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-[color:var(--mk-primary)]/5 blur-2xl" />
      <div className="relative overflow-hidden rounded-xl border border-mk bg-[oklch(0.97_0.005_250)] p-8 text-[oklch(0.17_0.035_255)] shadow-2xl shadow-black/40 md:p-10">
        <div className="flex items-center justify-between border-b border-[oklch(0.17_0.035_255_/_0.1)] pb-4">
          <div className="flex items-baseline text-sm font-bold">
            <span>Estate</span>
            <span className="text-[oklch(0.65_0.15_178)]">Ably</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[oklch(0.45_0.04_255)]">
            Portfolio Factbook · Q2 2026
          </div>
        </div>
        <div className="mt-8">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.45_0.04_255)]">
            Familie Mustermann
          </div>
          <h3 className="mt-1 text-2xl font-bold leading-tight">
            Portfolio-Übersicht
          </h3>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
          {(
            [
              ["Objekte", "12"],
              ["Marktwert", "2,84 M €"],
              ["Restschuld", "1,62 M €"],
              ["LTV", "57,0 %"],
            ] as const
          ).map(([l, v]) => (
            <div key={l}>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-[oklch(0.45_0.04_255)]">
                {l}
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 h-24 rounded-lg bg-[oklch(0.92_0.01_250)]" />
        <div className="mt-6 flex items-center justify-between border-t border-[oklch(0.17_0.035_255_/_0.1)] pt-4">
          <span className="text-[10px] text-[oklch(0.45_0.04_255)]">
            Generiert mit EstateAbly · Bank-ready
          </span>
          <span className="inline-flex items-center gap-2 rounded-md bg-[oklch(0.65_0.15_178)] px-3 py-1.5 text-[10px] font-semibold text-white">
            <FileDown className="size-3" /> PDF
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- feature split ---------- */

function FeatureSplit({
  id,
  eyebrow,
  title,
  body,
  bullets,
  mock,
  reverse,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  mock: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="border-b border-mk py-24">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-2 lg:items-center">
        <div className={reverse ? "lg:order-2" : ""}>
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-mk-muted">
            {body}
          </p>
          <ul className="mt-7 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mk-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? "lg:order-1" : ""}>{mock}</div>
      </div>
    </section>
  );
}

/* ---------- page ---------- */

export default function MarketingLandingPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-mk">
        <div className="bg-grid absolute inset-0 opacity-60" />
        <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-[color:var(--mk-primary)]/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 md:pb-32 md:pt-32">
          <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <span className="eyebrow">
                Das digitale Factbook für Immobilien
              </span>
              <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
                Ihr Portfolio.{" "}
                <span className="text-mk-primary">In einem Factbook.</span>
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-mk-muted md:text-xl">
                Objekte, Cashflows, Darlehen, AfA und Investitionen — gepflegt
                an einem Ort, auf Knopfdruck als Factbook für Ihre Bank.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-md bg-[color:var(--mk-primary)] px-6 py-3 text-sm font-semibold text-[color:var(--mk-primary-foreground)] transition-opacity hover:opacity-90"
                >
                  Kostenlos starten <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#factbook"
                  className="inline-flex items-center gap-2 rounded-md border border-mk px-6 py-3 text-sm font-semibold transition-colors hover:bg-mk-surface"
                >
                  Factbook ansehen
                </a>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-xs uppercase tracking-widest text-mk-muted">
                <span>Bank-ready PDF</span>
                <span>·</span>
                <span>1 Objekt kostenlos · ab 39,99 €/Jahr</span>
                <span>·</span>
                <span>Made in Germany</span>
              </div>
            </div>
            <div className="relative">
              <DashboardMock />
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="border-b border-mk py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            eyebrow="Problem"
            title="Daten verstreut — jeder Termin kostet Tage."
            sub="Wer den eigenen Bestand nicht zeigen kann, verhandelt schwächer. Bei der Bank, beim Steuerberater und erst recht beim Verkauf."
          />
          <div className="grid gap-px overflow-hidden rounded-xl border border-mk bg-mk md:grid-cols-3">
            {[
              {
                icon: Clock,
                no: "01",
                title: "Bankgespräch",
                body: "Daten für jede Anschlussfinanzierung tagelang aus Excel-Tabs, Mails und Aktenordnern zusammensuchen.",
              },
              {
                icon: Search,
                no: "02",
                title: "Steuerberater",
                body: "Belege, AfA-Pläne und Auswertungen liegen verstreut. Jedes Jahr derselbe Aufwand für die Übergabe.",
              },
              {
                icon: FolderX,
                no: "03",
                title: "Verkauf",
                body: "Kein sauberer Datenraum für Käufer — der rechnet selbst, drückt den Preis und Sie verlieren bei den Konditionen.",
              },
            ].map((p) => (
              <div key={p.no} className="bg-mk-background p-8 md:p-10">
                <p.icon className="size-5 text-mk-primary" />
                <div className="mt-5 text-sm font-semibold tabular-nums text-mk-primary">
                  {p.no}
                </div>
                <h3 className="mt-2 text-xl font-bold">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-mk-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LÖSUNG */}
      <section id="loesung" className="border-b border-mk py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            eyebrow="Lösung"
            title="Das digitale Factbook für Ihr Immobilienportfolio."
            sub="EstateAbly bündelt Objekte, Cashflows, Darlehen, AfA und Investitionen — und macht daraus auf Knopfdruck ein Factbook für Bank, Steuerberater oder Käufer."
          />
          <div className="flex flex-wrap gap-2">
            {["Bankgespräch", "Steuerberater", "Verkauf", "Erbengemeinschaft"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-[color:var(--mk-primary)]/30 bg-[color:var(--mk-primary)]/10 px-4 py-1.5 text-sm font-medium text-mk-primary"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* MODULE */}
      <section id="module" className="border-b border-mk py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            eyebrow="Module"
            title="Alles, was Sie für die Verwaltung Ihres Bestands brauchen."
            sub="Acht aufeinander abgestimmte Module — von Stammdaten bis Zusammenarbeit mit Bank und Steuerberater."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              icon={Building2}
              title="Objekte"
              body="Anschaffung, Bewertung, Eigenkapital-Anteil und Stammdaten — sauber je Objekt."
            />
            <Card
              icon={LayoutDashboard}
              title="Dashboard"
              body="Alle Kennzahlen auf einen Blick: Marktwert, Restschuld, LTV, Eigenkapital, Rendite."
            />
            <Card
              icon={Users}
              title="Eigentümer"
              body="Beliebig viele Eigentümer und Gruppen, Aufteilung individuell pro Anteil."
            />
            <Card
              icon={Wallet}
              title="Cashflow-Rechner"
              body="Alle Zahlungsströme je Objekt und Portfolio — vor und nach Steuer."
            />
            <Card
              icon={Banknote}
              title="Darlehen"
              body="Automatisierte Darlehensrechner. Restschuld und Annuität stets aktuell."
            />
            <Card
              icon={Calculator}
              title="AfA"
              body="Gebäude- und Mobiliar-Abschreibung — Basis für eine saubere Nachsteuer-Sicht."
            />
            <Card
              icon={Hammer}
              title="Investitionen"
              body="Sichere und eventuelle Maßnahmen planen — künftige Ausgaben im Blick."
            />
            <Card
              icon={UserPlus}
              title="Mitglieder"
              body="Bank, Steuerberater oder Wirtschaftsprüfer einladen — lesend oder pflegend."
            />
          </div>
        </div>
      </section>

      {/* DASHBOARD DETAIL */}
      <FeatureSplit
        id="dashboard"
        eyebrow="Dashboard"
        title="Alle Kennzahlen auf einen Blick."
        body="Marktwert, Restschuld, Eigenkapital, LTV und Bruttomietrendite — live aus Ihren Daten berechnet. Plus Diversifikation nach Standort, damit Sie fundierte Portfolio-Entscheidungen treffen."
        bullets={[
          "KPIs in Echtzeit",
          "Diversifikation nach Standort",
          "Kaufpreis vs. Restschuld vs. EK",
        ]}
        mock={<DashboardMock />}
      />

      {/* OBJEKTE & EIGENTÜMER */}
      <FeatureSplit
        id="objekte"
        eyebrow="Objekte & Eigentümer"
        title="Saubere Datenbasis — gewichtet nach Eigentumsanteil."
        body="Objektliste je Eigentümer oder Gruppe. Anschaffung, Marktwert, Restschuld und Eigenkapital — automatisch nach individuellem Anteil aufgeteilt."
        bullets={[
          "Mehrere Eigentümer & Gruppen",
          "Anteilsgenaue Aufteilung",
          "Indikative Marktwerte",
        ]}
        mock={<ObjekteMock />}
        reverse
      />

      {/* CASHFLOW */}
      <FeatureSplit
        id="cashflow"
        eyebrow="Cashflow"
        title="Wissen, was unterm Strich übrig bleibt."
        body="Einnahmen, Betriebskosten, Zinsen, AfA — Cashflow vor und nach Steuer, je Objekt und für das gesamte Portfolio. Realistisch, nicht beschönigt."
        bullets={[
          "Vor- und Nachsteuer-Sicht",
          "Je Objekt und Portfolio",
          "Sauber dokumentiert",
        ]}
        mock={<CashflowMock />}
      />

      {/* DARLEHEN & AFA */}
      <FeatureSplit
        id="darlehen"
        eyebrow="Darlehen & AfA"
        title="Finanzierung und Abschreibung — immer aktuell."
        body="Darlehensübersicht mit Bank, Zinssatz, Annuität und tagesaktueller Restschuld. AfA-Übersicht je Objekt als Grundlage Ihrer Nachsteuer-Berechnung."
        bullets={[
          "Annuität & Restschuld live",
          "Gebäude- und Mobiliar-AfA",
          "Bank-tauglich aufbereitet",
        ]}
        mock={<DarlehenAfaMock />}
        reverse
      />

      {/* INVEST & SETTINGS */}
      <FeatureSplit
        id="investitionen"
        eyebrow="Investitionen & Einstellungen"
        title="Vorausplanen und individuell einstellen."
        body="Investitionsplan Objekt × Jahr für sichere und eventuelle Maßnahmen. Individuelle Stellgrößen für Steuersatz, Standard-AfA, Mietausfallwagnis (Wohnen/Gewerbe), SEV-Verwaltung und IH-Pauschale."
        bullets={[
          "Investitionsplan Objekt × Jahr",
          "Individueller Steuersatz",
          "Mietausfallwagnis & IH-Pauschale",
        ]}
        mock={<InvestMock />}
      />

      {/* MITGLIEDER */}
      <section id="mitglieder" className="border-b border-mk py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            eyebrow="Zusammenarbeit"
            title="Partner einbinden — lesend oder pflegend."
            sub="Externe per E-Mail einladen, mit rollenbasierten Rechten. Sie behalten die Kontrolle, Ihre Partner sehen nur das, was sie sehen sollen."
          />
          <div className="grid gap-3 md:grid-cols-4">
            {[
              {
                icon: ShieldCheck,
                title: "Eigentümer",
                body: "Voller Zugriff auf alle Daten und Einstellungen.",
              },
              {
                icon: Pencil,
                title: "Verwalter",
                body: "Daten pflegen und Auswertungen erzeugen.",
              },
              {
                icon: Eye,
                title: "Steuerberater",
                body: "Lesend mit vollem Export — fertig für die Steuererklärung.",
              },
              {
                icon: Eye,
                title: "Bank / Käufer",
                body: "Lesend — sieht genau das, was im Factbook landet.",
              },
            ].map((r) => (
              <Card key={r.title} icon={r.icon} title={r.title} body={r.body} />
            ))}
          </div>
        </div>
      </section>

      {/* FACTBOOK USP */}
      <section id="factbook" className="relative border-b border-mk py-24">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--mk-primary)]/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="eyebrow">Der USP · Das Factbook</span>
            <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight md:text-5xl">
              Ein Knopfdruck — und das Factbook ist fertig.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-mk-muted">
              Aus Ihren gepflegten Stammdaten erzeugt EstateAbly ein
              durchformatiertes PDF — bereit für Bankgespräch, Steuerberater
              oder Verkaufsverhandlung. Vollständiger Portfolio-Überblick, den
              Sie der Bank in die Hand geben.
            </p>
            <ul className="mt-8 space-y-5">
              {(
                [
                  [
                    "Bankgespräch",
                    "Cashflows, Tilgungspläne, LTV — finanzierungsreif aufbereitet.",
                  ],
                  [
                    "Steuerberater",
                    "Mieteinnahmen, AfA, Werbungskosten — übergabe-fertig pro Steuerjahr.",
                  ],
                  [
                    "Verkauf",
                    "Saubere Unterlagen, die Käufer sofort prüfen können — ohne Rückfragen.",
                  ],
                ] as const
              ).map(([t, b]) => (
                <li key={t} className="flex gap-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mk-primary" />
                  <div>
                    <div className="font-semibold">{t}</div>
                    <div className="mt-1 text-mk-muted">{b}</div>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-10 inline-flex items-center gap-2 rounded-md bg-[color:var(--mk-primary)] px-6 py-3 text-sm font-semibold text-[color:var(--mk-primary-foreground)] transition-opacity hover:opacity-90"
            >
              Kostenlos starten <ArrowRight className="size-4" />
            </Link>
          </div>
          <FactbookMock />
        </div>
      </section>

      {/* FÜR WEN */}
      <section id="fuer-wen" className="border-b border-mk py-24">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            eyebrow="Für wen"
            title="Vermieter und Investoren mit bis zu 50 Objekten."
          />
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="eyebrow mb-6">Richtet sich an</h3>
              <ul className="space-y-3">
                {(
                  [
                    [
                      "Familienportfolios",
                      "Vermögen über Generationen — sauber dokumentiert.",
                    ],
                    [
                      "Vermögensverwaltende GmbHs",
                      "Eigene Bestände professionell führen.",
                    ],
                    [
                      "Privatinvestoren in Aufbauphase",
                      "Bis 50 Objekte ohne eigene Verwaltung.",
                    ],
                    [
                      "Erbengemeinschaften",
                      "Klare Übersicht für alle Beteiligten.",
                    ],
                  ] as const
                ).map(([t, b]) => (
                  <li
                    key={t}
                    className="flex gap-3 rounded-lg border border-mk bg-mk-surface p-4"
                  >
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mk-primary" />
                    <div>
                      <div className="font-semibold">{t}</div>
                      <div className="mt-1 text-sm text-mk-muted">{b}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="eyebrow mb-6 !text-mk-muted">Nicht für</h3>
              <ul className="space-y-3">
                {(
                  [
                    [
                      "Doppelte Buchführung",
                      "Das übernimmt DATEV — wir liefern die Daten.",
                    ],
                    [
                      "Hausverwaltungen",
                      "Kein WEG-Modul, keine Mieterkommunikation.",
                    ],
                    [
                      "Institutionelle Investoren",
                      "Kein Asset-Management für Fonds oder REITs.",
                    ],
                    [
                      "Maklertätigkeit",
                      "Keine AVM für Drittobjekte, kein Listing-Tool.",
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
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="kontakt" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-2xl border border-mk bg-mk-surface p-10 md:p-16">
            <div className="bg-grid absolute inset-0 opacity-50" />
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[color:var(--mk-primary)]/15 blur-3xl" />
            <div className="relative grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center">
              <div>
                <span className="eyebrow">Nächster Schritt</span>
                <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight md:text-5xl">
                  Verschaffen Sie sich den vollen Überblick.
                </h2>
                <p className="mt-5 max-w-xl text-pretty leading-relaxed text-mk-muted">
                  Konto in 30 Sekunden eröffnen, erstes Objekt sofort
                  anlegen — das erste Factbook fällt im selben Atemzug raus.
                  7 Tage alle Premium-Funktionen, danach 1 Objekt dauerhaft
                  kostenlos.
                </p>
                <ul className="mt-6 grid max-w-md gap-2 text-sm text-mk-muted">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-mk-primary" />
                    Keine Kreditkarte nötig
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-mk-primary" />
                    DSGVO-konform, gehostet in der EU
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-mk-primary" />
                    Jederzeit mit einem Klick kündbar
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-mk bg-mk-surface-elevated p-6">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-mk-muted">
                  Sofort loslegen
                </span>
                <p className="mt-3 text-sm leading-relaxed text-mk-muted">
                  Direkt in der EstateAbly-App registrieren — Sie sind in
                  unter einer Minute drin.
                </p>
                <Link
                  href="/signup"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--mk-primary)] px-6 py-3 text-sm font-semibold text-[color:var(--mk-primary-foreground)] transition-opacity hover:opacity-90"
                >
                  Kostenlos starten <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/login"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-mk px-6 py-3 text-sm font-semibold transition-colors hover:bg-mk-surface"
                >
                  Schon Kunde? Anmelden
                </Link>
                <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-mk-muted">
                  <Mail className="size-3.5" />
                  Fragen?{" "}
                  <a
                    href="mailto:info@estateably.de"
                    className="hover:text-mk-foreground"
                  >
                    info@estateably.de
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
