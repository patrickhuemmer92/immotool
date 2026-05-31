"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Props =
  | { kind: "checkout"; lookupKey: string; label: string }
  | { kind: "portal"; label?: string };

export function BillingActions(props: Props) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setError(null);
    setLoading(true);
    try {
      const endpoint =
        props.kind === "checkout" ? "/api/billing/checkout" : "/api/billing/portal";
      const body =
        props.kind === "checkout"
          ? JSON.stringify({ lookupKey: props.lookupKey })
          : "{}";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "unknown");
        setLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
      setLoading(false);
    }
  }

  const label =
    props.kind === "checkout"
      ? props.label
      : (props.label ?? t("billing.manage_subscription"));

  return (
    <div className="flex flex-col items-end gap-1 w-full">
      <button
        type="button"
        onClick={trigger}
        disabled={loading}
        className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? t("common.loading") : label}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
