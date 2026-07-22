"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

/**
 * Kompakter Paywall-Block: Kauf-CTA + Feature-Liste.
 * Nach erfolgreichem Checkout markiert der Webhook dd_projects.paid=true,
 * die Detail-Seite refreshed und dieser Block verschwindet.
 */
export function DdPaywall({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onCheckout() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/dd/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dd_project_id: projectId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "unknown" }));
        setError(j?.error ?? res.statusText);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    });
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent-soft p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-accent-foreground">
            {t("dd.paywall_title")}
          </h3>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {t("dd.paywall_body")}
          </p>
          <ul className="mt-4 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
            <li>✓ {t("dd.paywall_feature_findings")}</li>
            <li>✓ {t("dd.paywall_feature_score")}</li>
            <li>✓ {t("dd.paywall_feature_questions")}</li>
            <li>✓ {t("dd.paywall_feature_negotiation")}</li>
            <li>✓ {t("dd.paywall_feature_pdf")}</li>
          </ul>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-accent-foreground">
            29 €
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("dd.paywall_one_off")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={pending}
        className="mt-4 w-full rounded-lg bg-accent text-accent-foreground px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("dd.paywall_cta")}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
