import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * UI-Lock-Screen für Premium-Features. Zeigt einen klaren Hinweis +
 * CTA zur Billing-Page. Die i18n-Keys liegen unter `billing.lock_*`.
 *
 * Verwendet als Server Component — daher async + getTranslations.
 */
export async function PremiumLocked({
  feature,
  reason,
  currentCount,
  subscribedQuantity,
}: {
  /** Feature-Key zum Anzeigen ("portfolios", "simulations", "cashflow", "factbook"). */
  feature: "portfolios" | "simulations" | "cashflow" | "factbook";
  reason: "needs_subscription" | "needs_quantity_upgrade";
  /** Anzahl Objekte im Workspace — nur als Info im Banner. */
  currentCount: number;
  subscribedQuantity?: number;
}) {
  const t = await getTranslations();
  const titleKey = `billing.lock_title_${feature}` as const;
  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
          {reason === "needs_subscription"
            ? t("billing.lock_reason_no_subscription", { count: currentCount })
            : t("billing.lock_reason_quantity_upgrade", {
                current: subscribedQuantity ?? 0,
                count: currentCount,
              })}
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            href="/einstellungen/abrechnung"
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            {reason === "needs_quantity_upgrade"
              ? t("billing.lock_cta_upgrade")
              : t("billing.lock_cta_subscribe")}
          </Link>
          <Link
            href="/objekte"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            {t("billing.lock_cta_back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
