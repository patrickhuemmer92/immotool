/**
 * Kaufnebenkosten + Rendite-Kennzahlen für die DD-Zusammenfassung.
 *
 * Grunderwerbsteuer-Sätze variieren pro Bundesland. Notarkosten inkl.
 * Grundbuch werden pauschal mit ~2 % geschätzt (0,5 % Grundbuch,
 * 1,5 % Notar) — kommt hin bei Standard-Beurkundungen ohne Sonderklauseln.
 * Maklercourtage nur mit einbeziehen wenn im Exposé beziffert.
 *
 * Alle Zahlen zurückgegeben in EUR (nicht Cent).
 */

import { _stateFromPlz } from "./market/boris";

// ---------------------------------------------------------------------
// Grunderwerbsteuer nach Bundesland (Stand 2024)
// Quelle: Steuerverwaltungen der Länder
// ---------------------------------------------------------------------
const TRANSFER_TAX_RATES: Record<string, number> = {
  BW: 0.05,
  BY: 0.035,
  BE: 0.06,
  BB: 0.065,
  HB: 0.05,
  HH: 0.045, // 2023 von 4,5 auf 5,5 % erhöht, dann wieder gesenkt — akt. 4,5
  HE: 0.06,
  MV: 0.06,
  NI: 0.05,
  NW: 0.065,
  RP: 0.05,
  SL: 0.065,
  SN: 0.055,
  ST: 0.05,
  SH: 0.065,
  TH: 0.065,
};

const NOTARY_GRUNDBUCH_RATE = 0.02; // 1,5 % Notar + 0,5 % Grundbuch (Pauschale)

export type AcquisitionCosts = {
  purchase_price_eur: number;
  transfer_tax_pct: number;
  transfer_tax_eur: number;
  notary_grundbuch_pct: number;
  notary_grundbuch_eur: number;
  broker_fee_eur: number | null;
  side_costs_total_eur: number;
  total_acquisition_eur: number;
  side_costs_share_pct: number;   // Nebenkosten als % vom Kaufpreis
  state_code: string;
};

export type YieldMetrics = {
  gross_yield_pct: number | null;         // Miete × 12 / Kaufpreis
  gross_yield_on_total_pct: number | null; // Miete × 12 / (Kaufpreis + Nebenkosten)
  monthly_rent_eur: number | null;
};

/**
 * Berechnet die Kaufnebenkosten für ein Objekt.
 *   - transfer_tax kommt aus dem Bundesland (via PLZ) — wenn nicht ableitbar,
 *     nehmen wir 5 % als konservativen Mittelwert (mit `state_code = "??"`).
 *   - broker_fee entweder aus Exposé (in EUR ODER als %) — wenn nichts
 *     bekannt: null (nicht raten).
 */
export function computeAcquisitionCosts(input: {
  purchase_price_eur: number;
  postal_code: string | null;
  broker_commission_eur: number | null;
  broker_commission_pct: number | null;
}): AcquisitionCosts {
  const state = _stateFromPlz(input.postal_code) as string;
  const transferTaxPct =
    state in TRANSFER_TAX_RATES ? TRANSFER_TAX_RATES[state] : 0.05;
  const transferTaxEur = input.purchase_price_eur * transferTaxPct;
  const notaryEur = input.purchase_price_eur * NOTARY_GRUNDBUCH_RATE;

  let brokerFeeEur: number | null = null;
  if (input.broker_commission_eur != null && input.broker_commission_eur > 0) {
    brokerFeeEur = input.broker_commission_eur;
  } else if (
    input.broker_commission_pct != null &&
    input.broker_commission_pct > 0
  ) {
    brokerFeeEur =
      input.purchase_price_eur * (input.broker_commission_pct / 100);
  }

  const sideTotal = transferTaxEur + notaryEur + (brokerFeeEur ?? 0);
  const total = input.purchase_price_eur + sideTotal;

  return {
    purchase_price_eur: input.purchase_price_eur,
    transfer_tax_pct: transferTaxPct,
    transfer_tax_eur: Math.round(transferTaxEur),
    notary_grundbuch_pct: NOTARY_GRUNDBUCH_RATE,
    notary_grundbuch_eur: Math.round(notaryEur),
    broker_fee_eur: brokerFeeEur != null ? Math.round(brokerFeeEur) : null,
    side_costs_total_eur: Math.round(sideTotal),
    total_acquisition_eur: Math.round(total),
    side_costs_share_pct: sideTotal / input.purchase_price_eur,
    state_code: state === "UNKNOWN" ? "??" : state,
  };
}

/**
 * Bruttorendite-Rechnung. Ohne bekannte Miete: null (nicht schätzen).
 */
export function computeGrossYield(input: {
  purchase_price_eur: number;
  monthly_cold_rent_eur: number | null;
  total_acquisition_eur: number | null;
}): YieldMetrics {
  if (!input.monthly_cold_rent_eur || input.monthly_cold_rent_eur <= 0) {
    return {
      gross_yield_pct: null,
      gross_yield_on_total_pct: null,
      monthly_rent_eur: null,
    };
  }
  const annual = input.monthly_cold_rent_eur * 12;
  const yieldOnPrice = annual / input.purchase_price_eur;
  const yieldOnTotal =
    input.total_acquisition_eur && input.total_acquisition_eur > 0
      ? annual / input.total_acquisition_eur
      : null;
  return {
    gross_yield_pct: yieldOnPrice,
    gross_yield_on_total_pct: yieldOnTotal,
    monthly_rent_eur: input.monthly_cold_rent_eur,
  };
}
