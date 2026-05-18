import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { ValuationForm, type ValuationDefaults } from "../../valuation-form";

export default async function EditValuationPage({
  params,
}: {
  params: Promise<{ id: string; valuationId: string }>;
}) {
  const { id, valuationId } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!canEdit(active.role)) redirect(`/objekte/${id}/bewertung`);

  const supabase = await createClient();
  const [{ data: v }, { data: property }] = await Promise.all([
    supabase
      .from("portfolio_valuations")
      .select(
        "id, valuation_date, condition_score, market_rent_per_sqm, multiple, building_value, land_value, income_weight"
      )
      .eq("id", valuationId)
      .eq("property_id", id)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("land_value")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!v) notFound();
  const landValue =
    property?.land_value == null ? null : Number(property.land_value);

  const defaults: ValuationDefaults = {
    valuation_date: v.valuation_date,
    condition_score: v.condition_score?.toString() ?? "",
    market_rent_per_sqm:
      v.market_rent_per_sqm == null
        ? ""
        : Number(v.market_rent_per_sqm)
            .toLocaleString("de-DE", {
              useGrouping: false,
              maximumFractionDigits: 4,
            }),
    multiple:
      v.multiple == null
        ? ""
        : Number(v.multiple).toLocaleString("de-DE", {
            useGrouping: false,
            maximumFractionDigits: 4,
          }),
    building_value:
      v.building_value == null
        ? ""
        : Number(v.building_value).toLocaleString("de-DE", {
            useGrouping: false,
            maximumFractionDigits: 2,
          }),
    land_value:
      v.land_value == null
        ? ""
        : Number(v.land_value).toLocaleString("de-DE", {
            useGrouping: false,
            maximumFractionDigits: 2,
          }),
    income_weight: v.income_weight == null ? 0.5 : Number(v.income_weight),
  };

  return (
    <div>
      <Link
        href={`/objekte/${id}/bewertung`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("valuation.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("valuation.title")}
      </h1>
      <div className="mt-6 max-w-3xl">
        <ValuationForm
          propertyId={id}
          valuationId={valuationId}
          propertyLandValue={landValue}
          defaults={defaults}
        />
      </div>
    </div>
  );
}
