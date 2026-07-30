"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * KI-Analyse-Trigger — ganz oben auf der Ergebnis-Seite platziert.
 * Startet den /api/dd/analyze-Call und refresht die Seite mit den
 * neuen Findings + Score. Auch für Neu-Berechnung nach Doku-Nachtrag.
 */
export function AnalyzeButton({
  projectId,
  hasScore,
  hasEnoughData,
}: {
  projectId: string;
  hasScore: boolean;
  hasEnoughData: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [running, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAnalyze() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/dd/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dd_project_id: projectId }),
      });
      if (!res.ok) {
        if (res.status === 504 || res.status === 502) {
          setError(t("dd.analysis_error_timeout"));
          return;
        }
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `HTTP ${res.status} · ${res.statusText}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {hasScore ? t("dd.analysis_rerun_title") : t("dd.analysis_start_title")}
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {hasScore
              ? t("dd.analysis_rerun_hint")
              : t("dd.analysis_first_hint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={running || !hasEnoughData}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {running
            ? t("dd.analyzing")
            : hasScore
              ? t("dd.rerun_analysis")
              : t("dd.run_analysis")}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
