"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Finding = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  cost_min: number | null;
  cost_max: number | null;
  cost_horizon: string | null;
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
  count_high: number;
  count_medium: number;
  count_low: number;
  count_positive: number;
};

type Question = {
  question: string;
  addressed_to: string;
  priority: string;
  related_finding_titles: string[];
};

type NegotiationArg = {
  argument: string;
  preisabschlag_eur_min: number | null;
  preisabschlag_eur_max: number | null;
  related_finding_titles: string[];
};

/**
 * Score-Speicherformat: Kategorie-Keys → CategoryScore, plus optional
 * `_meta` (Fragen + Verhandlungsargumente) als Sonder-Key. Wir tippen
 * das absichtlich als Union statt Merged Record, weil der Meta-Key
 * eine andere Shape hat als die Kategorie-Values.
 */
type ScoreByCategoryWithMeta = {
  [key: string]:
    | CategoryScore
    | {
        questions: Question[];
        negotiation_arguments: NegotiationArg[];
      };
} & {
  _meta?: {
    questions: Question[];
    negotiation_arguments: NegotiationArg[];
  };
};

const CATEGORIES = [
  "substanz",
  "finanzierung",
  "recht",
  "weg",
  "energie",
  "markt",
  "lage",
] as const;

export function FindingsView({
  projectId,
  scoreOverall,
  scoreConfidence,
  scoreByCategory,
  findings,
  hasEnoughDataForAnalysis,
}: {
  projectId: string;
  scoreOverall: number | null;
  scoreConfidence: number | null;
  scoreByCategory: ScoreByCategoryWithMeta | null;
  findings: Finding[];
  hasEnoughDataForAnalysis: boolean;
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
        // 504 vom Vercel-Gateway hat keinen JSON-Body, sonst würde
        // "unknown" angezeigt. Sprechende Meldung mit Handlungshinweis.
        if (res.status === 504 || res.status === 502) {
          setError(t("dd.analysis_error_timeout"));
          return;
        }
        const j = await res.json().catch(() => null as null);
        setError(j?.error ?? `HTTP ${res.status} · ${res.statusText}`);
        return;
      }
      router.refresh();
    });
  }

  const questions = scoreByCategory?._meta?.questions ?? [];
  const negotiationArgs = scoreByCategory?._meta?.negotiation_arguments ?? [];
  const findingsByCategory = groupBy(findings, "category");

  return (
    <div className="space-y-6">
      {/* Trigger */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">{t("dd.analysis_title")}</h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {scoreOverall != null
              ? t("dd.analysis_rerun_hint")
              : t("dd.analysis_first_hint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={running || !hasEnoughDataForAnalysis}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {running
            ? t("dd.analyzing")
            : scoreOverall != null
              ? t("dd.rerun_analysis")
              : t("dd.run_analysis")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Score-Übersicht */}
      {scoreOverall != null && scoreConfidence != null && scoreByCategory && (
        <ScoreSummary
          overall={scoreOverall}
          confidence={scoreConfidence}
          byCategory={scoreByCategory}
        />
      )}

      {/* Findings pro Kategorie */}
      {findings.length > 0 && (
        <div className="space-y-4">
          {CATEGORIES.filter((c) => findingsByCategory[c]?.length).map((cat) => {
            const cs = scoreByCategory?.[cat] as CategoryScore | undefined;
            return (
            <div
              key={cat}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t(`dd.cat_${cat}`)}
                </h3>
                {cs && (
                  <AmpelChip
                    ampel={cs.ampel}
                    score={cs.score}
                  />
                )}
              </div>
              <ul className="space-y-3">
                {findingsByCategory[cat].map((f) => (
                  <FindingCard key={f.id} finding={f} t={t} />
                ))}
              </ul>
            </div>
            );
          })}
        </div>
      )}

      {/* Fragen an Makler/Verwalter */}
      {questions.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h3 className="text-sm font-semibold mb-3">{t("dd.questions_title")}</h3>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li
                key={i}
                className="text-sm flex items-start gap-2"
              >
                <PriorityDot priority={q.priority} />
                <div className="flex-1">
                  <p className="text-neutral-800 dark:text-neutral-200">{q.question}</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t(`dd.addressed_${q.addressed_to}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verhandlungs-Argumente */}
      {negotiationArgs.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h3 className="text-sm font-semibold mb-3">
            {t("dd.negotiation_title")}
          </h3>
          <ul className="space-y-3">
            {negotiationArgs.map((a, i) => (
              <li
                key={i}
                className="text-sm border-l-2 border-accent pl-3"
              >
                <p className="text-neutral-800 dark:text-neutral-200">{a.argument}</p>
                {(a.preisabschlag_eur_min != null || a.preisabschlag_eur_max != null) && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {t("dd.negotiation_reduction")}:{" "}
                    {fmtRange(a.preisabschlag_eur_min, a.preisabschlag_eur_max)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreSummary({
  overall,
  confidence,
  byCategory,
}: {
  overall: number;
  confidence: number;
  byCategory: ScoreByCategoryWithMeta;
}) {
  const overallColor =
    overall >= 65
      ? "text-green-600 dark:text-green-400"
      : overall >= 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Gesamt-Score
          </p>
          <p className={`text-3xl font-bold tabular-nums ${overallColor}`}>
            {overall}
            <span className="text-lg text-neutral-400">/100</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Konfidenz
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {Math.round(confidence * 100)}%
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {CATEGORIES.map((c) => {
          const cs = byCategory[c] as CategoryScore | undefined;
          if (!cs) return null;
          return (
            <div
              key={c}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
                {c}
              </p>
              <p
                className={`mt-0.5 text-lg font-semibold tabular-nums ${
                  cs.ampel === "green"
                    ? "text-green-600 dark:text-green-400"
                    : cs.ampel === "yellow"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {Math.round(cs.score)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FindingCard({
  finding,
  t,
}: {
  finding: Finding;
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = useState(false);
  const borderColor =
    finding.severity === "high"
      ? "border-red-200 dark:border-red-900"
      : finding.severity === "medium"
        ? "border-amber-200 dark:border-amber-900"
        : finding.severity === "positive"
          ? "border-green-200 dark:border-green-900"
          : "border-neutral-200 dark:border-neutral-800";
  return (
    <li className={`rounded-lg border ${borderColor} p-3`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityChip severity={finding.severity} t={t} />
            <ConfidenceChip confidence={finding.confidence} t={t} />
          </div>
          <p className="mt-1 font-medium">{finding.title}</p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {finding.description}
          </p>
        </div>
        {(finding.cost_min != null || finding.cost_max != null) && (
          <div className="text-right text-sm tabular-nums">
            <p className="text-neutral-500 dark:text-neutral-400 text-xs">
              Kosten
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
          onClick={() => setExpanded(!expanded)}
          className="text-neutral-500 dark:text-neutral-400 hover:underline"
        >
          {expanded ? t("dd.hide_details") : t("dd.show_details")}
        </button>
      </div>
      {expanded && (
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
    </li>
  );
}

function SeverityChip({
  severity,
  t,
}: {
  severity: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const cls =
    severity === "high"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : severity === "medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : severity === "positive"
          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {t(`dd.sev_${severity}`)}
    </span>
  );
}

function ConfidenceChip({
  confidence,
  t,
}: {
  confidence: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const label =
    confidence >= 0.8
      ? t("dd.conf_high")
      : confidence >= 0.5
        ? t("dd.conf_medium")
        : t("dd.conf_low");
  return (
    <span
      title={`${Math.round(confidence * 100)} %`}
      className="inline-flex items-center rounded-full border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400"
    >
      {label}
    </span>
  );
}

function AmpelChip({
  ampel,
  score,
}: {
  ampel: "green" | "yellow" | "red";
  score: number;
}) {
  const cls =
    ampel === "green"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : ampel === "yellow"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${cls}`}
    >
      {Math.round(score)}/100
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "high"
      ? "bg-red-500"
      : priority === "medium"
        ? "bg-amber-500"
        : "bg-neutral-400";
  return (
    <span className={`inline-block h-2 w-2 rounded-full mt-2 shrink-0 ${color}`} />
  );
}

function groupBy<T extends { [K in string]: unknown }, K extends keyof T>(
  items: T[],
  key: K
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = String(item[key]);
    (out[k] ??= []).push(item);
  }
  return out;
}

function fmtEurRange(minCents: number | null, maxCents: number | null): string {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  if (minCents != null && maxCents != null) return `${fmt(minCents)} – ${fmt(maxCents)}`;
  if (minCents != null) return `ab ${fmt(minCents)}`;
  if (maxCents != null) return `bis ${fmt(maxCents)}`;
  return "—";
}

function fmtRange(min: number | null, max: number | null): string {
  const fmt = (v: number) =>
    v.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `ab ${fmt(min)}`;
  if (max != null) return `bis ${fmt(max)}`;
  return "—";
}
