import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { RestschuldCalculator, type LoanForCalc } from "./restschuld-calculator";

export default async function RestschuldPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const { date } = await searchParams;
  const supabase = await createClient();

  const { data: loans } = await supabase
    .from("loans")
    .select(
      `id, designation, bank, loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate,
       property:properties!inner(id, street, postal_code, city, location_detail, description, workspace_id),
       special_repayments(payment_date, amount)`
    )
    .eq("property.workspace_id", active.id)
    .order("first_payment_date");

  const loansForCalc: LoanForCalc[] = (loans ?? []).map((l) => {
    const prop = l.property as unknown as {
      id: string;
      street: string;
      postal_code: string;
      city: string;
      location_detail: string | null;
      description: string | null;
    };
    return {
      id: l.id,
      designation: l.designation,
      bank: l.bank,
      property: {
        id: prop.id,
        label: [
          prop.street,
          `${prop.postal_code} ${prop.city}`,
          prop.location_detail,
          prop.description,
        ]
          .filter(Boolean)
          .join(", "),
      },
      loanAmount: Number(l.loan_amount),
      interestRatePa: Number(l.interest_rate_pa),
      amortizationPa: Number(l.amortization_pa),
      firstPaymentDate: l.first_payment_date,
      interestShareFirstRate:
        l.interest_share_first_rate != null
          ? Number(l.interest_share_first_rate)
          : null,
      specialRepayments: ((l.special_repayments as unknown) as {
        payment_date: string;
        amount: string | number;
      }[] | null ?? []).map((s) => ({
        date: s.payment_date,
        amount: Number(s.amount),
      })),
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("loans.remaining_at_date")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("loans.remaining_balance")}
      </p>

      <div className="mt-6">
        <RestschuldCalculator loans={loansForCalc} initialDate={date ?? ""} />
      </div>
    </div>
  );
}
