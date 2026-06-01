import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";

export default async function SimulationsPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: simulations } = await supabase
    .from("simulations")
    .select(
      `id, name, description, rent_growth_pa, cost_growth_pa, interest_change_bps,
       property:properties!simulations_property_id_fkey(id, street, postal_code, city, location_detail, description)`
    )
    .eq("workspace_id", active.id)
    .order("name");

  const editable = canEdit(active.role);

  type PropertyMini = {
    id: string;
    street: string;
    postal_code: string;
    city: string;
    location_detail: string | null;
    description: string | null;
  };
  type Row = {
    id: string;
    name: string;
    description: string | null;
    rent_growth_pa: number | string;
    cost_growth_pa: number | string;
    interest_change_bps: number;
    // Supabase gibt embedded refs auch bei N:1 als Array zurück.
    property: PropertyMini | PropertyMini[] | null;
  };
  function pickProperty(p: Row["property"]): PropertyMini | null {
    if (!p) return null;
    return Array.isArray(p) ? p[0] ?? null : p;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("simulations.title")}
        </h1>
        {editable && (
          <Link
            href="/simulationen/neu"
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + {t("simulations.new")}
          </Link>
        )}
      </div>

      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {t("simulations.intro")}
      </p>

      <div className="mt-6">
        {!simulations || simulations.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("simulations.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(simulations as unknown as Row[]).map((s) => {
              const prop = pickProperty(s.property);
              return (
              <Link
                key={s.id}
                href={`/simulationen/${s.id}`}
                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
              >
                <h2 className="font-semibold text-lg">{s.name}</h2>
                {prop && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatPropertyAddress(prop)}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <Mini
                    label={t("simulations.rent_growth_short")}
                    value={pct(s.rent_growth_pa)}
                  />
                  <Mini
                    label={t("simulations.cost_growth_short")}
                    value={pct(s.cost_growth_pa)}
                  />
                  <Mini
                    label={t("simulations.interest_change_short")}
                    value={`${
                      s.interest_change_bps > 0 ? "+" : ""
                    }${s.interest_change_bps} bps`}
                  />
                </div>
                {s.description && (
                  <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                    {s.description}
                  </p>
                )}
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function pct(v: number | string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toLocaleString("de-DE", {
    maximumFractionDigits: 2,
  })} %`;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-950 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
