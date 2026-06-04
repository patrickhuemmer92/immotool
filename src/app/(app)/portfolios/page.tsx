import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { requirePremiumOrLock } from "@/lib/billing/gate";
import { PremiumLocked } from "@/components/premium-locked";

export default async function PortfoliosPage() {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  // Premium-Gate: Portfolios sind ein Premium-Feature.
  const gate = await requirePremiumOrLock(active.id);
  if (gate.locked) {
    return (
      <PremiumLocked
        feature="portfolios"
        reason={gate.reason}
        currentCount={gate.status.propertyCount}
        subscribedQuantity={gate.status.subscribedQuantity}
      />
    );
  }

  const supabase = await createClient();
  // Anzahl Objekte pro Portfolio via Embedded-Count holen.
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, name, description, portfolio_properties(count)")
    .eq("workspace_id", active.id)
    .order("name");

  const editable = canEdit(active.role);

  type Row = {
    id: string;
    name: string;
    description: string | null;
    portfolio_properties: { count: number }[];
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("portfolios.title")}
        </h1>
        {editable && (
          <Link
            href="/portfolios/neu"
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + {t("portfolios.new")}
          </Link>
        )}
      </div>

      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {t("portfolios.intro")}
      </p>

      <div className="mt-6">
        {!portfolios || portfolios.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("portfolios.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(portfolios as Row[]).map((p) => {
              const count = p.portfolio_properties[0]?.count ?? 0;
              return (
                <Link
                  key={p.id}
                  href={`/portfolios/${p.id}`}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
                >
                  <h2 className="font-semibold text-lg">{p.name}</h2>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {t("portfolios.objects_count", { count })}
                  </p>
                  {p.description && (
                    <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
                      {p.description}
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
