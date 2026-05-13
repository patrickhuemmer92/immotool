import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { buildingAfaBasis } from "@/lib/calculations/pnl";
import { dateDe } from "@/lib/format";
import { AfaItemForm } from "./afa-item-form";
import { DeleteAfaItemButton } from "./delete-button";

export default async function PropertyAfaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [{ data: property }, { data: items }, { data: settings }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("other_depreciation_items")
        .select("id, item_name, acquisition_cost, acquisition_date, duration_years")
        .eq("property_id", id)
        .order("acquisition_date"),
      supabase
        .from("settings")
        .select("default_depreciation_rate")
        .eq("workspace_id", active.id)
        .maybeSingle(),
    ]);

  if (!property) notFound();
  const editable = canEdit(active.role);

  const num = (v: string | number | null | undefined): number | null =>
    v === null || v === undefined || v === ""
      ? null
      : Number.isFinite(Number(v))
        ? Number(v)
        : null;

  const afaBasis = buildingAfaBasis({
    purchasePrice: num(property.purchase_price),
    buildingValueSharePct: num(property.building_value_share_pct),
    landValue: num(property.land_value),
  });

  const propertyRate = num(property.depreciation_rate);
  const defaultRate =
    num(settings?.default_depreciation_rate) ?? 0.02;
  const effectiveRate = propertyRate ?? defaultRate;
  const rateSource =
    propertyRate != null
      ? t("afa.rate_source_property")
      : t("afa.rate_source_default");

  const annualBuildingAfa = afaBasis * effectiveRate;
  const annualOtherAfa = (items ?? []).reduce(
    (acc, i) =>
      acc + Number(i.acquisition_cost) / Math.max(1, i.duration_years),
    0
  );
  const totalAnnualAfa = annualBuildingAfa + annualOtherAfa;

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("afa.title")}
      </h1>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t("afa.afa_basis")} value={afaBasis === 0 ? "—" : eur(afaBasis)} />
        <Stat
          label={t("afa.afa_rate")}
          value={`${(effectiveRate * 100).toLocaleString("de-DE", {
            maximumFractionDigits: 4,
          })} % (${rateSource})`}
          small
        />
        <Stat
          label={t("afa.annual_building_afa")}
          value={afaBasis === 0 ? "—" : eur(annualBuildingAfa)}
        />
        <Stat
          label={t("afa.annual_total_afa")}
          value={eur(totalAnnualAfa)}
          strong
        />
      </div>

      {afaBasis === 0 && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          {t("afa.no_basis")}
        </p>
      )}

      <div className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
          {t("afa.section_other")}
        </h2>

        {(items ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("afa.no_items")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("afa.item_name")}</Th>
                  <Th>{t("afa.acquisition_date")}</Th>
                  <Th>{t("afa.acquisition_cost")}</Th>
                  <Th>{t("afa.duration_years")}</Th>
                  <Th>{t("afa.annual_amount")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((i) => {
                  const annual =
                    Number(i.acquisition_cost) / Math.max(1, i.duration_years);
                  return (
                    <tr
                      key={i.id}
                      className="border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <Td>{i.item_name}</Td>
                      <Td>{dateDe(i.acquisition_date)}</Td>
                      <Td>{eur(Number(i.acquisition_cost))}</Td>
                      <Td>{i.duration_years}</Td>
                      <Td className="font-semibold">{eur(annual)}</Td>
                      <Td>
                        {editable && (
                          <DeleteAfaItemButton id={i.id} propertyId={id} />
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {editable && (
          <div className="mt-6 max-w-3xl">
            <AfaItemForm propertyId={id} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
  small,
}: {
  label: string;
  value: string;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-1 tabular-nums ${
          strong ? "text-lg font-semibold" : small ? "text-xs" : "text-sm"
        }`}
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
  return <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}
