import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { buildingAfaBasis } from "@/lib/calculations/pnl";

export default async function PortfolioAfaPage() {
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
         other_depreciation_items(acquisition_cost, duration_years)`
      )
      .eq("workspace_id", active.id)
      .order("city")
      .order("street"),
    supabase
      .from("settings")
      .select("default_depreciation_rate")
      .eq("workspace_id", active.id)
      .maybeSingle(),
  ]);

  const num = (v: string | number | null | undefined): number | null =>
    v === null || v === undefined || v === ""
      ? null
      : Number.isFinite(Number(v))
        ? Number(v)
        : null;

  const defaultRate = num(settings?.default_depreciation_rate) ?? 0.02;

  type Row = {
    id: string;
    label: string;
    afaBasis: number;
    rate: number;
    annualBuilding: number;
    annualOther: number;
    annualTotal: number;
  };

  const rows: Row[] = [];
  let totalBuilding = 0;
  let totalOther = 0;

  for (const p of properties ?? []) {
    const afaBasis = buildingAfaBasis({
      purchasePrice: num(p.purchase_price),
      buildingValueSharePct: num(p.building_value_share_pct),
      landValue: num(p.land_value),
    });
    const rate = num(p.depreciation_rate) ?? defaultRate;
    const annualBuilding = afaBasis * rate;

    const items =
      (p.other_depreciation_items as unknown as {
        acquisition_cost: string | number;
        duration_years: number;
      }[]) ?? [];
    const annualOther = items.reduce(
      (acc, i) =>
        acc + Number(i.acquisition_cost) / Math.max(1, i.duration_years),
      0
    );

    totalBuilding += annualBuilding;
    totalOther += annualOther;

    rows.push({
      id: p.id,
      label: formatPropertyAddress(p),
      afaBasis,
      rate,
      annualBuilding,
      annualOther,
      annualTotal: annualBuilding + annualOther,
    });
  }

  const totalAnnual = totalBuilding + totalOther;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("afa.title")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("afa.portfolio_table")}
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label={t("afa.annual_building_afa")} value={eur(totalBuilding)} />
        <Kpi label={t("afa.annual_other_afa")} value={eur(totalOther)} />
        <Kpi label={t("afa.annual_total_afa")} value={eur(totalAnnual)} strong />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr className="text-left">
              <Th>{t("properties.title")}</Th>
              <Th>{t("afa.afa_basis")}</Th>
              <Th>{t("afa.afa_rate")}</Th>
              <Th>{t("afa.annual_building_afa")}</Th>
              <Th>{t("afa.annual_other_afa")}</Th>
              <Th>{t("afa.annual_total_afa")}</Th>
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
                    href={`/objekte/${r.id}/afa`}
                    className="hover:underline"
                  >
                    {r.label}
                  </Link>
                </Td>
                <Td>{r.afaBasis === 0 ? "—" : eur(r.afaBasis)}</Td>
                <Td>
                  {(r.rate * 100).toLocaleString("de-DE", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  %
                </Td>
                <Td>{r.afaBasis === 0 ? "—" : eur(r.annualBuilding)}</Td>
                <Td>{eur(r.annualOther)}</Td>
                <Td className="font-semibold">{eur(r.annualTotal)}</Td>
              </tr>
            ))}
            <tr className="border-t-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 font-semibold">
              <Td>Σ</Td>
              <Td></Td>
              <Td></Td>
              <Td>{eur(totalBuilding)}</Td>
              <Td>{eur(totalOther)}</Td>
              <Td>{eur(totalAnnual)}</Td>
            </tr>
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
