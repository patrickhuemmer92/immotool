"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

export type StorefrontProduct = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
};

/**
 * Client-Komponente der öffentlichen Storefront. Zeigt Produkte und
 * triggert beim Klick auf "Kaufen" das /api/connect/checkout/create-
 * Endpoint (Direct Charge auf dem Connected Account mit Plattform-Fee).
 */
export function StorefrontClient({
  accountId,
  products,
  queryStatus,
}: {
  accountId: string;
  products: StorefrontProduct[];
  queryStatus: string | null;
}) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [activeProduct, setActiveProduct] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onBuy(productId: string) {
    setError(null);
    setActiveProduct(productId);
    start(async () => {
      const res = await fetch("/api/connect/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          product_id: productId,
          quantity: 1,
        }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "unknown");
        setActiveProduct(null);
        return;
      }
      window.location.href = json.url;
    });
  }

  return (
    <div className="mt-8">
      {queryStatus === "success" && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 px-4 py-3 text-sm mb-6">
          {t("storefront.payment_success")}
        </div>
      )}
      {queryStatus === "cancelled" && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 px-4 py-3 text-sm mb-6">
          {t("storefront.payment_cancelled")}
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("storefront.no_products")}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col"
            >
              <h2 className="font-semibold text-lg">{p.name}</h2>
              {p.description && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
                  {p.description}
                </p>
              )}
              <p className="mt-4 text-2xl font-semibold tabular-nums">
                {formatPrice(p.priceCents, p.currency)}
              </p>
              <div className="mt-4 flex-1 flex items-end">
                <button
                  type="button"
                  onClick={() => onBuy(p.id)}
                  disabled={pending}
                  className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {pending && activeProduct === p.id
                    ? t("common.loading")
                    : t("storefront.buy")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {t("storefront.error_prefix")}: {error}
        </p>
      )}
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
