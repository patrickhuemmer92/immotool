import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit, isOwner } from "@/lib/workspace";
import {
  generateSchedule,
  monthlyAnnuity,
  type LoanInput,
} from "@/lib/calculations/loan";
import { LoanForm, type LoanDefaults } from "../loan-form";
import { LoanScheduleChart, type ScheduleSeriesPoint } from "@/components/charts/loan-schedule-chart";
import { SpecialRepaymentsForm } from "./special-repayments-form";
import { deleteLoan } from "../loan-actions";

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string; loanId: string }>;
}) {
  const { id, loanId } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: loan }, { data: specials }] = await Promise.all([
    supabase.from("loans").select("*").eq("id", loanId).maybeSingle(),
    supabase
      .from("special_repayments")
      .select("id, payment_date, amount, description")
      .eq("loan_id", loanId)
      .order("payment_date"),
  ]);

  if (!loan) notFound();

  const readOnly = !canEdit(active.role);

  const defaults: LoanDefaults = {
    designation: loan.designation,
    bank: loan.bank ?? "",
    loan_number: loan.loan_number ?? "",
    disbursement_date: loan.disbursement_date,
    loan_amount: String(loan.loan_amount),
    interest_rate_pa: String(loan.interest_rate_pa),
    amortization_pa: String(loan.amortization_pa),
    first_payment_date: loan.first_payment_date,
    rate_lock_until: loan.rate_lock_until ?? "",
    interest_share_first_rate:
      loan.interest_share_first_rate != null
        ? String(loan.interest_share_first_rate)
        : "",
    notes: loan.notes ?? "",
  };

  const loanInput: LoanInput = {
    loanAmount: Number(loan.loan_amount),
    interestRatePa: Number(loan.interest_rate_pa),
    amortizationPa: Number(loan.amortization_pa),
    firstPaymentDate: new Date(loan.first_payment_date),
    interestShareFirstRate:
      loan.interest_share_first_rate != null
        ? Number(loan.interest_share_first_rate)
        : null,
  };

  const annuity = monthlyAnnuity(loanInput);
  const monthlyInterestSeed =
    loanInput.loanAmount * (loanInput.interestRatePa / 12);
  const monthlyPrincipalSeed = annuity - monthlyInterestSeed;

  const scheduleHorizonYears = 35;
  const horizonDate = new Date(
    Date.UTC(
      loanInput.firstPaymentDate.getUTCFullYear() + scheduleHorizonYears,
      loanInput.firstPaymentDate.getUTCMonth(),
      1
    )
  );

  const fullSchedule = generateSchedule(loanInput, {
    untilDate: horizonDate,
    specialRepayments: (specials ?? []).map((s) => ({
      date: new Date(s.payment_date),
      amount: Number(s.amount),
    })),
  });

  const yearMap = new Map<number, ScheduleSeriesPoint>();
  let interestCum = 0;
  for (const e of fullSchedule) {
    interestCum += e.interest;
    const year = e.date.getUTCFullYear();
    yearMap.set(year, {
      year,
      balance: Math.round(e.balance * 100) / 100,
      interestCum: Math.round(interestCum * 100) / 100,
    });
  }
  const seriesData = Array.from(yearMap.values());

  return (
    <div>
      <Link
        href={`/objekte/${id}/darlehen`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("loans.title")}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {loan.designation}
        </h1>
        {isOwner(active.role) && (
          <form action={deleteLoan.bind(null, loanId, id)}>
            <button
              type="submit"
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              {t("common.delete")}
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 max-w-3xl">
        <Stat
          label={t("loans.annuity")}
          value={annuity.toLocaleString(undefined, {
            style: "currency",
            currency: "EUR",
          })}
        />
        <Stat
          label={t("loans.monthly_interest")}
          value={monthlyInterestSeed.toLocaleString(undefined, {
            style: "currency",
            currency: "EUR",
          })}
        />
        <Stat
          label={t("loans.monthly_principal")}
          value={monthlyPrincipalSeed.toLocaleString(undefined, {
            style: "currency",
            currency: "EUR",
          })}
        />
      </div>

      <div className="mt-8 max-w-3xl">
        <LoanForm
          propertyId={id}
          loanId={loanId}
          defaults={defaults}
          readOnly={readOnly}
        />
      </div>

      <div className="mt-12 max-w-3xl">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
          {t("loans.special_repayments")}
        </h2>
        <SpecialRepaymentsForm
          propertyId={id}
          loanId={loanId}
          specials={(specials ?? []).map((s) => ({
            id: s.id,
            payment_date: s.payment_date,
            amount: String(s.amount),
            description: s.description ?? "",
          }))}
          readOnly={readOnly}
        />
      </div>

      <div className="mt-12">
        <LoanScheduleChart data={seriesData} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
