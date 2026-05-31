import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import {
  computeSnapshotBankView,
  computeSnapshotKPIs,
  computeSnapshotResult,
  computeTaxProjection,
  type LoanForPnL,
  type PropertyForPnL,
  type SettingsForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { loanBalance } from "@/lib/calculations/loan";
import { computeValuation } from "@/lib/calculations/valuation";
import { SnapshotForm } from "./snapshot-form";
import { buildDefaultsFromTenant } from "./snapshot-defaults";
import { deleteSnapshot } from "./actions";
import { TaxProjectionCard } from "./tax-projection-card";
import { SnapshotItem } from "./snapshot-item";

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default async function PropertyPnLPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [
    { data: property },
    { data: snapshots },
    { data: loans },
    { data: settings },
    { data: valuations },
    { data: tenant },
    { data: investments },
  ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("pnl_snapshots")
      .select("*")
      .eq("property_id", id)
      .order("period_start", { ascending: false }),
    supabase
      .from("loans")
      .select(
        "loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate, rate_lock_until, special_repayments(payment_date, amount)"
      )
      .eq("property_id", id),
    supabase
      .from("settings")
      .select(
        "tax_rate, default_depreciation_rate, cashflow_convention, default_vacancy_residential, default_vacancy_commercial, default_management_per_unit, bank_maintenance_per_sqm, degressive_7v_rate, sonder_7b_rate, sonder_7b_years, sonder_7b_linear_rate"
      )
      .eq("workspace_id", active.id)
      .maybeSingle(),
    supabase
      .from("portfolio_valuations")
      .select("*")
      .eq("property_id", id)
      .order("valuation_date", { ascending: false })
      .limit(1),
    supabase
      .from("tenants")
      .select("cold_rent_per_month, ancillary_costs_per_month")
      .eq("property_id", id)
      .maybeSingle(),
    supabase
      .from("investment_plans")
      .select(
        "year, is_long_term, amount, tax_treatment, expense_82b_years, useful_life_years"
      )
      .eq("property_id", id),
  ]);

  if (!property) notFound();

  const propertyForCalc: PropertyForPnL = property;
  const loansForCalc: LoanForPnL[] = (loans ?? []) as LoanForPnL[];
  const settingsForCalc: SettingsForPnL = settings ?? {
    tax_rate: 0.35,
    default_depreciation_rate: 0.02,
  };

  // Sum of remaining loans today (€) — for LTV.
  const today = new Date();
  let remainingLoans = 0;
  for (const l of loansForCalc) {
    remainingLoans += loanBalance(
      {
        loanAmount: Number(l.loan_amount),
        interestRatePa: Number(l.interest_rate_pa),
        amortizationPa: Number(l.amortization_pa),
        firstPaymentDate: new Date(l.first_payment_date),
        interestShareFirstRate:
          l.interest_share_first_rate == null ? null : Number(l.interest_share_first_rate),
      },
      today,
      (l.special_repayments ?? []).map((s) => ({
        date: new Date(s.payment_date),
        amount: Number(s.amount),
      }))
    );
  }

  // Latest valuation → market value (Bruttofaktor + Reproduktionsneuwert,
  // gewichtet gemäß der gespeicherten income_weight der Bewertung).
  let marketValue: number | null = null;
  let marketValueDate: string | null = null;
  const latestVal = valuations?.[0];
  if (latestVal) {
    const incomeWeight =
      latestVal.income_weight == null ? 0.5 : Number(latestVal.income_weight);
    const v = computeValuation(
      {
        sqm: num(property.sqm) || null,
        marketRentPerSqm: num(latestVal.market_rent_per_sqm) || null,
        multiple: num(latestVal.multiple) || null,
        landValue:
          num(latestVal.land_value) ?? (num(property.land_value) || null),
        buildingValue: num(latestVal.building_value) || null,
      },
      incomeWeight
    );
    marketValue = v.combined ?? null;
    marketValueDate = latestVal.valuation_date ?? null;
  }

  // Earliest rate-lock end (used by the stress-test hint).
  let earliestRateLock: string | null = null;
  for (const l of loansForCalc) {
    if (l.rate_lock_until) {
      if (earliestRateLock == null || l.rate_lock_until < earliestRateLock) {
        earliestRateLock = l.rate_lock_until;
      }
    }
  }

  const editable = canEdit(active.role);

  // Pre-fill the new-snapshot form with Kaltmiete + NK from the tenant. The
  // user can still override per period, but in the common case the snapshot
  // just adopts whatever lease is currently in place.
  const snapshotDefaults = buildDefaultsFromTenant(
    new Date(Date.UTC(today.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10),
    new Date(Date.UTC(today.getUTCFullYear(), 11, 31)).toISOString().slice(0, 10),
    tenant
  );

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("pnl.title")}
      </h1>

      <div className="mt-8 space-y-6">
        {(snapshots ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("pnl.no_snapshots")}
          </p>
        ) : (
          (snapshots ?? []).map((s) => {
            const row = s as SnapshotInputRow & {
              id: string;
              notes: string | null;
            };
            const investor = computeSnapshotResult(
              row,
              propertyForCalc,
              loansForCalc,
              settingsForCalc
            );
            const bank = computeSnapshotBankView(
              row,
              propertyForCalc,
              loansForCalc,
              settingsForCalc
            );
            const bankStressed = computeSnapshotBankView(
              row,
              propertyForCalc,
              loansForCalc,
              settingsForCalc,
              { stressBps: 250 }
            );
            const annualColdRent = investor.coldRentTotal * (12 / investor.months);
            const annualNetOperating =
              ((investor.hausgeldNonRecoverable +
                investor.reserveContribution +
                investor.managementTotal +
                investor.vacancyLoss) *
                12) /
              investor.months;
            const kpis = computeSnapshotKPIs({
              property: propertyForCalc,
              annualColdRent,
              annualNetOperatingCosts: annualNetOperating,
              remainingLoans,
              marketValue,
            });

            const rowDefaults = {
              period_start: row.period_start,
              period_end: row.period_end,
              cold_rent: row.cold_rent == null ? "" : String(row.cold_rent).replace(".", ","),
              ancillary_costs:
                row.ancillary_costs == null ? "" : String(row.ancillary_costs).replace(".", ","),
              property_fee_recoverable:
                row.property_fee_recoverable == null
                  ? ""
                  : String(row.property_fee_recoverable).replace(".", ","),
              property_fee_not_recoverable:
                row.property_fee_not_recoverable == null
                  ? ""
                  : String(row.property_fee_not_recoverable).replace(".", ","),
              maintenance:
                row.maintenance == null ? "" : String(row.maintenance).replace(".", ","),
              management_costs:
                row.management_costs == null ? "" : String(row.management_costs).replace(".", ","),
              vacancy_risk_amount:
                row.vacancy_risk_amount == null
                  ? ""
                  : String(row.vacancy_risk_amount).replace(".", ","),
              annuity_override:
                row.annuity_override == null ? "" : String(row.annuity_override).replace(".", ","),
              interest_override:
                row.interest_override == null
                  ? ""
                  : String(row.interest_override).replace(".", ","),
              principal_override:
                row.principal_override == null
                  ? ""
                  : String(row.principal_override).replace(".", ","),
              notes: row.notes ?? "",
            };
            return (
              <SnapshotItem
                key={row.id}
                propertyId={id}
                snapshotId={row.id}
                defaults={rowDefaults}
                canEdit={editable}
                periodStart={row.period_start}
                periodEnd={row.period_end}
                investor={investor}
                bank={bank}
                bankStressed={bankStressed}
                kpis={kpis}
                ltvContext={{
                  remainingLoans,
                  marketValue,
                  marketValueDate,
                }}
                rateLockUntil={earliestRateLock}
                deleteSlot={
                  editable ? (
                    <form action={deleteSnapshot.bind(null, row.id, id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        {t("pnl.delete_snapshot")}
                      </button>
                    </form>
                  ) : null
                }
              />
            );
          })
        )}
      </div>

      {(snapshots ?? []).length > 0 && (
        <div className="mt-10">
          {(() => {
            // Latest snapshot drives the projection (status quo).
            const latest = (snapshots ?? [])[0] as SnapshotInputRow;
            const rows = computeTaxProjection({
              snapshot: latest,
              property: propertyForCalc,
              loans: loansForCalc,
              settings: settingsForCalc,
              investments: (investments ?? []).map((i) => ({
                year: i.year,
                is_long_term: i.is_long_term,
                amount: i.amount,
                tax_treatment: i.tax_treatment,
                expense_82b_years: i.expense_82b_years,
                useful_life_years: i.useful_life_years,
              })),
            });
            return <TaxProjectionCard rows={rows} />;
          })()}
        </div>
      )}

      {editable && (
        <div className="mt-12 max-w-3xl">
          <h2 className="text-lg font-semibold mb-4">{t("pnl.new_snapshot")}</h2>
          <SnapshotForm propertyId={id} defaults={snapshotDefaults} />
        </div>
      )}
    </div>
  );
}
