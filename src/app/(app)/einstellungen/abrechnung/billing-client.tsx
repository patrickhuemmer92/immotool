"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PRICING_TIERS, tierForQuantity } from "@/lib/billing/pricing";

/**
 * Quantity-Slider + Aktivieren-Button. Bei aktiver Subscription:
 * "Plan ändern" → Stripe Customer Portal.
 *
 * Stripe übernimmt Checkout/Portal — wir reichen den User nur weiter.
 */
export function BillingClient({
  propertyCount,
  hasPaidSubscription,
  subscribedQuantity,
  focusSubscribe,
  initialQuantity,
}: {
  propertyCount: number;
  hasPaidSubscription: boolean;
  subscribedQuantity: number;
  focusSubscribe: boolean;
  initialQuantity: number;
}) {
  const t = useTranslations();
  const subscribeRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Wenn /einstellungen/abrechnung?focus_subscribe=true (aus Property-
  // Dialog), springe sofort auf den Subscribe-Bereich.
  useEffect(() => {
    if (focusSubscribe && subscribeRef.current) {
      subscribeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusSubscribe]);

  const tier = tierForQuantity(quantity);

  async function onSubscribe() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "unknown");
        return;
      }
      window.location.href = json.url;
    });
  }

  async function onOpenPortal() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "unknown");
        return;
      }
      window.location.href = json.url;
    });
  }

  // Quantity-Bounds: min 2 (1 = free, kein Abo nötig), max 100 (Slider-Limit).
  const minQuantity = Math.max(2, propertyCount);
  const maxQuantity = 100;

  return (
    <section
      ref={subscribeRef}
      className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
    >
      {hasPaidSubscription ? (
        <>
          <h2 className="text-lg font-semibold">
            {t("billing.active_subscription_title")}
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {t("billing.active_subscription_help", {
              qty: subscribedQuantity,
              tier: tierForQuantity(subscribedQuantity).label,
              price: tierForQuantity(subscribedQuantity).yearlyEur.toLocaleString(
                "de-DE",
                { style: "currency", currency: "EUR", minimumFractionDigits: 2 }
              ),
            })}
          </p>
          <button
            type="button"
            onClick={onOpenPortal}
            disabled={pending}
            className="mt-4 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("billing.manage_subscription")}
          </button>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">
            {t("billing.subscribe_title")}
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {t("billing.subscribe_intro")}
          </p>

          <div className="mt-5">
            <label className="text-sm font-medium block mb-2">
              {t("billing.quantity_label")}:{" "}
              <span className="tabular-nums">{quantity}</span>{" "}
              <span className="text-neutral-500 dark:text-neutral-400">
                ({t("billing.quantity_unit")})
              </span>
            </label>
            <input
              type="range"
              min={minQuantity}
              max={maxQuantity}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              <span>{minQuantity}</span>
              <span>{maxQuantity}+</span>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-neutral-50 dark:bg-neutral-950 p-4 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                {tier.label} ({quantity} {t("billing.quantity_unit_short")})
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {tier.yearlyEur === 0
                  ? t("billing.free")
                  : `${tier.yearlyEur.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 2,
                    })}`}
                <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  {tier.yearlyEur > 0 && ` / ${t("billing.per_year")}`}
                </span>
              </span>
            </div>
          </div>

          {/* Vorschau aller Tiers, der Slider-Wert wird automatisch übernommen */}
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 leading-snug">
            {t("billing.subscribe_footnote")}
          </p>

          <button
            type="button"
            onClick={onSubscribe}
            disabled={pending}
            className="mt-5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("billing.subscribe_action")}
          </button>
        </>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {t("common.error")}: {error}
        </p>
      )}

      {/* Compact-Tier-Liste als Reference (5 Stufen) */}
      <details className="mt-5 text-xs text-neutral-500 dark:text-neutral-400">
        <summary className="cursor-pointer">
          {t("billing.all_tiers_summary")}
        </summary>
        <ul className="mt-2 space-y-0.5">
          {PRICING_TIERS.map((t) => (
            <li key={t.label} className="flex items-baseline justify-between">
              <span>
                {t.label}: {t.maxQty == null ? `≥${t.minQty}` : `${t.minQty}–${t.maxQty}`}
              </span>
              <span className="tabular-nums">
                {t.yearlyEur === 0 ? "0 €" : `${t.yearlyEur} €/Jahr`}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
