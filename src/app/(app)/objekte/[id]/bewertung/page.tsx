import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { computeValuation } from "@/lib/calculations/valuation";
import { dateDe } from "@/lib/format";
import { ValuationForm } from "./valuation-form";

export default async function PropertyValuationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: property }, { data: valuations }] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, street, postal_code, city, location_detail, description, sqm, land_value"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("portfolio_valuations")
      .select(
        "id, valuation_date, condition_score, market_rent_per_sqm, multiple, building_value, income_weight, notes"
      )
      .eq("property_id", id)
      .order("valuation_date", { ascending: false }),
  ]);

  if (!property) notFound();
  const editable = canEdit(active.role);

  const sqm = property.sqm == null ? null : Number(property.sqm);
  const landValue = property.land_value == null ? null : Number(property.land_value);

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("valuation.title")}
      </h1>

      {sqm == null && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          {t("valuation.no_sqm_warning")}
        </p>
      )}
      {landValue == null && (
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          {t("valuation.no_land_value_warning")}
        </p>
      )}

      <div className="mt-6">
        {(valuations ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("valuation.no_valuations")}
          </p>
        ) : (
          <div className="space-y-4">
            {(valuations ?? []).map((v) => {
              const w =
                v.income_weight == null ? 0.5 : Number(v.income_weight);
              const result = computeValuation(
                {
                  sqm,
                  marketRentPerSqm:
                    v.market_rent_per_sqm == null
                      ? null
                      : Number(v.market_rent_per_sqm),
                  multiple: v.multiple == null ? null : Number(v.multiple),
                  landValue,
                  buildingValue:
                    v.building_value == null ? null : Number(v.building_value),
                },
                w
              );
              return (
                <div
                  key={v.id}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {dateDe(v.valuation_date)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {Math.round(w * 100)}/{Math.round((1 - w) * 100)}
                      </span>
                      <ConditionBadge score={v.condition_score} t={t} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <Stat
                      label={t("valuation.ertragswert")}
                      value={result.ertragswert}
                    />
                    <Stat
                      label={t("valuation.sachwert")}
                      value={result.sachwert}
                    />
                    <Stat
                      label={t("valuation.combined")}
                      value={result.combined}
                      strong
                    />
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-3 leading-snug">
                    {t("valuation.method_footnote")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-8 max-w-3xl">
          <h2 className="text-lg font-semibold mb-4">{t("valuation.new")}</h2>
          <ValuationForm propertyId={id} />
        </div>
      )}
    </div>
  );
}

function ConditionBadge({
  score,
  t,
}: {
  score: number | null;
  t: (key: string) => string;
}) {
  if (score == null) return null;
  // 1..10 → red (1-3) → amber (4-6) → emerald (7-10).
  let color = "#ef4444";
  if (score >= 7) color = "#10b981";
  else if (score >= 4) color = "#f59e0b";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
      style={{ backgroundColor: `${color}26`, color }}
      title={t("valuation.condition_score")}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {score}/10
    </span>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-1 tabular-nums ${strong ? "text-lg font-semibold" : "text-sm"}`}
      >
        {value == null
          ? "—"
          : value.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
      </div>
    </div>
  );
}
