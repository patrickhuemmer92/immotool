"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Finding = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  cost_min: number | null;
  cost_max: number | null;
  source_quote: string | null;
  source_location: string | null;
  source_market: string | null;
  confidence: number;
  confidence_reason: string | null;
  next_step: string | null;
};

type CategoryScore = {
  score: number;
  ampel: "green" | "yellow" | "red";
  count_high?: number;
  count_medium?: number;
  count_low?: number;
  count_positive?: number;
};

export function CategoryCard({
  categoryKey,
  findings,
  score,
  defaultOpen = false,
}: {
  categoryKey: string;
  findings: Finding[];
  score: CategoryScore | null;
  defaultOpen?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(defaultOpen);

  const ampelColor =
    score?.ampel === "green"
      ? "bg-green-500"
      : score?.ampel === "yellow"
        ? "bg-amber-500"
        : score?.ampel === "red"
          ? "bg-red-500"
          : "bg-neutral-300";

  const highCount = score?.count_high ?? 0;
  const mediumCount = score?.count_medium ?? 0;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header — klickbar zum Aufklappen */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${ampelColor}`} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">
              {t(`dd.cat_${categoryKey}`)}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {score != null ? `${Math.round(score.score)}/100 · ` : ""}
              {highCount > 0 && (
                <span className="text-red-700 dark:text-red-400 font-medium">
                  {highCount} {t("dd.cockpit_high_short")}
                </span>
              )}
              {highCount > 0 && mediumCount > 0 && " · "}
              {mediumCount > 0 && (
                <span>
                  {mediumCount} {t("dd.cockpit_medium_short")}
                </span>
              )}
              {highCount === 0 && mediumCount === 0 && (
                <span>{t("dd.cockpit_no_issues")}</span>
              )}
              {" · "}
              {findings.length}{" "}
              {findings.length === 1 ? t("dd.finding_single") : t("dd.finding_plural")}
            </p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Inhalt (default zu) */}
      {open && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
          {findings.map((f) => (
            <FindingItem key={f.id} finding={f} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingItem({
  finding,
  t,
}: {
  finding: Finding;
  t: ReturnType<typeof useTranslations>;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const borderColor =
    finding.severity === "high"
      ? "border-red-200 dark:border-red-900"
      : finding.severity === "medium"
        ? "border-amber-200 dark:border-amber-900"
        : finding.severity === "positive"
          ? "border-green-200 dark:border-green-900"
          : "border-neutral-200 dark:border-neutral-800";

  const sevChipColor =
    finding.severity === "high"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : finding.severity === "medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : finding.severity === "positive"
          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";

  const confLabel =
    finding.confidence >= 0.8
      ? t("dd.conf_high")
      : finding.confidence >= 0.5
        ? t("dd.conf_medium")
        : t("dd.conf_low");

  return (
    <div className={`rounded-lg border ${borderColor} p-3`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${sevChipColor}`}
            >
              {t(`dd.sev_${finding.severity}`)}
            </span>
            <span
              title={`${Math.round(finding.confidence * 100)} %`}
              className="inline-flex items-center rounded-full border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400"
            >
              {confLabel}
            </span>
          </div>
          <p className="mt-1.5 font-medium text-sm">{finding.title}</p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {finding.description}
          </p>
        </div>
        {(finding.cost_min != null || finding.cost_max != null) && (
          <div className="text-right text-sm tabular-nums shrink-0">
            <p className="text-neutral-500 dark:text-neutral-400 text-xs">
              {t("dd.cost")}
            </p>
            <p className="font-semibold">
              {fmtEurRange(finding.cost_min, finding.cost_max)}
            </p>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-neutral-500 dark:text-neutral-400 hover:underline"
        >
          {showDetails ? t("dd.hide_details") : t("dd.show_details")}
        </button>
      </div>
      {showDetails && (
        <div className="mt-3 space-y-2 text-xs">
          {finding.source_quote && (
            <blockquote className="border-l-2 border-neutral-300 dark:border-neutral-700 pl-3 italic text-neutral-700 dark:text-neutral-300">
              „{finding.source_quote}"
              {finding.source_location && (
                <span className="not-italic text-neutral-500 ml-2">
                  ({finding.source_location})
                </span>
              )}
            </blockquote>
          )}
          {finding.source_market && (
            <p className="text-neutral-500 dark:text-neutral-400">
              {t("dd.source_market")}: {finding.source_market}
            </p>
          )}
          {finding.confidence_reason && (
            <p className="text-neutral-500 dark:text-neutral-400">
              <strong>{t("dd.confidence_reason")}:</strong>{" "}
              {finding.confidence_reason}
            </p>
          )}
          {finding.next_step && (
            <p>
              <strong>{t("dd.next_step")}:</strong> {finding.next_step}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function fmtEurRange(minCents: number | null, maxCents: number | null): string {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  if (minCents != null && maxCents != null)
    return `${fmt(minCents)} – ${fmt(maxCents)}`;
  if (minCents != null) return `ab ${fmt(minCents)}`;
  if (maxCents != null) return `bis ${fmt(maxCents)}`;
  return "—";
}
