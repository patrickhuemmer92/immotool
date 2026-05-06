import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";

export default async function OwnersPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: owners } = await supabase
    .from("owners")
    .select("id, name, tax_id, created_at")
    .eq("workspace_id", active.id)
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("owners.title")}
        </h1>
        {canEdit(active.role) && (
          <Link
            href="/eigentuemer/neu"
            className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + {t("owners.new")}
          </Link>
        )}
      </div>

      <div className="mt-6">
        {!owners || owners.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("owners.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <Th>{t("owners.name")}</Th>
                  <Th>{t("owners.tax_id")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td>
                      <Link
                        href={`/eigentuemer/${o.id}`}
                        className="font-medium hover:underline"
                      >
                        {o.name}
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {o.tax_id ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/eigentuemer/${o.id}`}
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
