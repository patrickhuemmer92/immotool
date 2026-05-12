import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { computeValuation } from "@/lib/calculations/valuation";
import { loanBalance } from "@/lib/calculations/loan";

export default async function PortfolioPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select(
      `id, street, postal_code, city, location_detail, description, sqm, land_value, purchase_price,
       portfolio_valuations(id, valuation_date, market_rent_per_sqm, multiple, building_value),
       loans(loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate,
             special_repayments(payment_date, amount))`
    )
    .eq("workspace_id", active.id)
    .order("city")
    .order("street");

  const today = new Date();

  type Row = {
    id: string;
    label: string;
    purchase: number;
    combinedValue: number | null;
    remainingLoans: number;
    equity: number | null;
  };

  let totalPurchase = 0;
  let totalValue = 0;
  let totalLoans = 0;
  let totalSqm = 0;

  const rows: Row[] = [];
  for (const p of properties ?? []) {
    const valuations =
      (p.portfolio_valuations as unknown as {
        valuation_date: string;
        market_rent_per_sqm: string | number | null;
        multiple: string | number | null;
        building_value: string | number | null;
      }[]) ?? [];
    const latest = valuations
      .slice()
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];

    let combined: number | null = null;
    if (latest) {
      const r = computeValuation({
        sqm: p.sqm == null ? null : Number(p.sqm),
        marketRentPerSqm:
          latest.market_rent_per_sqm == null
            ? null
            : Number(latest.market_rent_per_sqm),
        multiple: latest.multiple == null ? null : Number(latest.multiple),
        landValue: p.land_value == null ? null : Number(p.land_value),
        buildingValue:
          latest.building_value == null ? null : Number(latest.building_value),
      });
      combined = r.combined;
    }

    const loans =
      (p.loans as unknown as {
        loan_amount: string | number;
        interest_rate_pa: string | number;
        amortization_pa: string | number;
        first_payment_date: string;
        interest_share_first_rate: string | number | null;
        special_repayments: { payment_date: string; amount: string | number }[];
      }[]) ?? [];
    let remaining = 0;
    for (const l of loans) {
      remaining += loanBalance(
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
    }

    const purchase = p.purchase_price == null ? 0 : Number(p.purchase_price);
    const equity = combined == null ? null : combined - remaining;

    totalPurchase += purchase;
    if (combined != null) totalValue += combined;
    totalLoans += remaining;
    if (p.sqm != null) totalSqm += Number(p.sqm);

    rows.push({
      id: p.id,
      label: formatPropertyAddress(p),
      purchase,
      combinedValue: combined,
      remainingLoans: remaining,
      equity,
    });
  }

  const totalEquity = totalValue - totalLoans;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("portfolio.title")}
        </h1>
        <a
          href="/api/pdf/factbook/portfolio"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {t("factsheet.download_factbook")}
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label={t("portfolio.kpi_objects")} value={String(rows.length)} />
        <Kpi
          label={t("portfolio.kpi_sqm")}
          value={totalSqm.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
        />
        <Kpi label={t("portfolio.kpi_purchase_total")} value={eur(totalPurchase)} />
        <Kpi label={t("portfolio.kpi_value_combined")} value={eur(totalValue)} />
        <Kpi label={t("portfolio.kpi_remaining_loans")} value={eur(totalLoans)} />
        <Kpi
          label={t("portfolio.kpi_equity")}
          value={eur(totalEquity)}
          strong
        />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr className="text-left">
              <Th>{t("properties.title")}</Th>
              <Th>{t("properties.purchase_price")}</Th>
              <Th>{t("valuation.combined")}</Th>
              <Th>{t("loans.remaining_balance")}</Th>
              <Th>{t("portfolio.kpi_equity")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <Td>
                  <Link
                    href={`/objekte/${r.id}`}
                    className="hover:underline"
                  >
                    {r.label}
                  </Link>
                </Td>
                <Td>{eur(r.purchase)}</Td>
                <Td>{r.combinedValue == null ? "—" : eur(r.combinedValue)}</Td>
                <Td>{eur(r.remainingLoans)}</Td>
                <Td className="font-semibold">
                  {r.equity == null ? "—" : eur(r.equity)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 align-middle tabular-nums ${className ?? ""}`}>
      {children}
    </td>
  );
}
