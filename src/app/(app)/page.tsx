import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { computeValuation } from "@/lib/calculations/valuation";
import { loanBalance } from "@/lib/calculations/loan";
import {
  computeSnapshotResult,
  computeTaxProjection,
  type LoanForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import {
  PortfolioTotalsBar,
  type PortfolioTotalsRow,
} from "@/components/charts/portfolio-totals-bar";
import { DiversificationPie } from "@/components/charts/diversification-pie";
import { CashflowProjectionLine } from "@/components/charts/cashflow-projection-line";

/**
 * Dashboard — strictly portfolio-level. No per-property rows or charts here;
 * those belong on the Objekte / Factbook pages. Goal: clean overview that
 * still works at a glance even for portfolios with 20+ objects.
 */
export default async function DashboardPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: properties }, { data: settings }] = await Promise.all([
    supabase
      .from("properties")
      .select(
        `id, street, postal_code, city, location_detail, description, sqm, land_value, purchase_price, transfer_date,
         transfer_tax, broker_fee, notary_fee, registration_cost, equity_amount,
         building_value_share_pct, depreciation_rate,
         portfolio_valuations(id, valuation_date, market_rent_per_sqm, multiple, building_value, land_value, income_weight),
         loans(loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate,
               special_repayments(payment_date, amount)),
         pnl_snapshots(id, period_start, period_end, cold_rent, ancillary_costs, property_fee_recoverable, property_fee_not_recoverable, maintenance, annuity_override, interest_override, principal_override)`
      )
      .eq("workspace_id", active.id),
    supabase
      .from("settings")
      .select("tax_rate, default_depreciation_rate")
      .eq("workspace_id", active.id)
      .maybeSingle(),
  ]);

  const today = new Date();
  let totalSqm = 0;
  let totalPurchase = 0;
  let totalValue = 0;
  let totalLoans = 0;
  let totalAfterTax = 0;
  let totalColdRentAnnual = 0;

  // Aggregate diversification per city.
  const cityTotals = new Map<string, number>();
  // Aggregate cashflow projection per calendar year across all properties.
  const projectionByYear = new Map<number, number>();
  const projectionYears = Array.from({ length: 30 }, (_, i) => i + 1);

  const settingsForCalc = settings ?? {
    tax_rate: 0.35,
    default_depreciation_rate: 0.02,
  };

  for (const p of properties ?? []) {
    if (p.sqm != null) totalSqm += Number(p.sqm);
    const purchase = p.purchase_price == null ? 0 : Number(p.purchase_price);
    totalPurchase += purchase;

    const valuations =
      (p.portfolio_valuations as unknown as {
        valuation_date: string;
        market_rent_per_sqm: string | number | null;
        multiple: string | number | null;
        building_value: string | number | null;
        land_value: string | number | null;
        income_weight: string | number | null;
      }[]) ?? [];
    const latestVal = valuations
      .slice()
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
    let propertyValue: number | null = null;
    if (latestVal) {
      const r = computeValuation(
        {
          sqm: p.sqm == null ? null : Number(p.sqm),
          marketRentPerSqm:
            latestVal.market_rent_per_sqm == null
              ? null
              : Number(latestVal.market_rent_per_sqm),
          multiple: latestVal.multiple == null ? null : Number(latestVal.multiple),
          landValue:
            latestVal.land_value != null
              ? Number(latestVal.land_value)
              : p.land_value == null
                ? null
                : Number(p.land_value),
          buildingValue:
            latestVal.building_value == null
              ? null
              : Number(latestVal.building_value),
        },
        latestVal.income_weight == null
          ? 0.5
          : Number(latestVal.income_weight)
      );
      if (r.combined != null) {
        propertyValue = r.combined;
        totalValue += r.combined;
      }
    }

    const loans =
      (p.loans as unknown as (LoanForPnL & { id?: string })[]) ?? [];
    for (const l of loans) {
      const r = loanBalance(
        {
          loanAmount: Number(l.loan_amount),
          interestRatePa: Number(l.interest_rate_pa),
          amortizationPa: Number(l.amortization_pa),
          firstPaymentDate: new Date(l.first_payment_date),
          interestShareFirstRate:
            l.interest_share_first_rate == null
              ? null
              : Number(l.interest_share_first_rate),
        },
        today,
        (l.special_repayments ?? []).map((s) => ({
          date: new Date(s.payment_date),
          amount: Number(s.amount),
        }))
      );
      totalLoans += r;
    }

    // Diversification — weight by acquisition (Kaufpreis + NK); fall back
    // to market value if no purchase is recorded. Group rows without a
    // city under "—".
    const ancillary =
      (Number(p.transfer_tax ?? 0) || 0) +
      (Number(p.broker_fee ?? 0) || 0) +
      (Number(p.notary_fee ?? 0) || 0) +
      (Number(p.registration_cost ?? 0) || 0);
    const acquisitionTotal = purchase + ancillary;
    const city = (p.city ?? "").toString().trim() || "—";
    const cityWeight = acquisitionTotal > 0
      ? acquisitionTotal
      : propertyValue ?? 0;
    if (cityWeight > 0) {
      cityTotals.set(city, (cityTotals.get(city) ?? 0) + cityWeight);
    }

    const snaps =
      (p.pnl_snapshots as unknown as SnapshotInputRow[]) ?? [];
    const latestSnap = snaps
      .slice()
      .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
    if (latestSnap) {
      const r = computeSnapshotResult(
        latestSnap,
        p,
        loans,
        settingsForCalc
      );
      totalAfterTax += r.afterTaxCashflow;
      // Annualize the latest snapshot's cold rent for the gross-yield KPI.
      const coldRentMonthly = Number(latestSnap.cold_rent ?? 0) || 0;
      totalColdRentAnnual += coldRentMonthly * 12;

      // Build per-year projection for this property and aggregate.
      const proj = computeTaxProjection({
        snapshot: latestSnap,
        property: p,
        loans,
        settings: settingsForCalc,
        years: projectionYears,
      });
      for (const row of proj) {
        projectionByYear.set(
          row.calendarYear,
          (projectionByYear.get(row.calendarYear) ?? 0) + row.afterTaxCashflow
        );
      }
    }
  }

  const totalsBarRows: PortfolioTotalsRow[] = [
    {
      key: "purchase",
      label: t("portfolio.kpi_purchase_total_short"),
      value: totalPurchase,
    },
    {
      key: "remaining",
      label: t("portfolio.kpi_remaining_loans_short"),
      value: totalLoans,
    },
    {
      key: "equity",
      label: t("portfolio.kpi_equity_short"),
      value: Math.max(0, totalValue - totalLoans),
    },
  ];

  const pieData = Array.from(cityTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const projectionData = Array.from(projectionByYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, afterTax]) => ({ year, afterTax }));

  const grossYieldPct =
    totalPurchase > 0 ? (totalColdRentAnnual / totalPurchase) * 100 : null;
  const ltvPct =
    totalValue > 0 ? (totalLoans / totalValue) * 100 : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("nav.dashboard")}
        </h1>
        <div className="flex items-center gap-3">
          <a
            href="/api/pdf/factbook/portfolio"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {t("factsheet.download_factbook")}
          </a>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {active.name}
          </p>
        </div>
      </div>

      {/* Portfolio KPI grid — kept tight so it still reads cleanly with many objects. */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi
          label={t("portfolio.kpi_objects")}
          value={String((properties ?? []).length)}
        />
        <Kpi
          label={t("portfolio.kpi_sqm")}
          value={totalSqm.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
        />
        <Kpi
          label={t("portfolio.kpi_purchase_total")}
          value={eur(totalPurchase)}
        />
        <Kpi label={t("portfolio.kpi_value_combined")} value={eur(totalValue)} />
        <Kpi label={t("portfolio.kpi_remaining_loans")} value={eur(totalLoans)} />
        <Kpi
          label={t("portfolio.kpi_equity")}
          value={eur(totalValue - totalLoans)}
          strong
        />
        <Kpi
          label={t("portfolio.kpi_gross_yield")}
          value={grossYieldPct != null ? `${grossYieldPct.toFixed(2)} %` : "—"}
        />
        <Kpi
          label={t("portfolio.kpi_ltv")}
          value={ltvPct != null ? `${ltvPct.toFixed(1)} %` : "—"}
        />
      </div>

      <div className="mt-3">
        <Kpi
          label={t("portfolio.kpi_cashflow_after_tax")}
          value={eur(totalAfterTax)}
          strong
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieData.length > 0 ? (
          <DiversificationPie
            data={pieData}
            title={t("portfolio.diversification_city")}
          />
        ) : (
          <ChartPlaceholder
            title={t("portfolio.diversification_city")}
            message={t("portfolio.no_purchase_data")}
          />
        )}
        {totalPurchase > 0 || totalLoans > 0 ? (
          <PortfolioTotalsBar
            data={totalsBarRows}
            title={t("portfolio.totals_bar_title")}
          />
        ) : (
          <ChartPlaceholder
            title={t("portfolio.totals_bar_title")}
            message={t("portfolio.no_purchase_data")}
          />
        )}
      </div>

      <div className="mt-4">
        {projectionData.length > 0 ? (
          <CashflowProjectionLine
            data={projectionData}
            title={t("portfolio.cashflow_projection_title")}
          />
        ) : (
          <ChartPlaceholder
            title={t("portfolio.cashflow_projection_title")}
            message={t("pnl.no_snapshots")}
          />
        )}
      </div>

      <div className="mt-6">
        <Link
          href="/objekte"
          className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
        >
          {t("properties.title")} →
        </Link>
      </div>
    </div>
  );
}

function ChartPlaceholder({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {message}
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-1 tabular-nums ${strong ? "text-lg font-semibold" : "text-sm"}`}
      >
        {value}
      </div>
    </div>
  );
}

function eur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
