import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { getPremiumStatus } from "@/lib/billing/premium";
import { aggregateDashboard } from "@/lib/dashboard/aggregate";
import {
  formatEuro,
  formatEuroMillionsKpi,
  formatNumber,
  formatPercent,
} from "@/lib/dashboard/format";
import { DashboardOwnerFilter } from "@/components/dashboard/owner-filter";
import { DashboardKpiCard } from "@/components/dashboard/kpi-card";
import { DashboardCapitalStack } from "@/components/dashboard/capital-stack";
import { DashboardCard } from "@/components/dashboard/card";
import {
  AfaTimelineChart,
  CapitalByPropertyChart,
  CashflowOverTimeChart,
  CityRankingChart,
  DebtEquityTimelineChart,
  InvestmentPlanChart,
  LoanMaturitiesChart,
  OwnerDonutChart,
} from "@/components/dashboard/charts";
import {
  OnboardingStepper,
  type OnboardingStep,
} from "@/components/onboarding-stepper";

/**
 * Portfolio-Dashboard. Strikt aggregierte Sicht — alle KPIs und Charts
 * laufen über `aggregateDashboard()`, die Page macht keine Rechen-
 * arbeit mehr. Der Eigentümer-Filter ist URL-driven (?owner=<id>).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const { owner: ownerParam } = await searchParams;
  const [data, premium] = await Promise.all([
    aggregateDashboard(active.id, ownerParam ?? null),
    getPremiumStatus(active.id),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstName = deriveFirstName(
    user?.user_metadata?.first_name,
    user?.email
  );

  /* ---------- Empty-State (kein einziges Objekt im Workspace) ---------- */
  if (!data.hasProperties) {
    return (
      <EmptyState
        greeting={t("dashboard.welcome", { name: firstName || "" })}
        workspaceName={active.name}
        ctaLabel={t("dashboard.next_create_real_cta")}
        body={t("dashboard.next_create_real_body")}
      />
    );
  }

  /* ---------- Stepper (nur einblenden, bis alles steht) ---------- */
  const ob = data.onboarding;
  const stepperSteps: OnboardingStep[] = buildStepperSteps(t, ob);

  return (
    <div className="space-y-5">
      {/* Optional: Stepper bleibt für noch-nicht-fertige Onboardings. */}
      {ob.realPropertyCount > 0 &&
      (!ob.hasAnyLoan || !ob.hasAnyTenant || !ob.hasAnySnapshot) ? (
        <OnboardingStepper
          steps={stepperSteps}
          dismissLabel={t("dashboard.stepper_dismiss")}
          allDoneLabel={t("dashboard.stepper_all_done")}
        />
      ) : null}

      {/* Topbar — Greeting + Filter + Stichtag */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900">
            {t("dashboard.welcome", { name: firstName || "" })}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-neutral-500">
            {active.name} · Stichtag heute
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardOwnerFilter
            owners={data.owners}
            activeOwnerId={data.activeOwnerId}
            labelAll="Alle"
          />
          <FactbookButton
            isPremium={premium.isPremium}
            hasProperties={data.hasRealProperties}
          />
        </div>
      </header>

      {/* KPI-Reihe */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <DashboardKpiCard
          label="Objekte"
          value={formatNumber(data.totals.propertiesCount)}
          sub="im Bestand"
          icon={<BuildingIcon />}
        />
        <DashboardKpiCard
          label="Marktwert"
          value={formatEuroMillionsKpi(data.totals.marketValue)}
          sub={`Anschaffung ${formatEuroMillionsKpi(data.totals.acquisitionTotal)}`}
          icon={<LandmarkIcon />}
        />
        <DashboardKpiCard
          label="Restschuld"
          value={formatEuroMillionsKpi(data.totals.remainingDebt)}
          sub={`Kaltmiete p. a. ${formatEuro(data.totals.coldRentAnnual)}`}
          icon={<WalletIcon />}
        />
        <DashboardKpiCard
          label="Eigenkapital"
          value={formatEuroMillionsKpi(data.totals.equity)}
          sub={
            data.totals.grossYieldPct != null
              ? `Bruttorendite ${formatPercent(data.totals.grossYieldPct)}`
              : "Bruttorendite —"
          }
          icon={<TrendingUpIcon />}
          accent
        />
        <DashboardKpiCard
          label="LTV"
          value={formatPercent(data.totals.ltvPct)}
          sub="Beleihungsauslauf"
          icon={<GaugeIcon />}
        />
      </div>

      {/* Hero: Capital-Stack */}
      <DashboardCapitalStack stack={data.capitalStack} />

      {/* Chart-Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardCard
          span={2}
          title="Kaufpreis · Restschuld · Eigenkapital"
          hint="Je Objekt, gestapelt nach Kapitalherkunft"
        >
          {data.capitalByProperty.length > 0 ? (
            <CapitalByPropertyChart data={data.capitalByProperty} />
          ) : (
            <Placeholder message="Noch keine Bewertungen für die gefilterten Objekte." />
          )}
        </DashboardCard>

        <DashboardCard
          title="Marktwert nach Eigentümer"
          hint="Anteilsgewichtet"
        >
          {data.marketValueByOwner.length > 0 ? (
            <OwnerDonutChart data={data.marketValueByOwner} />
          ) : (
            <Placeholder message="Bitte Eigentümer den Objekten zuordnen." />
          )}
        </DashboardCard>

        <DashboardCard
          span={3}
          title="Diversifikation nach Standort"
          hint="Marktwert je Stadt"
        >
          {data.marketValueByCity.length > 0 ? (
            <CityRankingChart data={data.marketValueByCity} />
          ) : (
            <Placeholder message="Noch keine Bewertungen für die gefilterten Objekte." />
          )}
        </DashboardCard>

        <DashboardCard
          span={3}
          title="Kaltmieten & Cashflow im Zeitverlauf"
          hint="Mieteinnahmen sowie Cashflow vor / nach Steuer"
        >
          {data.cashflowOverTime.length > 0 ? (
            <CashflowOverTimeChart
              data={data.cashflowOverTime}
              planCutYear={data.planCutYear}
            />
          ) : (
            <Placeholder message="Mindestens einen Cashflow-Snapshot anlegen — dann läuft die Projektion." />
          )}
        </DashboardCard>

        <DashboardCard
          title="Darlehensfälligkeiten"
          hint="Restschuld bei Ablauf der Zinsbindung"
        >
          {data.loanMaturities.length > 0 ? (
            <LoanMaturitiesChart data={data.loanMaturities} />
          ) : (
            <Placeholder message="Keine Zinsbindungs-Daten in den hinterlegten Darlehen." />
          )}
        </DashboardCard>

        <DashboardCard
          span={2}
          title="Entwicklung Restschuld & Eigenkapital"
          hint="Tilgungsverlauf und Eigenkapitalaufbau (inkl. Plan)"
        >
          {data.debtEquityTimeline.length > 0 ? (
            <DebtEquityTimelineChart
              data={data.debtEquityTimeline}
              planCutYear={data.planCutYear}
            />
          ) : (
            <Placeholder message="Sobald Darlehen + Marktwert hinterlegt sind, läuft die Projektion." />
          )}
        </DashboardCard>

        <DashboardCard
          span={2}
          title="Jährliche AfA im Zeitverlauf"
          hint="Gebäude-AfA und bewegliche Wirtschaftsgüter (inkl. Plan)"
        >
          {data.afaTimeline.length > 0 ? (
            <AfaTimelineChart
              data={data.afaTimeline}
              planCutYear={data.planCutYear}
            />
          ) : (
            <Placeholder message="AfA-Daten fehlen. Bitte Gebäude-Anteil und ggf. bewegliche Güter pflegen." />
          )}
        </DashboardCard>

        <DashboardCard
          title="Investitionsplan — kommende Jahre"
          hint="Sichere und eventuelle Maßnahmen je Planjahr"
        >
          {data.investmentPlan.length > 0 ? (
            <InvestmentPlanChart data={data.investmentPlan} />
          ) : (
            <Placeholder message="Noch keine Investitionen für die kommenden Jahre geplant." />
          )}
        </DashboardCard>
      </div>

      <footer className="text-center text-[11.5px] text-neutral-500 pt-2">
        EstateAbly · Werte ohne Gewähr — keine Steuer- oder Anlageberatung.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hilfskomponenten                                                   */
/* ------------------------------------------------------------------ */

function FactbookButton({
  isPremium,
  hasProperties,
}: {
  isPremium: boolean;
  hasProperties: boolean;
}) {
  const label = "Zum Factbook";

  // Ohne echte Objekte gibt es nichts zu rendern — Button nur zeigen,
  // wenn wenigstens ein reales Objekt da ist. Free-Tier (isPremium=true,
  // 1 Objekt) sieht ihn also; nur der Empty-State-User nicht.
  if (!hasProperties) return null;

  if (!isPremium) {
    // Locked: 2+ Objekte ohne aktives Abo/Trial. Wir zeigen den Button
    // ausgegraut mit einem Link ins Abrechnungs-Menü — dort kann der
    // User direkt upgraden.
    return (
      <Link
        href="/einstellungen/abrechnung"
        aria-disabled="true"
        title="Factbook-Export ist Teil des kostenpflichtigen Tarifs."
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-400 cursor-not-allowed hover:text-neutral-500"
      >
        <LockIcon />
        {label}
      </Link>
    );
  }

  return (
    <a
      href="/api/pdf/factbook/portfolio"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-sm font-semibold shadow-[0_1px_2px_rgba(15,27,46,0.06)] transition-opacity hover:opacity-90"
    >
      <FileDownIcon />
      {label}
    </a>
  );
}

function LockIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function FileDownIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
    </svg>
  );
}

function Placeholder({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-neutral-500 text-center px-4">
      {message}
    </div>
  );
}

function EmptyState({
  greeting,
  workspaceName,
  ctaLabel,
  body,
}: {
  greeting: string;
  workspaceName: string;
  ctaLabel: string;
  body: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {greeting}
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-neutral-500">
          {workspaceName}
        </p>
      </header>
      <section className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent-soft to-transparent p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Legen Sie Ihr erstes Objekt an.
        </h2>
        <p className="mt-2 text-sm text-neutral-700">{body}</p>
        <Link
          href="/objekte/neu"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          {ctaLabel}
        </Link>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers (lokal — keine Wiederverwendung außerhalb dieser Page)     */
/* ------------------------------------------------------------------ */

function deriveFirstName(
  metaName: unknown,
  email: string | null | undefined
): string {
  if (typeof metaName === "string" && metaName.trim().length > 0) {
    return metaName.trim().split(/\s+/)[0];
  }
  if (!email) return "";
  const prefix = email.split("@")[0] ?? "";
  const first = prefix.split(/[._-]/)[0] ?? prefix;
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

function buildStepperSteps(
  t: TFn,
  ob: {
    realPropertyCount: number;
    hasAnyLoan: boolean;
    hasAnyTenant: boolean;
    hasAnySnapshot: boolean;
    firstRealPropertyId: string | null;
  }
): OnboardingStep[] {
  const propertyDone = ob.realPropertyCount > 0;
  const loanDone = propertyDone && ob.hasAnyLoan;
  const tenantOrCashflowDone =
    loanDone && (ob.hasAnyTenant || ob.hasAnySnapshot);
  const factbookDone = tenantOrCashflowDone;
  const states = [propertyDone, loanDone, tenantOrCashflowDone, factbookDone];
  const activeIdx = states.findIndex((s) => !s);
  const stateOf = (i: number): "done" | "active" | "pending" =>
    states[i] ? "done" : i === activeIdx ? "active" : "pending";
  return [
    {
      id: "property",
      label: t("dashboard.step_property"),
      state: stateOf(0),
      href: "/objekte/neu",
    },
    {
      id: "loan",
      label: t("dashboard.step_loan"),
      state: stateOf(1),
      href: ob.firstRealPropertyId
        ? `/objekte/${ob.firstRealPropertyId}/darlehen/neu`
        : "/objekte",
    },
    {
      id: "tenant_or_cashflow",
      label: t("dashboard.step_tenant_or_cashflow"),
      state: stateOf(2),
      href: ob.firstRealPropertyId
        ? `/objekte/${ob.firstRealPropertyId}/mieter`
        : "/objekte",
    },
    {
      id: "factbook",
      label: t("dashboard.step_factbook"),
      state: stateOf(3),
      href: "/api/pdf/factbook/portfolio",
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  KPI-Icons (Inline-SVG — konsistent zum Rest der App)               */
/* ------------------------------------------------------------------ */

const iconCommon = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function BuildingIcon() {
  return (
    <svg {...iconCommon}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
      <path d="M9 22v-4h6v4" />
    </svg>
  );
}

function LandmarkIcon() {
  return (
    <svg {...iconCommon}>
      <path d="M3 21h18M3 10h18M12 2L3 7v3h18V7l-9-5z" />
      <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg {...iconCommon}>
      <path d="M19 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z" />
      <path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4" />
      <circle cx="17" cy="14" r="1.5" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg {...iconCommon}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg {...iconCommon}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 9 9" />
      <path d="M12 12l4-3" />
    </svg>
  );
}
