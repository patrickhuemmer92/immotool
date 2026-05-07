import { describe, expect, it } from "vitest";
import { buildingAfaBasis, computePnL, periodMonths } from "@/lib/calculations/pnl";

const PERIOD_2024 = {
  start: new Date(Date.UTC(2024, 0, 1)),
  end: new Date(Date.UTC(2024, 11, 1)),
};

describe("periodMonths", () => {
  it("12 Monate für ein volles Jahr", () => {
    expect(periodMonths(PERIOD_2024)).toBe(12);
  });

  it("3 Monate Q1", () => {
    expect(
      periodMonths({
        start: new Date(Date.UTC(2024, 0, 1)),
        end: new Date(Date.UTC(2024, 2, 1)),
      })
    ).toBe(3);
  });
});

describe("buildingAfaBasis", () => {
  it("nutzt building_value_share_pct, wenn gesetzt", () => {
    expect(
      buildingAfaBasis({
        purchasePrice: 100000,
        buildingValueSharePct: 0.85,
        landValue: 20000,
      })
    ).toBe(85000);
  });

  it("Fallback land_value", () => {
    expect(
      buildingAfaBasis({
        purchasePrice: 100000,
        buildingValueSharePct: null,
        landValue: 20000,
      })
    ).toBe(80000);
  });

  it("ohne Inputs → 0", () => {
    expect(
      buildingAfaBasis({
        purchasePrice: null,
        buildingValueSharePct: null,
        landValue: null,
      })
    ).toBe(0);
  });
});

describe("computePnL", () => {
  it("ohne Loans, mit Override-Annuität", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 12000,
      ancillaryCosts: 2400,
      maintenance: 600,
      annuityOverride: 4500,
      interestOverride: 3000,
      principalOverride: 1500,
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.35,
    });
    expect(r.months).toBe(12);
    expect(r.rentTotal).toBe(12000);
    expect(r.operatingCosts).toBe(3000);
    expect(r.annuity).toBe(4500);
    expect(r.interest).toBe(3000);
    expect(r.principal).toBe(1500);
    expect(r.depreciation).toBeCloseTo(2000, 6);
    expect(r.cashflowBeforeTax).toBe(12000 - 3000 - 4500);
    expect(r.pretaxProfit).toBe(12000 - 3000 - 3000 - 2000);
    expect(r.taxEffect).toBeCloseTo(4000 * 0.35, 6);
    expect(r.afterTaxCashflow).toBeCloseTo(4500 - 4000 * 0.35, 6);
    expect(r.source.annuity).toBe("override");
  });

  it("Verlust → Steuereffekt negativ → after-tax > before-tax", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 5000,
      ancillaryCosts: 2000,
      annuityOverride: 6000,
      interestOverride: 4000,
      principalOverride: 2000,
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.42,
    });
    expect(r.pretaxProfit).toBeLessThan(0);
    expect(r.taxEffect).toBeLessThan(0);
    expect(r.afterTaxCashflow).toBeGreaterThan(r.cashflowBeforeTax);
  });

  it("Annuität automatisch aus Loan-Schedule", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 0,
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0,
      loans: [
        {
          loan: {
            loanAmount: 100000,
            interestRatePa: 0.04,
            amortizationPa: 0.02,
            firstPaymentDate: new Date(Date.UTC(2024, 0, 1)),
          },
        },
      ],
    });
    expect(r.source.annuity).toBe("auto");
    expect(r.annuity).toBeCloseTo((100000 * 0.06) / 12 * 12, 0);
    expect(r.interest + r.principal).toBeCloseTo(r.annuity, 6);
  });

  it("Quartal: AfA wird linear skaliert", () => {
    const r = computePnL({
      period: {
        start: new Date(Date.UTC(2024, 0, 1)),
        end: new Date(Date.UTC(2024, 2, 1)),
      },
      coldRent: 3000,
      annuityOverride: 0,
      interestOverride: 0,
      principalOverride: 0,
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.35,
    });
    expect(r.months).toBe(3);
    expect(r.depreciation).toBeCloseTo((100000 * 0.02 * 3) / 12, 6);
  });
});

// Brief-Referenz: Reichelsdorfer cashflow=148.54, AfterTax=42.40.
// Inputs nicht im Brief enthalten → siehe README; Test wird ergänzt sobald die
// konkreten Werte (Kaltmiete, Hausgeld, Annuität, AfA-Basis) vorliegen.
describe.todo("Reichelsdorfer Excel-Referenzwerte");
