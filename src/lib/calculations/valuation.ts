export type ValuationInput = {
  /** Living area in m². Required for income value derived from per-m² rent. */
  sqm: number | null;
  /** Market rent in € per m² per month. */
  marketRentPerSqm: number | null;
  /** Multiple (Vervielfältiger) on annual cold rent. */
  multiple: number | null;
  /** Land value (Bodenwert) in €. */
  landValue: number | null;
  /** Building value (Gebäudesachwert) in €. */
  buildingValue: number | null;
};

export type ValuationResult = {
  ertragswert: number | null;
  sachwert: number | null;
  combined: number | null;
};

export const DEFAULT_INCOME_WEIGHT = 0.5;

export function computeValuation(
  input: ValuationInput,
  incomeWeight: number = DEFAULT_INCOME_WEIGHT
): ValuationResult {
  const w = Math.min(1, Math.max(0, incomeWeight));

  let ertragswert: number | null = null;
  if (
    input.sqm != null &&
    input.marketRentPerSqm != null &&
    input.multiple != null &&
    input.sqm > 0 &&
    input.marketRentPerSqm > 0 &&
    input.multiple > 0
  ) {
    ertragswert = input.sqm * input.marketRentPerSqm * 12 * input.multiple;
  }

  let sachwert: number | null = null;
  if (input.landValue != null || input.buildingValue != null) {
    sachwert = (input.landValue ?? 0) + (input.buildingValue ?? 0);
  }

  let combined: number | null = null;
  if (ertragswert != null && sachwert != null) {
    combined = ertragswert * w + sachwert * (1 - w);
  } else if (ertragswert != null) {
    combined = ertragswert;
  } else if (sachwert != null) {
    combined = sachwert;
  }

  return { ertragswert, sachwert, combined };
}
