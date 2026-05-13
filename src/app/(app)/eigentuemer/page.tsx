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
    .select(
      "id, name, kind, first_name, last_name, created_at, members:owner_members!group_owner_id(person_owner_id)"
    )
    .eq("workspace_id", active.id)
    .order("kind")
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
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
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
                  <Th>{t("owners.kind_label")}</Th>
                  <Th>{t("owners.members")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => {
                  const memberCount = Array.isArray(o.members)
                    ? o.members.length
                    : 0;
                  return (
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
                        <KindBadge kind={o.kind as "person" | "group"} t={t} />
                      </Td>
                      <Td>
                        {o.kind === "group" ? (
                          <span className="text-neutral-500 dark:text-neutral-400">
                            {memberCount}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
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

function KindBadge({
  kind,
  t,
}: {
  kind: "person" | "group";
  t: (k: string) => string;
}) {
  const isGroup = kind === "group";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isGroup
          ? "bg-accent-soft text-accent-foreground"
          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
      }`}
    >
      {isGroup ? t("owners.kind_group") : t("owners.kind_person")}
    </span>
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
