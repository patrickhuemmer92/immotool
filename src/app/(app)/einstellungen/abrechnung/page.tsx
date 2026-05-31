import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { getWorkspaceBilling } from "@/lib/billing/subscription";
import { TIERS, FREE_TIER, requiredTierForCount } from "@/lib/billing/tiers";
import { stripeMode } from "@/lib/billing/stripe";
import { BillingActions } from "./billing-actions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  // Nur Owner sieht Billing — andere Members können nicht zahlen.
  if (!isOwner(active.role)) redirect("/einstellungen");

  const { status: queryStatus } = await searchParams;
  const billing = await getWorkspaceBilling(active.id);
  const required = requiredTierForCount(billing.propertyCount);
  const mode = stripeMode();

  return (
    <div className="space-y-6">
      {queryStatus === "success" && (
        <Banner kind="success">{t("billing.checkout_success")}</Banner>
      )}
      {queryStatus === "cancelled" && (
        <Banner kind="info">{t("billing.checkout_cancelled")}</Banner>
      )}

      {/* Aktueller Tier-Status */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              {t("billing.current_plan")}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {billing.tier.name}
              {billing.status && billing.status !== "active" && (
                <span className="ml-2 text-xs rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 px-2 py-0.5">
                  {t(`billing.status_${billing.status}` as never, {
                    default: billing.status,
                  } as never)}
                </span>
              )}
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t("billing.objects_used", {
                used: billing.propertyCount,
                max:
                  billing.tier.maxObjects === null
                    ? "∞"
                    : String(billing.tier.maxObjects),
              })}
            </p>
            {billing.currentPeriodEnd && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {billing.cancelAtPeriodEnd
                  ? t("billing.ends_at", {
                      date: formatDate(billing.currentPeriodEnd),
                    })
                  : t("billing.renews_at", {
                      date: formatDate(billing.currentPeriodEnd),
                    })}
              </p>
            )}
          </div>

          {billing.stripeCustomerId && (
            <BillingActions kind="portal" />
          )}
        </div>

        {required.key !== billing.tier.key &&
          (required.priceEurYear ?? 0) > (billing.tier.priceEurYear ?? 0) && (
            <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 px-3 py-2 text-sm">
              {t("billing.upgrade_required", {
                count: billing.propertyCount,
                tier: required.name,
              })}
            </div>
          )}
      </section>

      {/* Plan-Auswahl */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          {t("billing.choose_plan")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {TIERS.map((tier) => {
            const isCurrent = tier.key === billing.tier.key;
            const isFree = tier.key === FREE_TIER.key;
            return (
              <div
                key={tier.key}
                className={`rounded-2xl border p-4 flex flex-col ${
                  isCurrent
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                }`}
              >
                <h3 className="font-semibold">{tier.name}</h3>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {tier.priceEurYear === 0
                    ? t("billing.free")
                    : `${tier.priceEurYear} €`}
                  {tier.priceEurYear > 0 && (
                    <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      {" "}
                      / {t("billing.per_year")}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {tier.maxObjects === null
                    ? t("billing.objects_unlimited", { min: tier.minObjects })
                    : tier.minObjects === tier.maxObjects
                      ? t("billing.objects_exact", { count: tier.minObjects })
                      : t("billing.objects_range", {
                          min: tier.minObjects,
                          max: tier.maxObjects,
                        })}
                </p>

                <div className="mt-4 flex-1 flex items-end">
                  {isCurrent ? (
                    <span className="w-full inline-flex justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-3 py-2 text-sm">
                      {t("billing.current_plan_short")}
                    </span>
                  ) : isFree ? (
                    <span className="w-full inline-flex justify-center text-xs text-neutral-500 dark:text-neutral-400 px-3 py-2">
                      {t("billing.downgrade_via_portal")}
                    </span>
                  ) : (
                    <BillingActions
                      kind="checkout"
                      lookupKey={tier.lookupKey!}
                      label={
                        billing.hasActiveSubscription
                          ? t("billing.switch_plan")
                          : t("billing.subscribe")
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {mode === "test" && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          {t("billing.test_mode_note")}
        </p>
      )}
    </div>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "info";
  children: React.ReactNode;
}) {
  const palette =
    kind === "success"
      ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900"
      : "bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-900";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${palette}`}>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
