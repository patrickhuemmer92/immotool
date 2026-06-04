import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { getPremiumStatus, PRICING_TIERS, tierForQuantity } from "@/lib/billing/premium";
import { stripeMode } from "@/lib/billing/stripe";
import { BillingClient } from "./billing-client";

/**
 * Workspace-Billing nach Modell D.
 *
 * Zeigt:
 *   - Aktuellen Premium-Status (free / paid / free-continue / quantity-mismatch)
 *   - Pricing-Tabelle (Tier-Übersicht aus PRICING_TIERS)
 *   - Quantity-Slider + "Premium aktivieren"-Button → Checkout
 *   - Bei aktiver Subscription: Portal-Link + aktuelle Quantity
 *
 * Stripe übernimmt Checkout/Portal/Invoice komplett — wir sind nur die
 * Connection.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;
  if (!isOwner(active.role)) redirect("/einstellungen");

  const params = await searchParams;
  const queryStatus = typeof params.status === "string" ? params.status : null;
  const focusSubscribe = params.focus_subscribe === "true";
  const initialQuantity = Number(
    typeof params.quantity === "string" ? params.quantity : "2"
  );

  const status = await getPremiumStatus(active.id);
  const mode = stripeMode();

  return (
    <div className="space-y-6">
      {queryStatus === "success" && (
        <Banner kind="success">{t("billing.checkout_success")}</Banner>
      )}
      {queryStatus === "cancelled" && (
        <Banner kind="info">{t("billing.checkout_cancelled")}</Banner>
      )}

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          {t("billing.current_status")}
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          {status.hasPaidSubscription
            ? t("billing.status_paid", {
                qty: status.subscribedQuantity,
                tier: tierForQuantity(status.subscribedQuantity).label,
              })
            : status.propertyCount <= 1
              ? t("billing.status_free_implicit")
              : t("billing.status_free_continue", {
                  count: status.propertyCount,
                })}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {t("billing.current_property_count", {
            count: status.propertyCount,
          })}
        </p>
        {status.needsQuantityUpgrade && (
          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-3 py-2 text-sm">
            {t("billing.needs_quantity_upgrade", {
              current: status.subscribedQuantity,
              count: status.propertyCount,
            })}
          </div>
        )}
      </section>

      <BillingClient
        propertyCount={status.propertyCount}
        hasPaidSubscription={status.hasPaidSubscription}
        subscribedQuantity={status.subscribedQuantity}
        focusSubscribe={focusSubscribe}
        initialQuantity={
          Number.isFinite(initialQuantity) && initialQuantity >= 2
            ? initialQuantity
            : Math.max(2, status.propertyCount)
        }
      />

      {/* Pricing-Tabelle */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          {t("billing.pricing_table_title")}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-950">
              <tr className="text-left">
                <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t("billing.pricing_tier_label")}
                </th>
                <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t("billing.pricing_quantity_label")}
                </th>
                <th className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider text-right">
                  {t("billing.pricing_yearly_label")}
                </th>
              </tr>
            </thead>
            <tbody>
              {PRICING_TIERS.map((tier) => {
                const currentTier =
                  status.subscribedQuantity > 0
                    ? tierForQuantity(status.subscribedQuantity)
                    : null;
                const isActive = currentTier?.label === tier.label;
                return (
                  <tr
                    key={tier.label}
                    className={
                      "border-t border-neutral-200 dark:border-neutral-800 " +
                      (isActive ? "bg-[var(--color-accent)]/5" : "")
                    }
                  >
                    <td className="px-4 py-2 font-medium">
                      {tier.label}
                      {isActive && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
                          {t("billing.pricing_active")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                      {tier.maxQty === null
                        ? t("billing.pricing_range_open", { min: tier.minQty })
                        : tier.minQty === tier.maxQty
                          ? `${tier.minQty}`
                          : `${tier.minQty}–${tier.maxQty}`}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {tier.yearlyEur === 0
                        ? t("billing.free")
                        : `${tier.yearlyEur.toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 2,
                          })} / ${t("billing.per_year")}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
