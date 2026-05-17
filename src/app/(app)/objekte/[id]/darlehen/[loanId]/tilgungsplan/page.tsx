import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import {
  generateSchedule,
  type LoanInput,
} from "@/lib/calculations/loan";

export default async function AmortizationPlanPage({
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
      .select("payment_date, amount")
      .eq("loan_id", loanId)
      .order("payment_date"),
  ]);

  if (!loan) notFound();

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

  // Generate schedule until balance reaches 0 or 50-year safety horizon.
  const safetyHorizon = new Date(
    Date.UTC(
      loanInput.firstPaymentDate.getUTCFullYear() + 50,
      loanInput.firstPaymentDate.getUTCMonth(),
      1
    )
  );
  const schedule = generateSchedule(loanInput, {
    untilDate: safetyHorizon,
    specialRepayments: (specials ?? []).map((s) => ({
      date: new Date(s.payment_date),
      amount: Number(s.amount),
    })),
  });

  // Aggregate by calendar year.
  type YearRow = {
    year: number;
    interest: number;
    principal: number;
    specialRepayment: number;
    payment: number;
    balance: number;
  };
  const yearMap = new Map<number, YearRow>();
  for (const e of schedule) {
    const y = e.date.getUTCFullYear();
    const cur =
      yearMap.get(y) ??
      ({
        year: y,
        interest: 0,
        principal: 0,
        specialRepayment: 0,
        payment: 0,
        balance: 0,
      } as YearRow);
    cur.interest += e.interest;
    cur.principal += e.principal;
    cur.specialRepayment += e.specialRepayment;
    cur.payment += e.payment;
    cur.balance = e.balance; // last entry wins → year-end balance
    yearMap.set(y, cur);
  }
  const years = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);

  const totals = years.reduce(
    (acc, y) => ({
      interest: acc.interest + y.interest,
      principal: acc.principal + y.principal,
      specialRepayment: acc.specialRepayment + y.specialRepayment,
      payment: acc.payment + y.payment,
    }),
    { interest: 0, principal: 0, specialRepayment: 0, payment: 0 }
  );

  return (
    <div>
      <Link
        href={`/objekte/${id}/darlehen/${loanId}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {loan.designation}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("loans.amortization_plan_title")}
      </h1>

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr className="text-left">
              <Th>{t("loans.year")}</Th>
              <Th right>{t("loans.yearly_payment")}</Th>
              <Th right>{t("loans.yearly_interest")}</Th>
              <Th right>{t("loans.yearly_principal")}</Th>
              <Th right>{t("loans.yearly_special_repayment")}</Th>
              <Th right>{t("loans.year_end_balance")}</Th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr
                key={y.year}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <Td>{y.year}</Td>
                <Td right>{eur(y.payment)}</Td>
                <Td right>{eur(y.interest)}</Td>
                <Td right>{eur(y.principal)}</Td>
                <Td right>
                  {y.specialRepayment > 0 ? eur(y.specialRepayment) : "—"}
                </Td>
                <Td right strong>
                  {eur(y.balance)}
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-neutral-50 dark:bg-neutral-900 border-t-2 border-neutral-300 dark:border-neutral-700">
            <tr>
              <Td strong>Σ</Td>
              <Td right strong>
                {eur(totals.payment)}
              </Td>
              <Td right strong>
                {eur(totals.interest)}
              </Td>
              <Td right strong>
                {eur(totals.principal)}
              </Td>
              <Td right strong>
                {totals.specialRepayment > 0 ? eur(totals.specialRepayment) : "—"}
              </Td>
              <Td right>—</Td>
            </tr>
          </tfoot>
        </table>
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

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  strong,
}: {
  children: React.ReactNode;
  right?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-4 py-2 align-middle tabular-nums ${right ? "text-right" : ""} ${
        strong ? "font-semibold" : ""
      }`}
    >
      {children}
    </td>
  );
}
