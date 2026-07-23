"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { unlockOnboardingForTest } from "../actions";

export function OnboardingPaywall({
  projectId,
  isAdmin = false,
}: {
  projectId: string;
  isAdmin?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [bypassPending, startBypass] = useTransition();
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

  function onTestBypass() {
    if (!confirm(t("dd.bypass_confirm"))) return;
    setError(null);
    startBypass(async () => {
      const result = await unlockOnboardingForTest(projectId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
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
      {isAdmin && (
        <div className="mt-4 pt-4 border-t border-dashed border-red-300 dark:border-red-800">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-red-600 dark:text-red-400 mb-2">
            {t("dd.bypass_zone")}
          </p>
          <button
            type="button"
            onClick={onTestBypass}
            disabled={bypassPending}
            className="w-full rounded-lg border-2 border-dashed border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 bg-white/50 dark:bg-black/20 px-3 py-2 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
          >
            {bypassPending ? "…" : t("dd.bypass_cta")}
          </button>
          <p className="mt-1 text-[10px] text-red-600/70 dark:text-red-400/70">
            {t("dd.bypass_hint")}
          </p>
        </div>
      )}
    </div>
  );
}
