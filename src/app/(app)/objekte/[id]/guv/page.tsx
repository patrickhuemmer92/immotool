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
  type LoanForPnL,
  type PropertyForPnL,
  type SettingsForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { loanBalance } from "@/lib/calculations/loan";
import { computeValuation } from "@/lib/calculations/valuation";
import { SnapshotForm } from "./snapshot-form";
import { deleteSnapshot } from "./actions";
import { CashflowResultCard } from "./cashflow-result-card";

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
        "tax_rate, default_depreciation_rate, cashflow_convention, default_vacancy_residential, default_vacancy_commercial, default_management_per_unit, bank_maintenance_per_sqm"
      )
      .eq("workspace_id", active.id)
      .maybeSingle(),
    supabase
      .from("portfolio_valuations")
      .select("*")
      .eq("property_id", id)
      .order("valuation_date", { ascending: false })
      .limit(1),
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

  // Latest valuation → market value (Sachwert + Ertragswert kombiniert).
  let marketValue: number | null = null;
  const latestVal = valuations?.[0];
  if (latestVal) {
    const v = computeValuation({
      sqm: num(property.sqm) || null,
      marketRentPerSqm: num(latestVal.market_rent_per_sqm) || null,
      multiple: num(latestVal.multiple) || null,
      landValue: num(property.land_value) || null,
      buildingValue: num(latestVal.building_value) || null,
    });
    marketValue = v.combined ?? null;
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

  const snapshotDefaults = {
    period_start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
      .toISOString()
      .slice(0, 10),
    period_end: new Date(Date.UTC(today.getUTCFullYear(), 11, 31))
      .toISOString()
      .slice(0, 10),
  };

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
            const row = s as SnapshotInputRow & { id: string };
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

            return (
              <CashflowResultCard
                key={row.id}
                periodStart={row.period_start}
                periodEnd={row.period_end}
                investor={investor}
                bank={bank}
                bankStressed={bankStressed}
                kpis={kpis}
                rateLockUntil={earliestRateLock}
                onDelete={
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

      {editable && (
        <div className="mt-12 max-w-3xl">
          <h2 className="text-lg font-semibold mb-4">{t("pnl.new_snapshot")}</h2>
          <SnapshotForm propertyId={id} defaults={snapshotDefaults} />
        </div>
      )}
    </div>
  );
}
