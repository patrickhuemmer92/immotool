/**
 * Regelbasierte Score-Aggregation.
 *
 * Warum nicht das LLM den Score raten lassen? Weil derselbe Datenstand
 * denselben Score ergeben muss (Reproduzierbarkeit + Erklärbarkeit).
 *
 * Modell (Fassung 2 — die Begründungen stehen bei den Konstanten):
 *   - Pro Kategorie 0..100, Startwert 80, Abzüge je Finding.
 *   - Ein Finding wiegt nach Schweregrad × Beleglage × Status × Kosten.
 *   - Mehrere Findings in derselben Kategorie wirken degressiv.
 *   - Kategorien ohne auswertbare Quelle werden NICHT bewertet und
 *     fliegen aus dem Gesamtscore; die Gewichte werden normiert.
 *   - Zwei Kennzahlen statt einer: Objektzustand und Preiswürdigkeit.
 */

import type { ConsolidatedFinding } from "./schemas/findings";

export type FindingKind = ConsolidatedFinding;

export type CategoryScore = {
  /** 0..100, oder null wenn die Kategorie mangels Quelle nicht bewertet wurde. */
  score: number | null;
  ampel: "green" | "yellow" | "red" | "unrated";
  count_high: number;
  count_medium: number;
  count_low: number;
  count_positive: number;
  /** Findings, die als erledigt gelten und deshalb nicht abziehen. */
  count_resolved: number;
};

export type ScoreResult = {
  /** Gewichteter Schnitt über alle BEWERTETEN Kategorien. */
  overall: number;
  /** Substanz, WEG, Recht, Energie — was du nicht wegverhandeln kannst. */
  condition: number | null;
  /** Rentabilität, Markt, Lage — die Preisfrage. */
  price: number | null;
  confidence: number;
  by_category: Record<string, CategoryScore>;
  /** Kategorien ohne Quelle — für die Anzeige „nicht bewertet". */
  unrated: string[];
};

const SEVERITY_PENALTY: Record<string, number> = {
  high: 25,
  medium: 12,
  low: 4,
  positive: 0,
};

/**
 * Ein Positive gleicht nicht ein High aus — aber die alte 5:1-Relation
 * war zu hart: eine gut geführte WEG mit voller Rücklage konnte
 * rechnerisch nie gegen ein einzelnes Finding ankommen. Gedeckelt, damit
 * sich niemand mit Nebensächlichkeiten grünrechnet.
 */
const POSITIVE_BONUS = 6;
const MAX_POSITIVE_BONUS = 18;

/**
 * Status eines Findings — wie stark es überhaupt noch abzieht.
 *
 * `erledigt` heißt belegt erledigt (Zahlungsnachweis, Rechnung,
 * Verwalterbestätigung). Die mündliche Zusage eines Maklers ist
 * `zu_belegen`: das Risiko ist plausibel entschärft, aber nichts liegt
 * vor. Deshalb reduziert, nicht null.
 */
const STATUS_FACTOR: Record<string, number> = {
  offen: 1,
  zu_belegen: 0.4,
  erledigt: 0,
};

/**
 * Kostengewichtung, gemessen am Anteil des Kaufpreises. Vorher wog ein
 * Finding über 882 € genauso schwer wie eines über 9.870 €.
 *
 * Anker: 2 % des Kaufpreises = volles Gewicht. Darunter wird gedämpft,
 * darüber verstärkt — aber begrenzt, damit ein einzelner Großposten den
 * Schweregrad nicht überschreibt.
 */
const COST_FULL_WEIGHT_SHARE = 0.02;
const COST_FACTOR_MIN = 0.35;
const COST_FACTOR_MAX = 1.3;

const CATEGORY_WEIGHTS: Record<string, number> = {
  substanz: 0.22,
  finanzierung: 0.18,
  // Angehoben von 0,10: im Grundbuch und in der Teilungserklärung
  // stecken Risiken, die den Kauf ganz kippen können (Erbbaurecht,
  // Wegerechte, Nutzungsbeschränkungen).
  recht: 0.15,
  weg: 0.15,
  // Gesenkt von 0,15: Energiethemen sind überwiegend Kosten und
  // überschneiden sich mit `substanz` (Heizungstausch taucht in beiden
  // auf). Das Gewicht dort ist die ehrlichere Stelle.
  energie: 0.10,
  markt: 0.12,
  lage: 0.08,
};

const CATEGORIES = Object.keys(CATEGORY_WEIGHTS);

/** Was nicht verhandelbar ist. */
const CONDITION_CATEGORIES = ["substanz", "weg", "recht", "energie"];
/** Was am Preis hängt. */
const PRICE_CATEGORIES = ["finanzierung", "markt", "lage"];

/**
 * Welche Quelle eine Kategorie überhaupt bewertbar macht.
 *
 * Ohne diese Prüfung blieb eine Kategorie ohne Datengrundlage bei 80 —
 * also grün. „Nicht geprüft" sah damit aus wie „unauffällig", und zwar
 * ausgerechnet bei `recht`, wo der Grundbuchauszug noch gar nicht
 * ausgewertet wird.
 */
export type DocCoverage = {
  hasExpose: boolean;
  hasWeg: boolean;
  hasWirtschaftsplan: boolean;
  hasTeilung: boolean;
  hasEnergie: boolean;
  /** Marktdaten-Snapshot vorhanden? */
  hasMarket?: boolean;
};

function isRatable(category: string, c: DocCoverage): boolean {
  switch (category) {
    // Substanz beurteilt man aus Protokollen, nicht aus dem Exposé —
    // dort steht die Verkäufersicht.
    case "substanz":
      return c.hasWeg;
    // Kaufpreis und Hausgeld stehen im Exposé; der Wirtschaftsplan
    // macht es belastbarer, ist aber nicht Voraussetzung.
    case "finanzierung":
      return c.hasExpose || c.hasWirtschaftsplan;
    case "recht":
      return c.hasTeilung;
    case "weg":
      return c.hasWeg || c.hasWirtschaftsplan;
    case "energie":
      return c.hasEnergie || c.hasExpose;
    case "markt":
      return c.hasMarket === true;
    case "lage":
      return c.hasExpose;
    default:
      return false;
  }
}

/**
 * Gewicht eines einzelnen Findings innerhalb seiner Kategorie.
 * Ausgelagert, weil genau diese Formel die Frage beantwortet
 * „warum zieht das so viel ab?" — und deshalb testbar sein muss.
 */
export function findingPenalty(
  f: FindingKind,
  purchasePriceEur: number | null
): number {
  const base = SEVERITY_PENALTY[f.severity] ?? 0;
  if (base === 0) return 0;

  // Beleglage: eine zitierte, belegte Aussage wiegt schwerer als eine
  // vage. Unverändert gegenüber Fassung 1.
  const confidenceDamp = 0.5 + 0.5 * f.confidence;

  const status = (f as { status?: string }).status ?? "offen";
  const statusFactor = STATUS_FACTOR[status] ?? 1;
  if (statusFactor === 0) return 0;

  return base * confidenceDamp * statusFactor * costFactor(f, purchasePriceEur);
}

function costFactor(f: FindingKind, purchasePriceEur: number | null): number {
  // Ohne Kaufpreis oder ohne beziffertes Finding bleibt es beim
  // Schweregrad — der enthält die Größenordnung bereits grob.
  if (!purchasePriceEur || purchasePriceEur <= 0) return 1;
  const cost = f.cost_max_eur ?? f.cost_min_eur;
  if (cost == null || cost <= 0) return 1;

  const share = cost / purchasePriceEur;
  const raw = share / COST_FULL_WEIGHT_SHARE;
  return Math.min(COST_FACTOR_MAX, Math.max(COST_FACTOR_MIN, raw));
}

/**
 * Mehrere Findings in einer Kategorie wirken degressiv: das schwerste
 * zählt voll, jedes weitere weniger. Vorher summierten sie sich linear,
 * drei hohe Findings drückten eine Kategorie auf 5 — eine gut
 * dokumentierte WEG-Historie wurde damit für ihre Offenheit bestraft.
 */
function aggregatePenalties(penalties: number[]): number {
  return penalties
    .slice()
    .sort((a, b) => b - a)
    .reduce((sum, p, i) => sum + p / (1 + 0.5 * i), 0);
}

export function computeScore(
  findings: FindingKind[],
  docCoverage: DocCoverage,
  opts: { purchasePriceEur?: number | null } = {}
): ScoreResult {
  const purchasePrice = opts.purchasePriceEur ?? null;
  const byCategory: Record<string, CategoryScore> = {};
  const penaltiesByCategory: Record<string, number[]> = {};

  for (const c of CATEGORIES) {
    byCategory[c] = {
      score: 80,
      ampel: "green",
      count_high: 0,
      count_medium: 0,
      count_low: 0,
      count_positive: 0,
      count_resolved: 0,
    };
    penaltiesByCategory[c] = [];
  }

  for (const f of findings) {
    const cat = byCategory[f.category];
    if (!cat) continue;

    if (f.severity === "positive") {
      cat.count_positive++;
      continue;
    }

    if (f.severity === "high") cat.count_high++;
    else if (f.severity === "medium") cat.count_medium++;
    else cat.count_low++;

    const penalty = findingPenalty(f, purchasePrice);
    if (penalty === 0) {
      cat.count_resolved++;
      continue;
    }
    penaltiesByCategory[f.category].push(penalty);
  }

  const unrated: string[] = [];
  for (const c of CATEGORIES) {
    if (!isRatable(c, docCoverage)) {
      byCategory[c].score = null;
      byCategory[c].ampel = "unrated";
      unrated.push(c);
      continue;
    }
    const bonus = Math.min(
      MAX_POSITIVE_BONUS,
      byCategory[c].count_positive * POSITIVE_BONUS
    );
    const raw = 80 - aggregatePenalties(penaltiesByCategory[c]) + bonus;
    const score = Math.round(Math.max(0, Math.min(100, raw)));
    byCategory[c].score = score;
    byCategory[c].ampel = score >= 65 ? "green" : score >= 40 ? "yellow" : "red";
  }

  return {
    overall: weightedAverage(byCategory, CATEGORIES) ?? 0,
    condition: weightedAverage(byCategory, CONDITION_CATEGORIES),
    price: weightedAverage(byCategory, PRICE_CATEGORIES),
    confidence: computeConfidence(docCoverage),
    by_category: byCategory,
    unrated,
  };
}

/**
 * Gewichteter Schnitt über die bewerteten Kategorien einer Gruppe. Die
 * Gewichte werden auf die tatsächlich bewerteten normiert — sonst würde
 * eine fehlende Kategorie den Score rechnerisch nach unten ziehen, ohne
 * dass irgendetwas Negatives bekannt wäre.
 */
function weightedAverage(
  byCategory: Record<string, CategoryScore>,
  categories: readonly string[]
): number | null {
  let weightSum = 0;
  let acc = 0;
  for (const c of categories) {
    const score = byCategory[c]?.score;
    if (score == null) continue;
    const w = CATEGORY_WEIGHTS[c] ?? 0;
    weightSum += w;
    acc += score * w;
  }
  if (weightSum === 0) return null;
  return Math.round(acc / weightSum);
}

/** Konfidenz — reine Datenlage, unverändert gegenüber Fassung 1. */
function computeConfidence(c: DocCoverage): number {
  let confidence = 0;
  if (c.hasExpose) confidence = 0.3;
  if (c.hasWeg) confidence = Math.max(confidence, 0.55);
  if (c.hasWirtschaftsplan) confidence = Math.max(confidence, 0.75);
  if (c.hasTeilung) confidence = Math.max(confidence, 0.85);
  if (c.hasEnergie) confidence = Math.max(confidence, 0.9);
  return Number(confidence.toFixed(2));
}
