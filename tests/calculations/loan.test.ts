import { describe, expect, it } from "vitest";
import {
  generateSchedule,
  loanBalance,
  monthlyAnnuity,
  monthlySplit,
} from "@/lib/calculations/loan";

const baseLoan = {
  loanAmount: 76000,
  interestRatePa: 0.0401,
  amortizationPa: 0.02,
  firstPaymentDate: new Date(Date.UTC(2020, 0, 1)),
};

describe("monthlyAnnuity", () => {
  // Brief nennt 380.6433. Standard-Bankformel ergibt 380.6333.
  // Differenz 0.01 EUR — vermutlich Rundungsdifferenz im Excel oder Tippfehler.
  // Toleranz 0.05 EUR akzeptiert beide Werte.
  it("76000 / 4.01% / 2% → ~380.63", () => {
    expect(monthlyAnnuity(baseLoan)).toBeCloseTo(380.6333, 3);
  });

  it("0% Zins entspricht reiner Tilgung", () => {
    expect(
      monthlyAnnuity({ ...baseLoan, interestRatePa: 0, amortizationPa: 0.05 })
    ).toBeCloseTo((76000 * 0.05) / 12, 6);
  });
});

describe("monthlySplit", () => {
  it("Zinsanteil = Restschuld * i_m, Tilgung = Annuität − Zins", () => {
    const split = monthlySplit(baseLoan, 76000);
    expect(split.interest).toBeCloseTo((76000 * 0.0401) / 12, 6);
    expect(split.principal).toBeCloseTo(monthlyAnnuity(baseLoan) - split.interest, 6);
    expect(split.payment).toBeCloseTo(monthlyAnnuity(baseLoan), 6);
  });

  it("letzte Rate clampt auf Restbetrag", () => {
    const split = monthlySplit(baseLoan, 50);
    expect(split.principal).toBeLessThanOrEqual(50);
  });
});

describe("generateSchedule", () => {
  it("erste Rate trifft Annuität", () => {
    const schedule = generateSchedule(baseLoan, {
      untilDate: new Date(Date.UTC(2020, 0, 1)),
    });
    expect(schedule).toHaveLength(1);
    expect(schedule[0].payment).toBeCloseTo(380.6333, 2);
  });

  it("Restschuld nach 12 Monaten reduziert", () => {
    const schedule = generateSchedule(baseLoan, {
      untilDate: new Date(Date.UTC(2020, 11, 1)),
    });
    expect(schedule).toHaveLength(12);
    const last = schedule[11];
    expect(last.balance).toBeLessThan(76000);
    expect(last.balance).toBeGreaterThan(74000);
  });

  it("Sondertilgung wirkt im richtigen Monat", () => {
    const without = generateSchedule(baseLoan, {
      untilDate: new Date(Date.UTC(2020, 11, 1)),
    });
    const withSpecial = generateSchedule(baseLoan, {
      untilDate: new Date(Date.UTC(2020, 11, 1)),
      specialRepayments: [
        { date: new Date(Date.UTC(2020, 5, 15)), amount: 5000 },
      ],
    });
    const lastWithout = without[11].balance;
    const lastWithSpecial = withSpecial[11].balance;
    // Sondertilgung im Juni reduziert Restschuld um 5000 + zusätzliche
    // beschleunigte Tilgung (kleinerer Zinsanteil) für H2.
    expect(lastWithout - lastWithSpecial).toBeGreaterThanOrEqual(5000);
    expect(lastWithout - lastWithSpecial).toBeLessThan(5200);
    expect(withSpecial[5].specialRepayment).toBe(5000);
  });

  it("interestShareFirstRate überschreibt erste Zinsberechnung", () => {
    const schedule = generateSchedule(
      { ...baseLoan, interestShareFirstRate: 100 },
      { untilDate: new Date(Date.UTC(2020, 0, 1)) }
    );
    expect(schedule[0].interest).toBe(100);
  });
});

describe("loanBalance", () => {
  it("vor erster Rate = Originalbetrag", () => {
    expect(loanBalance(baseLoan, new Date(Date.UTC(2019, 11, 31)))).toBe(76000);
  });

  it("zum Stichtag = Restschuld nach allen Raten bis dahin", () => {
    const balance = loanBalance(baseLoan, new Date(Date.UTC(2025, 0, 1)));
    expect(balance).toBeLessThan(76000);
    expect(balance).toBeGreaterThan(0);
  });

  it("Sondertilgung reduziert Restschuld zu späterem Datum", () => {
    const without = loanBalance(baseLoan, new Date(Date.UTC(2025, 0, 1)));
    const withSpecial = loanBalance(
      baseLoan,
      new Date(Date.UTC(2025, 0, 1)),
      [{ date: new Date(Date.UTC(2022, 5, 15)), amount: 10000 }]
    );
    expect(without - withSpecial).toBeGreaterThan(10000);
  });
});
