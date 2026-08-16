import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { OnbDeleteButton } from "./delete-button";

export default async function OnboardingListPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("onboarding_projects")
    .select(
      "id, name, status, created_property_id, paid, premium_unlock, created_at, updated_at"
    )
    .eq("workspace_id", active.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("onb.title")}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
            {t("onb.intro")}
          </p>
        </div>
        <Link
          href="/onboarding/neu"
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          + {t("onb.new")}
        </Link>
      </div>

      <div className="mt-8">
        {!projects || projects.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("onb.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 overflow-hidden"
              >
                <Link href={`/onboarding/${p.id}`} className="block p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {t(`onb.status_${p.status}`)}
                    </span>
                    {(p.paid || p.premium_unlock) && (
                      <span className="text-[10px] text-accent">
                        ✓ {t("onb.unlocked")}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-semibold truncate">
                    {p.name}
                  </h3>
                  {p.created_property_id && (
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                      → {t("onb.property_created")}
                    </p>
                  )}
                </Link>
                <div className="flex justify-end px-4 pb-3">
                  <OnbDeleteButton
                    projectId={p.id}
                    projectName={p.name}
                    hasProperty={!!p.created_property_id}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
