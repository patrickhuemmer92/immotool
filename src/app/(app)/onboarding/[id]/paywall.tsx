"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

export function OnboardingPaywall({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onCheckout() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/onboarding/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_project_id: projectId }),
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
            {t("onb.paywall_title")}
          </h3>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {t("onb.paywall_body")}
          </p>
          <ul className="mt-4 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
            <li>✓ {t("onb.paywall_feature_extract")}</li>
            <li>✓ {t("onb.paywall_feature_property")}</li>
            <li>✓ {t("onb.paywall_feature_loan_tenant")}</li>
            <li>✓ {t("onb.paywall_feature_quota")}</li>
            <li>✓ {t("onb.paywall_feature_premium_included")}</li>
          </ul>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-accent-foreground">29 €</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("onb.paywall_one_off")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={pending}
        className="mt-4 w-full rounded-lg bg-accent text-accent-foreground px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("onb.paywall_cta")}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
