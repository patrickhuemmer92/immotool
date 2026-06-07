"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PRICING_TIERS, tierForQuantity } from "@/lib/billing/pricing";

type UpgradeResult = {
  previousQuantity: number;
  newQuantity: number;
  prorationTotalCents: number;
  amountPaidCents: number;
  currency: string;
};

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
  const router = useRouter();
  const subscribeRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** Erfolgs-Banner nach Quantity-Upgrade/Downgrade. */
  const [upgradeResult, setUpgradeResult] = useState<UpgradeResult | null>(null);
  /** Widerrufsverzichts-Checkboxen (§ 356 Abs. 4/5 BGB). Beide müssen
   *  separat angekreuzt sein, sonst bleibt der Bestell-Button gesperrt. */
  const [consentImmediateStart, setConsentImmediateStart] = useState(false);
  const [consentAcknowledgeLoss, setConsentAcknowledgeLoss] = useState(false);

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
    // Defensive double-check — Server validiert noch einmal.
    if (!consentImmediateStart || !consentAcknowledgeLoss) {
      setError("consent_required");
      return;
    }
    start(async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity,
          consent_immediate_start: true,
          consent_acknowledge_loss: true,
        }),
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

  // Bei aktivem Abo: Slider startet bei der aktuell gebuchten Quantity.
  // Downgrade ist erlaubt, solange property_count ≤ neue Quantity (sonst
  // verlieren die Premium-Features ihre Berechtigung).
  const [upgradeQuantity, setUpgradeQuantity] = useState<number>(
    Math.max(subscribedQuantity, propertyCount)
  );
  const upgradeTier = tierForQuantity(upgradeQuantity);
  const isQuantityChanged = upgradeQuantity !== subscribedQuantity;

  async function onQuantityUpgrade() {
    setError(null);
    setUpgradeResult(null);
    start(async () => {
      const res = await fetch("/api/billing/quantity-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: upgradeQuantity }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        subscribed_quantity?: number;
        previous_quantity?: number;
        proration_total_cents?: number;
        amount_paid_cents?: number;
        currency?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "unknown");
        return;
      }
      // Erfolgs-Banner anzeigen + Server-State refreshen (Status-Karte
      // oben + Quantity-Slider-Default lesen den neuen Wert).
      setUpgradeResult({
        previousQuantity: json.previous_quantity ?? 0,
        newQuantity: json.subscribed_quantity ?? upgradeQuantity,
        prorationTotalCents: json.proration_total_cents ?? 0,
        amountPaidCents: json.amount_paid_cents ?? 0,
        currency: json.currency ?? "eur",
      });
      router.refresh();
    });
  }

  function formatCents(cents: number, currency: string): string {
    return (cents / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    });
  }

  return (
    <section
      ref={subscribeRef}
      className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
    >
      {upgradeResult && <UpgradeSuccessBanner
        result={upgradeResult}
        formatCents={formatCents}
        onDismiss={() => setUpgradeResult(null)}
      />}

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

          {/* Quantity-Adjust direkt in der App. Stripe rechnet Proration. */}
          <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800 pt-5">
            <h3 className="text-sm font-semibold">
              {t("billing.adjust_quantity_title")}
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {t("billing.adjust_quantity_help")}
            </p>

            <div className="mt-4">
              <label className="text-sm font-medium block mb-2">
                {t("billing.quantity_label")}:{" "}
                <span className="tabular-nums">{upgradeQuantity}</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  ({t("billing.quantity_unit")})
                </span>
              </label>
              <input
                type="range"
                min={Math.max(propertyCount, 2)}
                max={maxQuantity}
                step={1}
                value={upgradeQuantity}
                onChange={(e) => setUpgradeQuantity(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                <span>{Math.max(propertyCount, 2)}</span>
                <span>{maxQuantity}+</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 p-3 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {upgradeTier.label} ({upgradeQuantity} {t("billing.quantity_unit_short")})
                </span>
                <span className="text-xl font-semibold tabular-nums">
                  {upgradeTier.yearlyEur === 0
                    ? t("billing.free")
                    : upgradeTier.yearlyEur.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 2,
                      })}
                  <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    {upgradeTier.yearlyEur > 0 && ` / ${t("billing.per_year")}`}
                  </span>
                </span>
              </div>
              {isQuantityChanged && (
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-snug">
                  {upgradeQuantity > subscribedQuantity
                    ? t("billing.adjust_proration_up", {
                        from: subscribedQuantity,
                        to: upgradeQuantity,
                      })
                    : t("billing.adjust_proration_down", {
                        from: subscribedQuantity,
                        to: upgradeQuantity,
                      })}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onQuantityUpgrade}
              disabled={pending || !isQuantityChanged}
              className="mt-4 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending
                ? t("common.loading")
                : upgradeQuantity > subscribedQuantity
                  ? t("billing.adjust_upgrade_action")
                  : upgradeQuantity < subscribedQuantity
                    ? t("billing.adjust_downgrade_action")
                    : t("billing.adjust_no_change")}
            </button>
          </div>

          <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800 pt-5">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
              {t("billing.manage_subscription_help")}
            </p>
            <button
              type="button"
              onClick={onOpenPortal}
              disabled={pending}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {pending ? t("common.loading") : t("billing.manage_subscription")}
            </button>
          </div>
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

          {/* Pflichtangaben nach § 312j Abs. 2 BGB: wesentliche Eigenschaften,
              Gesamtpreis, Laufzeit — direkt oberhalb des Bestell-Buttons. */}
          <div className="mt-5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              {t("billing.checkout_summary_title")}
            </div>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-600 dark:text-neutral-400">
                  {t("billing.checkout_summary_product")}
                </dt>
                <dd className="text-right">
                  {tier.label} · {quantity} {t("billing.quantity_unit_short")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-600 dark:text-neutral-400">
                  {t("billing.checkout_summary_total")}
                </dt>
                <dd className="text-right font-semibold tabular-nums">
                  {tier.yearlyEur.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    minimumFractionDigits: 2,
                  })}{" "}
                  / {t("billing.per_year")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-600 dark:text-neutral-400">
                  {t("billing.checkout_summary_term")}
                </dt>
                <dd className="text-right">
                  {t("billing.checkout_summary_term_value")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-600 dark:text-neutral-400">
                  {t("billing.checkout_summary_vat")}
                </dt>
                <dd className="text-right">
                  {t("billing.checkout_summary_vat_value")}
                </dd>
              </div>
            </dl>
          </div>

          {/* Widerrufsverzicht (§ 356 Abs. 4/5 BGB). Zwei SEPARATE
              Checkboxen — kombinierte Klausel wäre nach BGH unwirksam. */}
          <div className="mt-4 space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4">
            <label className="flex items-start gap-2.5 text-xs leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={consentImmediateStart}
                onChange={(e) => setConsentImmediateStart(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span>{t("billing.consent_immediate_start")}</span>
            </label>
            <label className="flex items-start gap-2.5 text-xs leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={consentAcknowledgeLoss}
                onChange={(e) => setConsentAcknowledgeLoss(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span>{t("billing.consent_acknowledge_loss")}</span>
            </label>
          </div>

          <button
            type="button"
            onClick={onSubscribe}
            disabled={
              pending || !consentImmediateStart || !consentAcknowledgeLoss
            }
            className="mt-5 rounded-lg bg-accent text-accent-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending
              ? t("common.loading")
              : t("billing.subscribe_action_legal")}
          </button>
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            {t("billing.subscribe_action_hint")}
          </p>
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

/**
 * Grünes (Upgrade) bzw. blaues (Downgrade) Erfolgs-Banner direkt nach
 * dem Quantity-Update. Zeigt vorigen → neuen Wert und den von Stripe
 * abgebuchten / gutgeschriebenen Betrag.
 *
 * Wird nicht automatisch ausgeblendet — der User kann es selbst
 * schließen, damit er den Betrag in Ruhe lesen kann.
 */
function UpgradeSuccessBanner({
  result,
  formatCents,
  onDismiss,
}: {
  result: UpgradeResult;
  formatCents: (cents: number, currency: string) => string;
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const isUpgrade = result.newQuantity > result.previousQuantity;
  const charged = result.amountPaidCents;
  const total = result.prorationTotalCents;

  // Bei Upgrade: Stripe hat den positiven `amount_paid` direkt eingezogen.
  // Bei Downgrade: amount_paid ist meistens 0, der Credit landet als
  // negativer `total` im account_balance des Customers.
  const showCharge = isUpgrade && charged > 0;
  const showCredit = !isUpgrade && total < 0;

  return (
    <div
      className={
        "mb-5 rounded-xl border px-4 py-3 text-sm " +
        (isUpgrade
          ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200"
          : "border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {isUpgrade
              ? t("billing.banner_upgrade_title")
              : t("billing.banner_downgrade_title")}
          </p>
          <p className="mt-1">
            {t("billing.banner_quantity_change", {
              from: result.previousQuantity,
              to: result.newQuantity,
            })}
          </p>
          {showCharge && (
            <p className="mt-1">
              {t("billing.banner_charged", {
                amount: formatCents(charged, result.currency),
              })}
            </p>
          )}
          {showCredit && (
            <p className="mt-1">
              {t("billing.banner_credited", {
                amount: formatCents(Math.abs(total), result.currency),
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.cancel")}
          className="shrink-0 text-lg leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
