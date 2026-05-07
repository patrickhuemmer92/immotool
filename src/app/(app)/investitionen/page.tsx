import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";

export default async function InvestmentsHeatmapPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select(
      `id, street, postal_code, city, location_detail, description,
       investment_plans(year, is_long_term, amount)`
    )
    .eq("workspace_id", active.id)
    .order("city")
    .order("street");

  const allYears = new Set<number>();
  let hasLongTerm = false;
  for (const p of properties ?? []) {
    for (const inv of (p.investment_plans as unknown as {
      year: number | null;
      is_long_term: boolean;
      amount: string | number;
    }[]) ?? []) {
      if (inv.is_long_term) hasLongTerm = true;
      else if (inv.year != null) allYears.add(inv.year);
    }
  }
  const yearList = Array.from(allYears).sort();
  const cols: (number | "long_term")[] = [...yearList];
  if (hasLongTerm) cols.push("long_term");

  type Cell = { value: number };
  const matrix: Map<string, Map<number | "long_term", Cell>> = new Map();
  let maxValue = 0;

  for (const p of properties ?? []) {
    const row = new Map<number | "long_term", Cell>();
    for (const inv of (p.investment_plans as unknown as {
      year: number | null;
      is_long_term: boolean;
      amount: string | number;
    }[]) ?? []) {
      const k = inv.is_long_term
        ? ("long_term" as const)
        : (inv.year as number);
      const cur = row.get(k)?.value ?? 0;
      const v = cur + Number(inv.amount);
      row.set(k, { value: v });
      if (v > maxValue) maxValue = v;
    }
    matrix.set(p.id, row);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("investments.title")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("investments.heatmap_title")}
      </p>

      <div className="mt-6">
        {!properties || properties.length === 0 || cols.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("investments.no_investments")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-neutral-50 dark:bg-neutral-900">
                  <th className="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider sticky left-0 bg-neutral-50 dark:bg-neutral-900">
                    {t("properties.title")}
                  </th>
                  {cols.map((c) => (
                    <th
                      key={c}
                      className="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider text-right"
                    >
                      {c === "long_term"
                        ? t("investments.heatmap_long_term_label")
                        : c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(properties ?? []).map((p) => {
                  const row = matrix.get(p.id) ?? new Map();
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <td className="px-3 py-2 sticky left-0 bg-white dark:bg-neutral-900">
                        <Link
                          href={`/objekte/${p.id}/investitionen`}
                          className="hover:underline"
                        >
                          {formatPropertyAddress(p)}
                        </Link>
                      </td>
                      {cols.map((c) => {
                        const cell = row.get(c);
                        const intensity = cell
                          ? Math.min(1, cell.value / Math.max(1, maxValue))
                          : 0;
                        return (
                          <td
                            key={`${p.id}-${c}`}
                            className="px-3 py-2 text-right tabular-nums"
                            style={{
                              backgroundColor: cell
                                ? `rgba(31, 41, 55, ${0.05 + intensity * 0.55})`
                                : undefined,
                            }}
                          >
                            {cell
                              ? cell.value.toLocaleString(undefined, {
                                  style: "currency",
                                  currency: "EUR",
                                  maximumFractionDigits: 0,
                                })
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
