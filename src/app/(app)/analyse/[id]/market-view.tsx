"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Snapshot = {
  points: Array<{
    metric: string;
    value_num: number | null;
    value_text: string | null;
    unit: string | null;
    source: string;
    source_url: string | null;
    source_date: string | null;
  }>;
  computed_at: string;
  eur_per_sqm: number | null;
  price_position: "under" | "at" | "over" | null;
  price_deviation_pct: number | null;
};

export function MarketView({
  projectId,
  snapshot,
  canFetch,
}: {
  projectId: string;
  snapshot: Snapshot | null;
  canFetch: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onFetch() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/dd/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dd_project_id: projectId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "unknown" }));
        setError(j?.error ?? res.statusText);
        return;
      }
      router.refresh();
    });
  }

  const transitPoint = snapshot?.points.find(
    (p) => p.metric === "nearby_transit_800m"
  );
  const supermarketPoint = snapshot?.points.find(
    (p) => p.metric === "nearby_supermarket_800m"
  );
  const schoolPoint = snapshot?.points.find(
    (p) => p.metric === "nearby_school_800m"
  );
  const nearbyStatus = snapshot?.points.find(
    (p) => p.metric === "nearby_status"
  )?.value_text;
  const nearbyUnavailable = nearbyStatus === "unavailable";

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">{t("dd.market_title")}</h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {snapshot
              ? t("dd.market_recomputable")
              : t("dd.market_intro")}
          </p>
        </div>
        <button
          type="button"
          onClick={onFetch}
          disabled={pending || !canFetch}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending
            ? t("common.loading")
            : snapshot
              ? t("dd.market_refresh")
              : t("dd.market_fetch")}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {snapshot && (
        <div className="mt-4 space-y-4">
          {snapshot.eur_per_sqm != null && (
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t("dd.market_eur_per_sqm")}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {snapshot.eur_per_sqm.toLocaleString("de-DE")} €/m²
              </p>
              {snapshot.price_position == null && (
                <p className="text-[11px] text-neutral-400">
                  {t("dd.market_no_reference")}
                </p>
              )}
            </div>
          )}

          {nearbyUnavailable ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              {t("dd.market_nearby_unavailable")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <NearbyBadge
                label={t("dd.market_transit")}
                count={transitPoint?.value_num ?? null}
              />
              <NearbyBadge
                label={t("dd.market_supermarket")}
                count={supermarketPoint?.value_num ?? null}
              />
              <NearbyBadge
                label={t("dd.market_schools")}
                count={schoolPoint?.value_num ?? null}
              />
            </div>
          )}

          <details className="text-xs text-neutral-500 dark:text-neutral-400">
            <summary className="cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300">
              {t("dd.market_show_all")}
            </summary>
            <ul className="mt-2 space-y-1">
              {snapshot.points.map((p) => (
                <li key={p.metric} className="flex justify-between gap-3">
                  <span className="truncate">{p.metric}</span>
                  <span className="tabular-nums">
                    {p.value_num != null
                      ? p.value_num.toLocaleString("de-DE")
                      : p.value_text ?? "—"}{" "}
                    <span className="text-neutral-400 ml-1">({p.source})</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
            {t("dd.market_computed_at", {
              date: new Date(snapshot.computed_at).toLocaleString("de-DE"),
            })}
          </p>
        </div>
      )}
    </div>
  );
}

function NearbyBadge({
  label,
  count,
}: {
  label: string;
  count: number | null;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">
        {count == null ? "—" : count}
      </p>
    </div>
  );
}
