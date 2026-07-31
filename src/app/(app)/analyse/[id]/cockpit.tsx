/**
 * DD-Cockpit — kompakter Header über der Analyse, statt Endlos-Scrollen.
 *
 * Zeigt auf einen Blick:
 *   - Konfidenz-Tacho (Halbkreis)
 *   - Score als große Zahl mit Ampel-Farbe
 *   - Doku-Checklist-Pills (was hochgeladen, was fehlt für die
 *     gewählte Objektart)
 *   - 4 Kategorie-Kacheln (Lage / Substanz / Wirtschaft / Recht)
 *     mit One-Liner + Ampel
 *
 * Server-Component — reines Rendering, keine Client-State-Logik.
 * Details klappen im FindingsView-Block darunter aus.
 */

import { getTranslations } from "next-intl/server";
import {
  DOC_RELEVANCE,
  type DocumentKind,
  type PropertyType,
} from "@/lib/dd/property-type";

type CategoryScore = {
  score: number;
  ampel: "green" | "yellow" | "red";
  count_high?: number;
  count_medium?: number;
  count_low?: number;
  count_positive?: number;
};

const KIND_LABEL_KEY: Record<DocumentKind, string> = {
  expose: "dd.doc_kind_expose",
  weg_minutes: "dd.doc_kind_weg",
  wirtschaftsplan: "dd.doc_kind_budget",
  teilungserklaerung: "dd.doc_kind_teilung",
  energieausweis: "dd.doc_kind_energie",
  grundriss: "dd.doc_kind_grundriss",
  grundbuchauszug: "dd.doc_kind_grundbuch",
  mieterliste: "dd.doc_kind_mieterliste",
  other: "dd.doc_kind_other",
};

/** Für die 4-Kachel-Übersicht: interne Findings-Kategorien werden in
 *  fachliche Cockpit-Kategorien gemappt. */
const COCKPIT_TILES: Array<{
  key: "substanz" | "wirtschaft" | "recht" | "lage";
  merged_from: string[];
  labelKey: string;
}> = [
  { key: "substanz", merged_from: ["substanz", "energie"], labelKey: "dd.cockpit_substanz" },
  { key: "wirtschaft", merged_from: ["finanzierung", "markt"], labelKey: "dd.cockpit_wirtschaft" },
  { key: "recht", merged_from: ["recht", "weg"], labelKey: "dd.cockpit_recht" },
  { key: "lage", merged_from: ["lage"], labelKey: "dd.cockpit_lage" },
];

export async function DdCockpit({
  scoreOverall,
  scoreConfidence,
  scoreByCategory,
  propertyType,
  uploadedKinds,
}: {
  scoreOverall: number | null;
  scoreConfidence: number | null;
  scoreByCategory: Record<string, CategoryScore> | null;
  propertyType: PropertyType;
  uploadedKinds: DocumentKind[];
}) {
  const t = await getTranslations();

  const uploadedSet = new Set(uploadedKinds);
  const rel = DOC_RELEVANCE[propertyType];
  // Alle Docs die required/recommended sind + expose
  const relevantDocs = (Object.entries(rel)
    .filter(([, r]) => r === "required" || r === "recommended")
    .map(([k]) => k) as DocumentKind[]);

  const docsCoveredCount = relevantDocs.filter((k) => uploadedSet.has(k))
    .length;
  const docsCoveragePct =
    relevantDocs.length > 0
      ? Math.round((docsCoveredCount / relevantDocs.length) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Konfidenz-Tacho */}
        <div className="flex items-center gap-4">
          <ConfidenceGauge value={scoreConfidence} />
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t("dd.cockpit_confidence")}
            </div>
            <div className="text-2xl font-semibold">
              {scoreConfidence != null
                ? Math.round(scoreConfidence * 100) + " %"
                : "—"}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {t("dd.cockpit_confidence_hint")}
            </div>
          </div>
        </div>

        {/* Score-Ampel */}
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
            {t("dd.cockpit_score")}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl font-semibold tracking-tight ${
                scoreOverall == null
                  ? "text-neutral-400"
                  : scoreOverall >= 65
                    ? "text-green-600 dark:text-green-400"
                    : scoreOverall >= 40
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
              }`}
            >
              {scoreOverall ?? "—"}
            </span>
            <span className="text-sm text-neutral-500">/100</span>
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t("dd.cockpit_score_hint")}
          </div>
        </div>

        {/* Doku-Abdeckung */}
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
            {t("dd.cockpit_docs")}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">
              {docsCoveredCount}
            </span>
            <span className="text-sm text-neutral-500">
              / {relevantDocs.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                docsCoveragePct >= 80
                  ? "bg-green-500"
                  : docsCoveragePct >= 50
                    ? "bg-amber-500"
                    : "bg-neutral-400"
              }`}
              style={{ width: `${docsCoveragePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Doku-Checklist Pills */}
      <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("dd.cockpit_checklist_title")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {relevantDocs.map((k) => {
            const uploaded = uploadedSet.has(k);
            return (
              <span
                key={k}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  uploaded
                    ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300"
                    : "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <span>{uploaded ? "✓" : "○"}</span>
                <span>{t(KIND_LABEL_KEY[k])}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* 4-Kachel-Grid: Cockpit-Kategorien */}
      {scoreByCategory && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {COCKPIT_TILES.map(({ key, merged_from, labelKey }) => {
            const merged = mergeCategories(scoreByCategory, merged_from);
            return (
              <div
                key={key}
                className={`rounded-xl border p-3 ${
                  merged.ampel === "green"
                    ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30"
                    : merged.ampel === "yellow"
                      ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30"
                      : merged.ampel === "red"
                        ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30"
                        : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t(labelKey)}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      merged.ampel === "green"
                        ? "bg-green-500"
                        : merged.ampel === "yellow"
                          ? "bg-amber-500"
                          : merged.ampel === "red"
                            ? "bg-red-500"
                            : "bg-neutral-300"
                    }`}
                  />
                  <span className="text-lg font-semibold">
                    {merged.score != null ? Math.round(merged.score) : "—"}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-neutral-600 dark:text-neutral-400">
                  {merged.high > 0 && (
                    <span className="font-medium text-red-700 dark:text-red-400">
                      {merged.high} {t("dd.cockpit_high_short")}
                    </span>
                  )}
                  {merged.high > 0 && merged.medium > 0 && " · "}
                  {merged.medium > 0 && (
                    <span>
                      {merged.medium} {t("dd.cockpit_medium_short")}
                    </span>
                  )}
                  {merged.high === 0 && merged.medium === 0 && (
                    <span>{t("dd.cockpit_no_issues")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Ampel- + Score-Merge über mehrere Findings-Kategorien in eine
 *  Cockpit-Kachel (z.B. Substanz + Energie → "Substanz-Kachel"). */
function mergeCategories(
  scores: Record<string, CategoryScore>,
  keys: string[]
): {
  score: number | null;
  ampel: "green" | "yellow" | "red" | null;
  high: number;
  medium: number;
} {
  const active = keys
    .map((k) => scores[k])
    .filter((v): v is CategoryScore => !!v);
  if (active.length === 0)
    return { score: null, ampel: null, high: 0, medium: 0 };

  // Score = arithmetisches Mittel (v1)
  const score = active.reduce((s, x) => s + x.score, 0) / active.length;
  // Ampel = die "schlechteste" der Kategorien (red > yellow > green)
  const ampelPriority = { red: 3, yellow: 2, green: 1 } as const;
  const worst = active.reduce<"red" | "yellow" | "green">(
    (acc, x) => (ampelPriority[x.ampel] > ampelPriority[acc] ? x.ampel : acc),
    "green"
  );
  const high = active.reduce((s, x) => s + (x.count_high ?? 0), 0);
  const medium = active.reduce((s, x) => s + (x.count_medium ?? 0), 0);
  return { score, ampel: worst, high, medium };
}

/** SVG-Halbkreis-Tacho für die Konfidenz (0..1). */
function ConfidenceGauge({ value }: { value: number | null }) {
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  const RADIUS = 40;
  const CIRC_HALF = Math.PI * RADIUS; // Umfang Halbkreis
  const filled = CIRC_HALF * v;
  const dashOffset = CIRC_HALF - filled;
  const color =
    v >= 0.7 ? "#059669" : v >= 0.4 ? "#D97706" : "#9CA3AF";

  return (
    <svg viewBox="0 0 100 60" className="h-16 w-24" aria-hidden>
      {/* Background arc */}
      <path
        d="M 10 50 A 40 40 0 0 1 90 50"
        fill="none"
        stroke="currentColor"
        className="text-neutral-200 dark:text-neutral-800"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d="M 10 50 A 40 40 0 0 1 90 50"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRC_HALF}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
}
