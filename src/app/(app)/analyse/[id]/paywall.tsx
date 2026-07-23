"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

type DocState = {
  kind: string;
  ocr_status: string;
};

/**
 * Paywall + Doku-Voraussetzungs-Gate.
 *
 * Aktueller Flow-Design:
 *   1) Exposé ist verpflichtend (kommt vom Wizard-Schritt 1 vor).
 *   2) Für die 29-€-Analyse muss mindestens WEG-Protokoll ODER
 *      Wirtschaftsplan erfolgreich extrahiert sein. Sonst wäre die
 *      Score-Konfidenz nur ~30 %, was den Kaufwert killt.
 *   3) Wenn die Voraussetzung nicht erfüllt ist: freundliche Karte
 *      mit Erklärung wo man die Doku herbekommt (Käufer hat als
 *      Kaufinteressent Anspruch darauf — steht im WEG-Recht).
 *   4) Erst wenn die Voraussetzung erfüllt ist: Preis + CTA.
 *
 * Belt & Braces: die Checkout-Route lehnt einen Kauf ohne diese Doku
 * mit 412 Precondition Failed ab — selbst wenn der Client das Gate
 * umgehen würde.
 */
export function DdPaywall({
  projectId,
  docs,
}: {
  projectId: string;
  docs: DocState[];
}) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasWeg = docs.some(
    (d) => d.kind === "weg_minutes" && d.ocr_status === "extracted"
  );
  const hasWp = docs.some(
    (d) => d.kind === "wirtschaftsplan" && d.ocr_status === "extracted"
  );
  const wegPending = docs.some(
    (d) => d.kind === "weg_minutes" && d.ocr_status === "pending"
  );
  const wpPending = docs.some(
    (d) => d.kind === "wirtschaftsplan" && d.ocr_status === "pending"
  );

  const gateOk = hasWeg || hasWp;

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
        setError(j?.detail ?? j?.error ?? res.statusText);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    });
  }

  if (!gateOk) {
    return (
      <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-6">
        <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200">
          {t("dd.gate_title")}
        </h3>
        <p className="mt-2 text-sm text-blue-900 dark:text-blue-200">
          {t("dd.gate_body")}
        </p>

        {/* Status-Zeile pro benötigtem Doku-Typ */}
        <div className="mt-4 space-y-2">
          <GateRow
            label={t("dd.gate_weg")}
            state={
              hasWeg
                ? "ok"
                : wegPending
                  ? "processing"
                  : "missing"
            }
            t={t}
          />
          <GateRow
            label={t("dd.gate_wp")}
            state={
              hasWp
                ? "ok"
                : wpPending
                  ? "processing"
                  : "missing"
            }
            t={t}
          />
        </div>

        <p className="mt-4 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          {t("dd.gate_where_from")}
        </p>

        <details className="mt-3 text-xs text-blue-800 dark:text-blue-300">
          <summary className="cursor-pointer hover:text-blue-900 dark:hover:text-blue-100">
            {t("dd.gate_why_title")}
          </summary>
          <p className="mt-2 leading-relaxed">{t("dd.gate_why_body")}</p>
        </details>
      </div>
    );
  }

  // Gate erfüllt → normale Paywall
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
          <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
            {t("dd.paywall_ready_hint")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-accent-foreground">29 €</p>
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

function GateRow({
  label,
  state,
  t,
}: {
  label: string;
  state: "ok" | "processing" | "missing";
  t: ReturnType<typeof useTranslations>;
}) {
  const icon =
    state === "ok" ? "✓" : state === "processing" ? "…" : "○";
  const cls =
    state === "ok"
      ? "text-green-700 dark:text-green-300"
      : state === "processing"
        ? "text-blue-700 dark:text-blue-300"
        : "text-blue-900 dark:text-blue-200 opacity-70";
  const status =
    state === "ok"
      ? t("dd.gate_row_ok")
      : state === "processing"
        ? t("dd.gate_row_processing")
        : t("dd.gate_row_missing");
  return (
    <div className={`flex items-center gap-2 text-sm ${cls}`}>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/50 dark:bg-black/20 text-xs">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-xs italic">{status}</span>
    </div>
  );
}
