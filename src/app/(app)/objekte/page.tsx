import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit, isOwner } from "@/lib/workspace";
import { formatPropertyAddress, type PropertyKind } from "@/lib/properties";
import { computeValuation } from "@/lib/calculations/valuation";
import { seedDemoProperty } from "./actions";
import {
  PropertiesTable,
  type PropertiesTableRow,
} from "./properties-table";

export default async function PropertiesPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select(
      `id, kind, parent_property_id, street, postal_code, city, location_detail, description, sqm, purchase_price, land_value, is_demo,
       portfolio_valuations(valuation_date, market_rent_per_sqm, multiple, building_value, land_value, income_weight)`
    )
    .eq("workspace_id", active.id)
    .order("city")
    .order("street");

  type Valuation = {
    valuation_date: string;
    market_rent_per_sqm: string | number | null;
    multiple: string | number | null;
    building_value: string | number | null;
    land_value: string | number | null;
    income_weight: string | number | null;
  };
  const marketValue = new Map<string, number | null>();
  for (const p of properties ?? []) {
    const vals = ((p.portfolio_valuations as unknown) as Valuation[]) ?? [];
    if (vals.length === 0) {
      marketValue.set(p.id, null);
      continue;
    }
    const latest = vals
      .slice()
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
    const r = computeValuation(
      {
        sqm: p.sqm == null ? null : Number(p.sqm),
        marketRentPerSqm:
          latest.market_rent_per_sqm == null
            ? null
            : Number(latest.market_rent_per_sqm),
        multiple: latest.multiple == null ? null : Number(latest.multiple),
        landValue:
          latest.land_value != null
            ? Number(latest.land_value)
            : p.land_value == null
              ? null
              : Number(p.land_value),
        buildingValue:
          latest.building_value == null ? null : Number(latest.building_value),
      },
      latest.income_weight == null ? 0.5 : Number(latest.income_weight)
    );
    marketValue.set(p.id, r.combined);
  }

  const hasDemo = (properties ?? []).some((p) => p.is_demo);
  const canSeedDemo = isOwner(active.role) && !hasDemo;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("properties.title")}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {canSeedDemo && (
            <form action={seedDemoProperty}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft text-accent-foreground px-3 py-1.5 text-sm font-medium hover:bg-accent/20"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("properties.load_demo")}
              </button>
            </form>
          )}
          <a
            href="/api/pdf/factbook/portfolio"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {t("factsheet.download_factbook")}
          </a>
          {canEdit(active.role) && (
            <>
              <Link
                href="/portfolios/neu"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                + {t("portfolios.new")}
              </Link>
              <Link
                href="/objekte/neu"
                className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                + {t("properties.new")}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        {!properties || properties.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("properties.empty")}
          </p>
        ) : (
          <PropertiesTable
            rows={(properties ?? []).map<PropertiesTableRow>((p) => ({
              id: p.id,
              kind: (p.kind as PropertyKind) ?? "apartment",
              address: formatPropertyAddress(p),
              sqm: p.sqm == null ? null : Number(p.sqm),
              purchasePrice:
                p.purchase_price == null ? null : Number(p.purchase_price),
              marketValue: marketValue.get(p.id) ?? null,
              isDemo: !!p.is_demo,
            }))}
          />
        )}
      </div>
    </div>
  );
}

