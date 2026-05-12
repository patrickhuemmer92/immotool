import { describe, expect, it } from "vitest";
import {
  buildingAfaBasis,
  computePnL,
  periodMonths,
} from "@/lib/calculations/pnl";

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

describe("computePnL — Spec-Formel", () => {
  it("Tilgung und Rücklage sind NICHT in pretaxProfit (nur Cashflow)", () => {
    // 1.000 €/Monat Kaltmiete, 200 €/Monat Hausgeld (Fallback ohne Split),
    // 50 €/Monat Rücklage, 4.500 €/Periode-Annuität (Override),
    // 3.000 € Zinsen, 1.500 € Tilgung über die Periode (Override per Monat
    // wird × months hochgerechnet, also Werte hier so wählen, dass sie
    // periodisch das Erwartete ergeben).
    //
    // Override-Inputs sind €/Monat → für 4.500/Periode 12 Monate: 375 €/Monat.
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      ancillaryCosts: 200,
      maintenance: 50,
      annuityOverride: 375,
      interestOverride: 250,
      principalOverride: 125,
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.35,
    });

    expect(r.months).toBe(12);
    expect(r.rentTotal).toBe(12000);
    expect(r.operatingCosts).toBe(2400 + 600);
    expect(r.hausgeldTotal).toBe(2400);
    expect(r.reserveContribution).toBe(600);
    expect(r.annuity).toBe(4500);
    expect(r.interest).toBe(3000);
    expect(r.principal).toBe(1500);
    expect(r.depreciation).toBeCloseTo(2000, 6);

    // Cashflow: 12000 − 4500 − 2400 − 600 = 4500
    expect(r.cashflowBeforeTax).toBe(4500);
    // Steuerlich: 12000 − 2400 − 3000 − 2000 = 4600 (Rücklage NICHT abgezogen!)
    expect(r.pretaxProfit).toBe(4600);
    // Steuer: 4600 × 0,35 = 1610
    expect(r.taxEffect).toBeCloseTo(1610, 6);
    // After-Tax: 4500 − 1610 = 2890
    expect(r.afterTaxCashflow).toBeCloseTo(2890, 6);
  });

  it("Warmmiete = Kaltmiete + umlagefähiges Hausgeld (Split-Modus)", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      propertyFeeRecoverable: 150,
      propertyFeeNotRecoverable: 50,
      maintenance: 0,
      annuityOverride: 0,
      interestOverride: 0,
      principalOverride: 0,
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0.35,
    });

    expect(r.rentTotal).toBe((1000 + 150) * 12); // Warmmiete = 13.800
    expect(r.hausgeldTotal).toBe(200 * 12); // 2.400
    // Cashflow: 13800 − 0 − 2400 − 0 = 11400
    expect(r.cashflowBeforeTax).toBe(11400);
    // Steuerlich: 13800 − 2400 − 0 − 0 = 11400
    expect(r.pretaxProfit).toBe(11400);
    // Umlagefähig kürzt sich für Steuer + Cashflow: Saldo = Kaltmiete − Nicht-umlagef.
    // Kaltmiete 12000 − Nicht-umlagef. 600 = 11400 ✓
  });

  it("Verlust → Steuereffekt negativ → after-tax > before-tax", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 400,
      ancillaryCosts: 200,
      maintenance: 0,
      annuityOverride: 500,
      interestOverride: 350,
      principalOverride: 150,
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.42,
    });
    expect(r.pretaxProfit).toBeLessThan(0);
    expect(r.taxEffect).toBeLessThan(0);
    expect(r.afterTaxCashflow).toBeGreaterThan(r.cashflowBeforeTax);
  });

  it("Annuität automatisch aus Loan-Schedule (period total)", () => {
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
    // Annuität monatlich = 100000 × 0.06 / 12 = 500 €/M → 6000 €/Periode.
    expect(r.annuity).toBeCloseTo(6000, 0);
    expect(r.interest + r.principal).toBeCloseTo(r.annuity, 6);
  });

  it("Quartal: alle Inputs werden anteilig skaliert", () => {
    const r = computePnL({
      period: {
        start: new Date(Date.UTC(2024, 0, 1)),
        end: new Date(Date.UTC(2024, 2, 1)),
      },
      coldRent: 1000,
      annuityOverride: 0,
      interestOverride: 0,
      principalOverride: 0,
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.35,
    });
    expect(r.months).toBe(3);
    expect(r.rentTotal).toBe(3000); // 1000 × 3
    expect(r.depreciation).toBeCloseTo(500, 6); // 2000 × 3/12
  });
});

// Brief-Referenz: Reichelsdorfer cashflow=148.54, AfterTax=42.40.
// Konkrete Excel-Inputs (Kaltmiete, Hausgeld, AfA-Basis, Steuersatz, Annuität)
// noch nicht eingebaut → wird ergänzt sobald die Werte vorliegen.
describe.todo("Reichelsdorfer Excel-Referenzwerte");
