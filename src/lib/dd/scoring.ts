/**
 * Regelbasierte Score-Aggregation.
 *
 * Warum nicht das LLM den Score raten lassen? Weil derselbe Datenstand
 * denselben Score ergeben muss (Reproduzierbarkeit + Erklärbarkeit).
 *
 * Modell:
 *   - Pro Kategorie: 0..100. Startwert 80 (moderat gut), Abzüge pro
 *     Finding je nach Severity, Bonus pro Positive-Finding.
 *   - Gesamt-Score: gewichteter Durchschnitt der Kategorien.
 *   - Konfidenz: Funktion der Doku-Vollständigkeit (Exposé allein =
 *     niedrig, + WEG + Wirtschaftsplan = hoch).
 */

import type { ConsolidatedFinding } from "./schemas/findings";

export type FindingKind = ConsolidatedFinding;

export type CategoryScore = {
  score: number;             // 0..100
  ampel: "green" | "yellow" | "red";
  count_high: number;
  count_medium: number;
  count_low: number;
  count_positive: number;
};

export type ScoreResult = {
  overall: number;           // 0..100
  confidence: number;        // 0..1
  by_category: Record<string, CategoryScore>;
};

const SEVERITY_PENALTY: Record<string, number> = {
  high: 25,
  medium: 12,
  low: 4,
  positive: 0,
};
const POSITIVE_BONUS = 5;

const CATEGORY_WEIGHTS: Record<string, number> = {
  substanz: 0.22,
  finanzierung: 0.18,
  recht: 0.10,
  weg: 0.15,
  energie: 0.15,
  markt: 0.12,
  lage: 0.08,
};

const CATEGORIES = Object.keys(CATEGORY_WEIGHTS);

export function computeScore(
  findings: FindingKind[],
  docCoverage: {
    hasExpose: boolean;
    hasWeg: boolean;
    hasWirtschaftsplan: boolean;
    hasTeilung: boolean;
    hasEnergie: boolean;
  }
): ScoreResult {
  const byCategory: Record<string, CategoryScore> = {};

  for (const c of CATEGORIES) {
    byCategory[c] = {
      score: 80,
      ampel: "green",
      count_high: 0,
      count_medium: 0,
      count_low: 0,
      count_positive: 0,
    };
  }

  for (const f of findings) {
    const cat = byCategory[f.category];
    if (!cat) continue;

    if (f.severity === "positive") {
      cat.score = Math.min(100, cat.score + POSITIVE_BONUS);
      cat.count_positive++;
      continue;
    }

    const penaltyBase = SEVERITY_PENALTY[f.severity] ?? 0;
    // Confidence dämpft die Wirkung: eine unsichere Aussage senkt
    // weniger als eine zitierte belegte.
    const dampedPenalty = penaltyBase * (0.5 + 0.5 * f.confidence);
    cat.score = Math.max(0, cat.score - dampedPenalty);

    if (f.severity === "high") cat.count_high++;
    else if (f.severity === "medium") cat.count_medium++;
    else cat.count_low++;
  }

  // Ampel je Kategorie
  for (const c of CATEGORIES) {
    const s = byCategory[c].score;
    byCategory[c].ampel = s >= 65 ? "green" : s >= 40 ? "yellow" : "red";
  }

  // Gesamt-Score = gewichtete Kategorien
  let overall = 0;
  for (const c of CATEGORIES) {
    overall += byCategory[c].score * CATEGORY_WEIGHTS[c];
  }
  overall = Math.round(overall);

  // Confidence-Modell — reine Datenlage:
  //   - Exposé allein:                 0.30
  //   - + WEG (>=1):                   0.55
  //   - + Wirtschaftsplan:             0.75
  //   - + Teilung:                     0.85
  //   - + Energieausweis:              0.90
  let confidence = 0;
  if (docCoverage.hasExpose) confidence = 0.30;
  if (docCoverage.hasWeg) confidence = Math.max(confidence, 0.55);
  if (docCoverage.hasWirtschaftsplan) confidence = Math.max(confidence, 0.75);
  if (docCoverage.hasTeilung) confidence = Math.max(confidence, 0.85);
  if (docCoverage.hasEnergie) confidence = Math.max(confidence, 0.90);

  return { overall, confidence: Number(confidence.toFixed(2)), by_category: byCategory };
}
