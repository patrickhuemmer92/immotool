import { getTranslations } from "next-intl/server";
import { getActiveWorkspace } from "@/lib/workspace";

export default async function DashboardPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("nav.dashboard")}
      </h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {active?.name}
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          KPIs und Charts folgen in MS13.
        </p>
      </div>
    </div>
  );
}
