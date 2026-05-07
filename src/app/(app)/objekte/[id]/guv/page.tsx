import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import {
  computeSnapshotResult,
  type LoanForPnL,
  type PropertyForPnL,
  type SettingsForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { SnapshotForm } from "./snapshot-form";
import { deleteSnapshot } from "./actions";

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
        "loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate, special_repayments(payment_date, amount)"
      )
      .eq("property_id", id),
    supabase
      .from("settings")
      .select("tax_rate, default_depreciation_rate")
      .eq("workspace_id", active.id)
      .maybeSingle(),
  ]);

  if (!property) notFound();

  const propertyForCalc: PropertyForPnL = property;
  const loansForCalc: LoanForPnL[] = (loans ?? []) as LoanForPnL[];
  const settingsForCalc: SettingsForPnL = settings ?? {
    tax_rate: 0.35,
    default_depreciation_rate: 0.02,
  };

  const editable = canEdit(active.role);

  const today = new Date();
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
            const result = computeSnapshotResult(
              s as SnapshotInputRow,
              propertyForCalc,
              loansForCalc,
              settingsForCalc
            );
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {s.period_start} – {s.period_end}
                  </h3>
                  {editable && (
                    <form action={deleteSnapshot.bind(null, s.id, id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        {t("pnl.delete_snapshot")}
                      </button>
                    </form>
                  )}
                </div>
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    <ResultRow label={t("pnl.rent_total")} value={result.rentTotal} />
                    <ResultRow
                      label={t("pnl.operating_costs")}
                      value={-result.operatingCosts}
                    />
                    <ResultRow
                      label={t("pnl.interest")}
                      value={-result.interest}
                      tag={result.source.interest}
                    />
                    <ResultRow
                      label={t("pnl.principal")}
                      value={-result.principal}
                      tag={result.source.principal}
                    />
                    <ResultRow
                      label={t("pnl.cashflow_before_tax")}
                      value={result.cashflowBeforeTax}
                      strong
                    />
                    <ResultRow
                      label={t("pnl.depreciation")}
                      value={-result.depreciation}
                      muted
                    />
                    <ResultRow
                      label={t("pnl.pretax_profit")}
                      value={result.pretaxProfit}
                      muted
                    />
                    <ResultRow
                      label={t("pnl.tax_effect")}
                      value={-result.taxEffect}
                    />
                    <ResultRow
                      label={t("pnl.after_tax_cashflow")}
                      value={result.afterTaxCashflow}
                      strong
                    />
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>

      {editable && (
        <div className="mt-12 max-w-3xl">
          <h2 className="text-lg font-semibold mb-4">
            {t("pnl.new_snapshot")}
          </h2>
          <SnapshotForm
            propertyId={id}
            defaults={snapshotDefaults}
          />
        </div>
      )}
    </div>
  );
}

function ResultRow({
  label,
  value,
  strong,
  muted,
  tag,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  tag?: "auto" | "override";
}) {
  return (
    <tr
      className={`border-t border-neutral-200 dark:border-neutral-800 ${
        muted ? "text-neutral-500 dark:text-neutral-400" : ""
      }`}
    >
      <td className={`py-2 ${strong ? "font-semibold" : ""}`}>
        {label}
        {tag && (
          <span className="ml-2 text-[10px] uppercase tracking-wider text-neutral-400">
            {tag}
          </span>
        )}
      </td>
      <td
        className={`py-2 text-right tabular-nums ${
          strong ? "font-semibold" : ""
        } ${value < 0 ? "text-red-600 dark:text-red-400" : ""}`}
      >
        {value.toLocaleString(undefined, {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 2,
        })}
      </td>
    </tr>
  );
}
