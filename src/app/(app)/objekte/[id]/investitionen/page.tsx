import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { buildingAfaBreakdown } from "@/lib/calculations/pnl";
import { InvestmentForm } from "./investment-form";
import { DeleteInvestmentButton } from "./delete-button";
import {
  AnschaffungsnahWarner,
  type AnschaffungsnahStatus,
} from "./anschaffungsnah-warner";

type MeasureType =
  | "fixed_individual"
  | "optional_individual"
  | "fixed_common_reserve"
  | "fixed_common_levy"
  | "optional_common_reserve"
  | "optional_common_levy";

type TaxTreatment =
  | "expense_immediate"
  | "expense_82b"
  | "capitalized_building"
  | "capitalized_separate"
  | "non_deductible";

const ANSCHAFFUNGSNAH_RATE = 0.15;
const ANSCHAFFUNGSNAH_WINDOW_YEARS = 3;

const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === ""
    ? null
    : Number.isFinite(Number(v))
      ? Number(v)
      : null;

export default async function PropertyInvestmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: property }, { data: investments }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("investment_plans")
      .select(
        "id, year, is_long_term, amount, description, measure_type, tax_treatment, expense_82b_years, useful_life_years, requalified_15pct"
      )
      .eq("property_id", id)
      .order("is_long_term")
      .order("year"),
  ]);

  if (!property) notFound();
  const editable = canEdit(active.role);

  // ----- 15 %-Regel berechnen -----
  // Schwelle = Gebäudeanteil am Kaufpreis × 15 % (nach § 6 Abs. 1 Nr. 1a EStG
  // ohne Nebenkosten und ohne Umsatzsteuer).
  const transferDate = property.transfer_date as string | null;
  const transferYear = transferDate
    ? new Date(transferDate).getUTCFullYear()
    : null;

  const ancillary =
    (num(property.transfer_tax) ?? 0) +
    (num(property.broker_fee) ?? 0) +
    (num(property.notary_fee) ?? 0) +
    (num(property.registration_cost) ?? 0);
  const breakdown = buildingAfaBreakdown({
    purchasePrice: num(property.purchase_price),
    buildingValueSharePct: num(property.building_value_share_pct),
    landValue: num(property.land_value),
    ancillaryCosts: ancillary || null,
  });
  // 15 %-Schwelle: nur Gebäudeanteil aus Kaufpreis (ohne Nebenkosten).
  const buildingFromPurchase = breakdown.fromPurchase;

  let status: AnschaffungsnahStatus;
  if (transferYear == null) {
    status = { state: "no_transfer_date" };
  } else if (buildingFromPurchase <= 0) {
    status = { state: "no_basis" };
  } else {
    const windowFrom = transferYear;
    const windowTo = transferYear + ANSCHAFFUNGSNAH_WINDOW_YEARS - 1;
    const threshold = buildingFromPurchase * ANSCHAFFUNGSNAH_RATE;
    const inWindowExpenses = (investments ?? []).filter((i) => {
      if (i.year == null) return false;
      const inWindow = i.year >= windowFrom && i.year <= windowTo;
      const isExpense =
        i.tax_treatment === "expense_immediate" ||
        i.tax_treatment === "expense_82b";
      return inWindow && isExpense;
    });
    const current = inWindowExpenses.reduce(
      (acc, i) => acc + Number(i.amount ?? 0),
      0
    );
    const ratio = current / threshold;
    const stateLevel: "ok" | "warn" | "exceeded" =
      ratio > 1 ? "exceeded" : ratio > 0.8 ? "warn" : "ok";
    status = {
      state: stateLevel,
      threshold,
      current,
      windowFrom,
      windowTo,
    };
  }

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("investments.title")}
      </h1>

      <div className="mt-6">
        <AnschaffungsnahWarner
          status={status}
          propertyId={id}
          transferYear={transferYear}
          canEdit={editable}
        />
      </div>

      <div className="mt-6">
        {(investments ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("investments.no_investments")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("investments.year")}</Th>
                  <Th>{t("investments.amount")}</Th>
                  <Th>{t("investments.measure_type")}</Th>
                  <Th>{t("investments.tax_treatment_column")}</Th>
                  <Th>{t("investments.description")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {(investments ?? []).map((i) => (
                  <tr
                    key={i.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td>
                      {i.is_long_term
                        ? t("investments.heatmap_long_term_label")
                        : i.year}
                    </Td>
                    <Td className="tabular-nums">
                      {Number(i.amount).toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                    </Td>
                    <Td>{t(`investments.type_${i.measure_type as MeasureType}`)}</Td>
                    <Td>
                      <TaxBadge
                        treatment={i.tax_treatment as TaxTreatment}
                        requalified={Boolean(i.requalified_15pct)}
                        years={
                          i.tax_treatment === "expense_82b"
                            ? i.expense_82b_years
                            : i.tax_treatment === "capitalized_separate"
                              ? i.useful_life_years
                              : null
                        }
                        label={t(
                          `investments.tax_${i.tax_treatment as TaxTreatment}`
                        )}
                        requalifiedTag={t("investments.requalified_tag")}
                        yearsLabel={t("investments.years_label")}
                      />
                    </Td>
                    <Td>{i.description ?? "—"}</Td>
                    <Td>
                      {editable && (
                        <DeleteInvestmentButton id={i.id} propertyId={id} />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-8 max-w-3xl">
          <h2 className="text-lg font-semibold mb-4">{t("investments.new")}</h2>
          <InvestmentForm propertyId={id} />
        </div>
      )}
    </div>
  );
}

function TaxBadge({
  treatment,
  requalified,
  years,
  label,
  requalifiedTag,
  yearsLabel,
}: {
  treatment: TaxTreatment;
  requalified: boolean;
  years: number | null;
  label: string;
  requalifiedTag: string;
  yearsLabel: string;
}) {
  const palette: Record<TaxTreatment, string> = {
    expense_immediate:
      "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200",
    expense_82b:
      "bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-200",
    capitalized_building:
      "bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-200",
    capitalized_separate:
      "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200",
    non_deductible:
      "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
  };
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] ${palette[treatment]}`}
      >
        {label}
        {years != null && ` · ${years} ${yearsLabel}`}
      </span>
      {requalified && (
        <span className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-200">
          {requalifiedTag}
        </span>
      )}
    </div>
  );
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
  return <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}
