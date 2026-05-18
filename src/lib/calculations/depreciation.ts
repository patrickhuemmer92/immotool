/**
 * AfA-Methodik für Wohngebäude (Deutschland).
 *
 * Drei Methoden werden unterstützt:
 *
 *   1. linear (§ 7 IV EStG) — gleicher Betrag pro Jahr = basis × rate.
 *      Default für Bestandsbauten. Üblicher Satz 2 % (oder 2,5 % bei
 *      Bestand vor 1925), je nach Settings.
 *
 *   2. degressive_7v (§ 7 V EStG) — degressive AfA nur für Wohngebäude
 *      mit Baubeginn ab 01.10.2023 und vor 30.09.2029.
 *      Jährlich 5 % vom Restbuchwert (default-Satz aus Settings). Wechsel
 *      zur linearen AfA ist gesetzlich möglich, hier vereinfacht ohne
 *      Wechsel — User kann das durch erneutes Wechseln der Methode später
 *      manuell tun.
 *
 *   3. sonder_7b (§ 7b EStG) — Sonder-AfA für förderfähige Mietwohn-
 *      neubauten. Jahre 1..N: zusätzlich N % von der (ggf. begrenzten)
 *      Bemessungsgrundlage NEBEN der linearen AfA. Ab Jahr N+1 läuft nur
 *      noch die lineare AfA weiter.
 *
 * Alle Sätze sind aus Settings übersteuerbar — das ist eine Steuer-
 * Modellierung, kein Rechtsgutachten.
 */

export type DepreciationMethod = "linear" | "degressive_7v" | "sonder_7b";

export type DepreciationParams = {
  method: DepreciationMethod;
  /** Building AfA basis (€). */
  basis: number;
  /** Linear AfA rate (z. B. 0.02 für 2 %). Wird auch in 'sonder_7b' für die
   *  reguläre lineare Tranche genutzt, wenn `sonderLinearRate` nicht
   *  gesetzt ist. */
  linearRate: number;
  /** Degressiv-Satz für '§ 7 V'. Defaults via Settings. */
  degressiveRate?: number;
  /** Sonder-AfA-Satz § 7b (zusätzlich zum linearen). */
  sonderRate?: number;
  /** Dauer der § 7b-Sonder-AfA in Jahren. */
  sonderYears?: number;
  /** Linearer Satz, der neben der § 7b-Sonder-AfA läuft (typisch 0.03). */
  sonderLinearRate?: number;
  /** Optional begrenzte Bemessungsgrundlage für § 7b. Leer = `basis`. */
  sonder7bBasisLimit?: number | null;
};

export type DepreciationYearResult = {
  /** 1-basierter Jahresindex (1 = erstes Jahr nach Anschaffung). */
  year: number;
  /** Anteil regulärer linearer AfA. */
  linear: number;
  /** Anteil degressiver AfA (nur bei `degressive_7v`). */
  degressive: number;
  /** Anteil Sonder-AfA § 7b (nur bei `sonder_7b`). */
  sonder: number;
  /** Summe aus allen Komponenten — das, was steuerlich abgesetzt wird. */
  total: number;
  /** Restbuchwert nach diesem Jahr. */
  bookValue: number;
};

/**
 * Berechnet die AfA für ein einzelnes Jahr. Bei degressiver AfA wird der
 * vorherige Restbuchwert übergeben (oder neu via `buildSchedule`
 * berechnet). Diese Funktion ist primär für interne Nutzung; Aufrufer
 * sollten in der Regel `buildSchedule` oder `depreciationForYear` nutzen.
 */
function yearStep(
  prevBookValue: number,
  yearIndex: number,
  p: DepreciationParams
): DepreciationYearResult {
  const sonderRate = p.sonderRate ?? 0.05;
  const sonderYears = p.sonderYears ?? 4;
  const sonderLinear = p.sonderLinearRate ?? p.linearRate;
  const degRate = p.degressiveRate ?? 0.05;
  const sonderBasis =
    p.sonder7bBasisLimit != null && p.sonder7bBasisLimit > 0
      ? Math.min(p.sonder7bBasisLimit, p.basis)
      : p.basis;

  let linear = 0;
  let degressive = 0;
  let sonder = 0;
  let total = 0;

  switch (p.method) {
    case "linear":
      linear = p.basis * p.linearRate;
      // Restbuchwert darf nicht negativ werden — AfA endet, wenn aufgebraucht.
      linear = Math.min(linear, prevBookValue);
      total = linear;
      break;
    case "degressive_7v":
      degressive = prevBookValue * degRate;
      total = degressive;
      break;
    case "sonder_7b":
      linear = p.basis * sonderLinear;
      linear = Math.min(linear, prevBookValue);
      if (yearIndex <= sonderYears) {
        sonder = sonderBasis * sonderRate;
        // Sonder darf den Restbuchwert nach linearer Abschreibung nicht
        // überschreiten.
        sonder = Math.min(sonder, Math.max(0, prevBookValue - linear));
      }
      total = linear + sonder;
      break;
  }

  return {
    year: yearIndex,
    linear,
    degressive,
    sonder,
    total,
    bookValue: Math.max(0, prevBookValue - total),
  };
}

/**
 * Vollständiger AfA-Plan über `years` Jahre (Default: 50 — typisch genug
 * für lineare AfA mit 2 % bzw. 33 Jahre AfA-Dauer plus Puffer).
 */
export function buildSchedule(
  p: DepreciationParams,
  years: number = 50
): DepreciationYearResult[] {
  const schedule: DepreciationYearResult[] = [];
  let book = p.basis;
  for (let i = 1; i <= years; i++) {
    const step = yearStep(book, i, p);
    schedule.push(step);
    book = step.bookValue;
    if (book <= 0.005) break;
  }
  return schedule;
}

/**
 * AfA-Wert für ein bestimmtes Jahr (1-basiert) — durchläuft die ersten
 * `year` Schritte des Plans und gibt das Ergebnis des letzten zurück.
 */
export function depreciationForYear(
  p: DepreciationParams,
  year: number
): DepreciationYearResult {
  if (year < 1) {
    return { year, linear: 0, degressive: 0, sonder: 0, total: 0, bookValue: p.basis };
  }
  let book = p.basis;
  let last: DepreciationYearResult = {
    year: 0,
    linear: 0,
    degressive: 0,
    sonder: 0,
    total: 0,
    bookValue: p.basis,
  };
  for (let i = 1; i <= year; i++) {
    last = yearStep(book, i, p);
    book = last.bookValue;
    if (book <= 0.005 && i < year) {
      // restliche Jahre = 0
      return { year, linear: 0, degressive: 0, sonder: 0, total: 0, bookValue: 0 };
    }
  }
  return last;
}

/**
 * Was kommt steuerlich in einem bestimmten Kalenderjahr an AfA an?
 * `startYear` ist das Jahr, in dem AfA-Jahr 1 läuft (= Anschaffungsjahr).
 * Vor `startYear` → 0; ab `startYear` → Jahr 1; usw.
 *
 * Anteilige AfA im Anschaffungsjahr (z. B. nur 6 von 12 Monate Übergang)
 * sollte vom Aufrufer via `firstYearMonths` (1..12) berücksichtigt werden.
 */
export function depreciationForCalendarYear(
  p: DepreciationParams,
  startYear: number,
  calendarYear: number,
  firstYearMonths: number = 12
): DepreciationYearResult {
  const idx = calendarYear - startYear + 1;
  if (idx < 1) {
    return {
      year: idx,
      linear: 0,
      degressive: 0,
      sonder: 0,
      total: 0,
      bookValue: p.basis,
    };
  }
  const raw = depreciationForYear(p, idx);
  if (idx === 1 && firstYearMonths < 12) {
    const scale = Math.max(0, Math.min(12, firstYearMonths)) / 12;
    return {
      ...raw,
      linear: raw.linear * scale,
      degressive: raw.degressive * scale,
      sonder: raw.sonder * scale,
      total: raw.total * scale,
      bookValue: p.basis - raw.total * scale,
    };
  }
  return raw;
}
