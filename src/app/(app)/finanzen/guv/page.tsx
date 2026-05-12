import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import {
  computeSnapshotResult,
  type LoanForPnL,
  type PropertyForPnL,
  type SettingsForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { formatPropertyAddress } from "@/lib/properties";

type SnapshotRow = SnapshotInputRow & {
  id: string;
  property_id: string;
  property: PropertyForPnL & {
    id: string;
    street: string;
    postal_code: string;
    city: string;
    location_detail: string | null;
    description: string | null;
    workspace_id: string;
  };
  loans: LoanForPnL[];
};

export default async function PortfolioPnLPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();

  const [{ data: properties }, { data: settings }] = await Promise.all([
    supabase
      .from("properties")
      .select(
        `id, street, postal_code, city, location_detail, description,
         purchase_price, building_value_share_pct, land_value, depreciation_rate,
         loans(loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate, special_repayments(payment_date, amount)),
         pnl_snapshots(id, period_start, period_end, cold_rent, ancillary_costs, property_fee_recoverable, property_fee_not_recoverable, maintenance, annuity_override, interest_override, principal_override)`
      )
      .eq("workspace_id", active.id)
      .order("city")
      .order("street"),
    supabase
      .from("settings")
      .select("tax_rate, default_depreciation_rate")
      .eq("workspace_id", active.id)
      .maybeSingle(),
  ]);

  const settingsForCalc: SettingsForPnL = settings ?? {
    tax_rate: 0.35,
    default_depreciation_rate: 0.02,
  };

  type Row = {
    propertyId: string;
    label: string;
    period: string;
    cashflowBeforeTax: number;
    afterTaxCashflow: number;
    rentTotal: number;
    operatingCosts: number;
    interest: number;
    depreciation: number;
  };

  const rows: Row[] = [];
  for (const p of properties ?? []) {
    const snapshots = (p.pnl_snapshots as unknown as SnapshotRow[]) ?? [];
    if (snapshots.length === 0) {
      rows.push({
        propertyId: p.id,
        label: formatPropertyAddress(p),
        period: "—",
        cashflowBeforeTax: 0,
        afterTaxCashflow: 0,
        rentTotal: 0,
        operatingCosts: 0,
        interest: 0,
        depreciation: 0,
      });
      continue;
    }
    const latest = snapshots
      .slice()
      .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
    const result = computeSnapshotResult(
      latest,
      p as unknown as PropertyForPnL,
      ((p.loans as unknown) as LoanForPnL[]) ?? [],
      settingsForCalc
    );
    rows.push({
      propertyId: p.id,
      label: formatPropertyAddress(p),
      period: `${latest.period_start} – ${latest.period_end}`,
      cashflowBeforeTax: result.cashflowBeforeTax,
      afterTaxCashflow: result.afterTaxCashflow,
      rentTotal: result.rentTotal,
      operatingCosts: result.operatingCosts,
      interest: result.interest,
      depreciation: result.depreciation,
    });
  }

  const totals = rows.reduce(
    (acc, r) => ({
      rentTotal: acc.rentTotal + r.rentTotal,
      operatingCosts: acc.operatingCosts + r.operatingCosts,
      interest: acc.interest + r.interest,
      depreciation: acc.depreciation + r.depreciation,
      cashflowBeforeTax: acc.cashflowBeforeTax + r.cashflowBeforeTax,
      afterTaxCashflow: acc.afterTaxCashflow + r.afterTaxCashflow,
    }),
    {
      rentTotal: 0,
      operatingCosts: 0,
      interest: 0,
      depreciation: 0,
      cashflowBeforeTax: 0,
      afterTaxCashflow: 0,
    }
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("pnl.title")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("pnl.portfolio_table")}
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr className="text-left">
              <Th>{t("properties.title")}</Th>
              <Th>{t("pnl.section_result")}</Th>
              <Th>{t("pnl.rent_total")}</Th>
              <Th>{t("pnl.operating_costs")}</Th>
              <Th>{t("pnl.interest")}</Th>
              <Th>{t("pnl.depreciation")}</Th>
              <Th>{t("pnl.cashflow_before_tax")}</Th>
              <Th>{t("pnl.after_tax_cashflow")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.propertyId}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <Td>
                  <Link
                    href={`/objekte/${r.propertyId}/guv`}
                    className="hover:underline"
                  >
                    {r.label}
                  </Link>
                </Td>
                <Td className="text-xs text-neutral-500">{r.period}</Td>
                <Td>{eur(r.rentTotal)}</Td>
                <Td>{eur(-r.operatingCosts)}</Td>
                <Td>{eur(-r.interest)}</Td>
                <Td className="text-neutral-500">{eur(-r.depreciation)}</Td>
                <Td className="font-semibold">{eur(r.cashflowBeforeTax)}</Td>
                <Td className="font-semibold">{eur(r.afterTaxCashflow)}</Td>
              </tr>
            ))}
            <tr className="border-t-2 border-neutral-300 dark:border-neutral-700 font-semibold bg-neutral-50 dark:bg-neutral-900/50">
              <Td>Σ</Td>
              <Td></Td>
              <Td>{eur(totals.rentTotal)}</Td>
              <Td>{eur(-totals.operatingCosts)}</Td>
              <Td>{eur(-totals.interest)}</Td>
              <Td className="text-neutral-500">{eur(-totals.depreciation)}</Td>
              <Td>{eur(totals.cashflowBeforeTax)}</Td>
              <Td>{eur(totals.afterTaxCashflow)}</Td>
            </tr>
          </tbody>
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
