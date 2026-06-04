"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { AccountStatus } from "@/lib/connect/account";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  currency: string | null;
};

/**
 * Client-Seite des /connect-Dashboards. Hält den Zustand für:
 *   - Account-Create-Maske (Display Name + Contact-Email)
 *   - Produkt-Anlege-Maske
 *   - Loading-States für die jeweiligen API-Roundtrips
 *
 * Alle Mutationen rufen die /api/connect/*-Endpunkte direkt per fetch
 * auf (statt Server-Actions), weil wir Redirects nach Stripe brauchen
 * (window.location.href).
 */
export function ConnectDashboardClient({
  workspaceName,
  defaultDisplayName,
  defaultContactEmail,
  hasAccount,
  stripeAccountId,
  accountStatus,
  platformSubscriptionId,
  platformSubscriptionStatus,
  platformSubscriptionEnd,
  products,
  queryStatus,
}: {
  workspaceName: string;
  defaultDisplayName: string;
  defaultContactEmail: string;
  hasAccount: boolean;
  stripeAccountId: string | null;
  accountStatus: AccountStatus | null;
  platformSubscriptionId: string | null;
  platformSubscriptionStatus: string | null;
  platformSubscriptionEnd: string | null;
  products: Product[];
  queryStatus: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pendingAction, startAction] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // -- Account-Create ----------------------------------------------------
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);

  async function onCreateAccount() {
    setError(null);
    startAction(async () => {
      const res = await fetch("/api/connect/accounts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          contact_email: contactEmail,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "unknown");
        return;
      }
      router.refresh();
    });
  }

  // -- Onboarding-Link --------------------------------------------------
  async function onOnboard() {
    setError(null);
    startAction(async () => {
      const res = await fetch("/api/connect/accounts/onboarding-link", {
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

  // -- Produkt anlegen --------------------------------------------------
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");

  async function onCreateProduct() {
    setError(null);
    const priceNum = Number(productPrice.replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("invalid_price");
      return;
    }
    startAction(async () => {
      const res = await fetch("/api/connect/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productName,
          description: productDescription || null,
          price_eur: priceNum,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "unknown");
        return;
      }
      setProductName("");
      setProductDescription("");
      setProductPrice("");
      router.refresh();
    });
  }

  // -- Plattform-Subscription -------------------------------------------
  async function onSubscribePlatform() {
    setError(null);
    startAction(async () => {
      const res = await fetch("/api/connect/subscription/create", {
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

  async function onOpenSubscriptionPortal() {
    setError(null);
    startAction(async () => {
      const res = await fetch("/api/connect/subscription/portal", {
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

  return (
    <div className="mt-6 space-y-6">
      {queryStatus === "success" && (
        <Banner kind="success">{t("connect.payment_success")}</Banner>
      )}
      {queryStatus === "cancelled" && (
        <Banner kind="info">{t("connect.payment_cancelled")}</Banner>
      )}
      {queryStatus === "subscribed" && (
        <Banner kind="success">{t("connect.subscription_success")}</Banner>
      )}

      {/* === Schritt 1: Account erstellen + onboarden ================= */}
      {!hasAccount ? (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">
            {t("connect.create_account_title")}
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
            {t("connect.create_account_help")}
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
            <div>
              <label className={labelClass}>{t("connect.display_name")}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={workspaceName}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("connect.contact_email")}</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onCreateAccount}
            disabled={pendingAction || !displayName || !contactEmail}
            className="mt-4 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pendingAction
              ? t("common.loading")
              : t("connect.create_account_action")}
          </button>
        </section>
      ) : (
        <>
          {/* Account-Status-Karte */}
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t("connect.account_id")}
                </p>
                <p className="mt-1 font-mono text-sm">{stripeAccountId}</p>
                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t("connect.status")}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <StatusBadge
                    label={t("connect.payments_ready")}
                    ok={accountStatus?.readyToProcessPayments ?? false}
                  />
                  <StatusBadge
                    label={t("connect.onboarding_complete")}
                    ok={accountStatus?.onboardingComplete ?? false}
                  />
                </div>
                {accountStatus?.dueRequirements &&
                  accountStatus.dueRequirements.length > 0 && (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                      {t("connect.due_requirements")}:{" "}
                      {accountStatus.dueRequirements.join(", ")}
                    </p>
                  )}
              </div>
              {!accountStatus?.onboardingComplete && (
                <button
                  type="button"
                  onClick={onOnboard}
                  disabled={pendingAction}
                  className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {pendingAction
                    ? t("common.loading")
                    : t("connect.onboard_action")}
                </button>
              )}
            </div>
          </section>

          {/* Plattform-Subscription */}
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">
              {t("connect.platform_sub_title")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
              {t("connect.platform_sub_help")}
            </p>
            <div className="mt-4 flex items-center gap-3">
              {platformSubscriptionId ? (
                <>
                  <StatusBadge
                    label={
                      platformSubscriptionStatus ?? t("connect.status_unknown")
                    }
                    ok={
                      platformSubscriptionStatus === "active" ||
                      platformSubscriptionStatus === "trialing"
                    }
                  />
                  {platformSubscriptionEnd && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t("connect.platform_sub_renewal", {
                        date: formatDate(platformSubscriptionEnd),
                      })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onOpenSubscriptionPortal}
                    disabled={pendingAction}
                    className="ml-auto rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {pendingAction
                      ? t("common.loading")
                      : t("connect.platform_sub_manage")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onSubscribePlatform}
                  disabled={pendingAction}
                  className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {pendingAction
                    ? t("common.loading")
                    : t("connect.platform_sub_subscribe")}
                </button>
              )}
            </div>
          </section>

          {/* Produkte */}
          {accountStatus?.readyToProcessPayments && (
            <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("connect.products_title")}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {t("connect.products_help")}
                  </p>
                </div>
                <a
                  href={`/connect/storefront/${stripeAccountId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-neutral-700 dark:text-neutral-300 hover:underline whitespace-nowrap"
                >
                  {t("connect.open_storefront")} →
                </a>
              </div>

              {/* Add-Form */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder={t("connect.product_name")}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="text"
                  placeholder={t("connect.product_description")}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={t("connect.product_price_eur")}
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className={inputClass + " flex-1"}
                  />
                  <button
                    type="button"
                    onClick={onCreateProduct}
                    disabled={pendingAction || !productName || !productPrice}
                    className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {pendingAction ? "…" : "+"}
                  </button>
                </div>
              </div>

              {/* Liste */}
              <div className="mt-6">
                {products.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t("connect.products_empty")}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 dark:bg-neutral-950">
                        <tr className="text-left">
                          <th className={thClass}>
                            {t("connect.product_name")}
                          </th>
                          <th className={thClass}>
                            {t("connect.product_description")}
                          </th>
                          <th className={thClass + " text-right"}>
                            {t("connect.product_price")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-neutral-200 dark:border-neutral-800"
                          >
                            <td className={tdClass + " font-medium"}>
                              {p.name}
                            </td>
                            <td className={tdClass}>{p.description ?? "—"}</td>
                            <td className={tdClass + " text-right tabular-nums"}>
                              {p.priceCents != null && p.currency
                                ? formatPrice(p.priceCents, p.currency)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t("connect.error_prefix")}: {error}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  const palette = ok
    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200"
    : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${palette}`}
    >
      {ok ? "✓" : "○"} {label}
    </span>
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

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";
const labelClass = "text-sm font-medium block mb-1";
const thClass =
  "px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider";
const tdClass = "px-4 py-2 align-middle";
