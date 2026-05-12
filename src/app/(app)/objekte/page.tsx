import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";

export default async function PropertiesPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select(
      "id, street, postal_code, city, location_detail, description, sqm, purchase_price"
    )
    .eq("workspace_id", active.id)
    .order("city")
    .order("street");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("properties.title")}
        </h1>
        {canEdit(active.role) && (
          <Link
            href="/objekte/neu"
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + {t("properties.new")}
          </Link>
        )}
      </div>

      <div className="mt-6">
        {!properties || properties.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("properties.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("properties.section_address")}</Th>
                  <Th>{t("properties.sqm")}</Th>
                  <Th>{t("properties.purchase_price")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td>
                      <Link
                        href={`/objekte/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {formatPropertyAddress(p)}
                      </Link>
                    </Td>
                    <Td>{formatNumber(p.sqm)}</Td>
                    <Td>{formatCurrency(p.purchase_price)}</Td>
                    <Td>
                      <Link
                        href={`/objekte/${p.id}`}
                        className="text-sm text-neutral-700 dark:text-neutral-300 hover:underline"
                      >
                        {t("common.edit")} →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatNumber(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function formatCurrency(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 align-middle">{children}</td>;
}
