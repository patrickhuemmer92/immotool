import { describe, expect, it } from "vitest";
import {
  buildingAfaBasis,
  computeBankView,
  computePnL,
  computePropertyKPIs,
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

describe("computePnL — net convention (default)", () => {
  it("rentTotal = Kaltmiete; operatingCosts enthält nur nicht-umlagefähiges HG", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      ancillaryCosts: 200, // Fallback ohne Split → gesamtes HG gilt als nicht-umlagef.
      maintenance: 50,
      annuityOverride: 375,
      interestOverride: 250,
      principalOverride: 125,
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.35,
    });

    expect(r.convention).toBe("net");
    expect(r.months).toBe(12);
    expect(r.rentTotal).toBe(12000);
    expect(r.coldRentTotal).toBe(12000);
    expect(r.hausgeldTotal).toBe(2400);
    expect(r.hausgeldNonRecoverable).toBe(2400);
    expect(r.reserveContribution).toBe(600);
    // operating = nicht-umlag HG + Rücklage + SEV + MAW
    expect(r.operatingCosts).toBe(2400 + 600);

    expect(r.cashflowBeforeTax).toBe(12000 - 4500 - 3000); // 4500
    expect(r.pretaxProfit).toBe(4600); // = 12000 − 2400 − 3000 − 2000
    expect(r.taxEffect).toBeCloseTo(1610, 6);
    expect(r.afterTaxCashflow).toBeCloseTo(2890, 6);
  });

  it("Split: rentTotal bleibt Kaltmiete; recoverable wäscht sich aus", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      propertyFeeRecoverable: 150,
      propertyFeeNotRecoverable: 50,
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0.35,
    });

    expect(r.rentTotal).toBe(12000);
    expect(r.recoverableForGross).toBe(1800);
    expect(r.hausgeldTotal).toBe(2400);
    expect(r.hausgeldNonRecoverable).toBe(600);
    // operating in net = nicht-umlag 600 (Rücklage und SEV nicht gesetzt)
    expect(r.operatingCosts).toBe(600);
    expect(r.cashflowBeforeTax).toBe(11400); // 12000 − 0 − 600
    // pretaxProfit unabhängig von der convention: Warmmiete-Logik
    expect(r.pretaxProfit).toBe(11400); // 13800 − 2400 − 0 − 0
  });
});

describe("computePnL — gross convention (Brutto-Brutto)", () => {
  it("rentTotal = Warmmiete; operatingCosts enthält volles HG", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      propertyFeeRecoverable: 150,
      propertyFeeNotRecoverable: 50,
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0.35,
      convention: "gross",
    });

    expect(r.rentTotal).toBe(13800); // Warmmiete (Kalt + umlagef.)
    expect(r.operatingCosts).toBe(2400); // volles HG
    expect(r.cashflowBeforeTax).toBe(11400); // identisch zur net-Variante!
    expect(r.pretaxProfit).toBe(11400); // identisch
  });
});

describe("computePnL — Steuer & Verluste", () => {
  it("Verlust → Steuereffekt negativ → after-tax > before-tax", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 400,
      ancillaryCosts: 200,
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
      buildingAfaBasis: 100000,
      depreciationRate: 0.02,
      taxRate: 0.35,
    });
    expect(r.months).toBe(3);
    expect(r.rentTotal).toBe(3000);
    expect(r.depreciation).toBeCloseTo(500, 6);
  });
});

describe("computePnL — MAW und SEV", () => {
  it("Mietausfallwagnis aus Rate × Kaltmiete", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      vacancyRate: 0.02,
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0,
    });
    // 1000 × 0.02 × 12 = 240
    expect(r.vacancyLoss).toBe(240);
    // MAW erhöht operatingCosts und schmälert den Cashflow
    expect(r.operatingCosts).toBe(240);
    expect(r.cashflowBeforeTax).toBe(12000 - 240);
  });

  it("Snapshot-Override schlägt die Rate", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      vacancyRate: 0.02,
      vacancyAmountMonthly: 50, // Override
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0,
    });
    expect(r.vacancyLoss).toBe(600); // 50 × 12, nicht 240
  });

  it("MAW ist NICHT steuerlich abzugsfähig (rein kalkulatorisch)", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      vacancyRate: 0.02, // 240 €/p.a.
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0.35,
    });
    // Cashflow vor Steuer: 12000 − 240 = 11760
    expect(r.cashflowBeforeTax).toBe(11760);
    // Steuerlicher Gewinn: voll 12000 (MAW mindert NICHT die Steuerbasis)
    expect(r.pretaxProfit).toBe(12000);
    // Steuer auf vollen Gewinn
    expect(r.taxEffect).toBeCloseTo(12000 * 0.35, 6);
    // Cashflow nach Steuer = vor Steuer − Steuer
    expect(r.afterTaxCashflow).toBeCloseTo(11760 - 4200, 6);
  });

  it("SEV-Verwaltungskosten zählen als operatingCost und sind steuerlich abziehbar", () => {
    const r = computePnL({
      period: PERIOD_2024,
      coldRent: 1000,
      managementCosts: 30,
      buildingAfaBasis: 0,
      depreciationRate: 0,
      taxRate: 0.4,
    });
    expect(r.managementTotal).toBe(360);
    expect(r.operatingCosts).toBe(360);
    expect(r.cashflowBeforeTax).toBe(12000 - 360);
    expect(r.pretaxProfit).toBe(12000 - 360);
    expect(r.taxEffect).toBeCloseTo((12000 - 360) * 0.4, 6);
  });
});

describe("computeBankView", () => {
  it("NOI = effektive Miete − nicht-umlagef. HG − Bank-IH − SEV", () => {
    const r = computeBankView({
      pnl: {
        period: PERIOD_2024,
        coldRent: 1000,
        propertyFeeNotRecoverable: 50,
        managementCosts: 20,
        vacancyRate: 0.02,
        buildingAfaBasis: 0,
        depreciationRate: 0,
        taxRate: 0,
      },
      sqm: 60,
      bankMaintenancePerSqm: 10, // 10 €/m² × 60 m² = 600 €/a
    });
    expect(r.rentScheduled).toBe(12000);
    expect(r.vacancyLoss).toBe(240);
    expect(r.rentEffective).toBe(11760);
    expect(r.hausgeldNonRecoverable).toBe(600);
    expect(r.bankMaintenance).toBe(600);
    expect(r.managementTotal).toBe(240);
    expect(r.noi).toBe(11760 - 600 - 600 - 240); // 10320
  });

  it("ICR = NOI / Zinsen", () => {
    const r = computeBankView({
      pnl: {
        period: PERIOD_2024,
        coldRent: 1000,
        interestOverride: 100,
        principalOverride: 50,
        buildingAfaBasis: 0,
        depreciationRate: 0,
        taxRate: 0,
      },
      sqm: null,
      bankMaintenancePerSqm: 0,
    });
    // NOI = 12000; Zinsen = 1200; ICR = 10
    expect(r.icr).toBeCloseTo(12000 / 1200, 6);
  });
});

describe("computePropertyKPIs", () => {
  it("Brutto-Rendite + LTV", () => {
    const r = computePropertyKPIs({
      annualColdRent: 12000,
      acquisitionCost: 200000,
      annualNetOperatingCosts: 2400,
      remainingLoans: 150000,
      marketValue: 250000,
    });
    expect(r.grossYield).toBeCloseTo(0.06, 6);
    expect(r.netYield).toBeCloseTo((12000 - 2400) / 200000, 6);
    expect(r.ltv).toBeCloseTo(0.6, 6);
  });

  it("LTV null wenn Marktwert fehlt", () => {
    const r = computePropertyKPIs({
      annualColdRent: 12000,
      acquisitionCost: 200000,
      annualNetOperatingCosts: 0,
      remainingLoans: 150000,
      marketValue: null,
    });
    expect(r.ltv).toBeNull();
  });
});
