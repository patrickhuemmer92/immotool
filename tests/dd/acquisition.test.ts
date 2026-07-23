import { describe, it, expect } from "vitest";
import {
  computeAcquisitionCosts,
  computeGrossYield,
} from "@/lib/dd/acquisition";

describe("computeAcquisitionCosts", () => {
  it("Bayern (3,5% GrESt): 500k Kaufpreis, keine Makler", () => {
    const r = computeAcquisitionCosts({
      purchase_price_eur: 500_000,
      postal_code: "80331", // München → BY
      broker_commission_eur: null,
      broker_commission_pct: null,
    });
    expect(r.state_code).toBe("BY");
    expect(r.transfer_tax_pct).toBe(0.035);
    expect(r.transfer_tax_eur).toBe(17_500);
    expect(r.notary_grundbuch_eur).toBe(10_000); // 2%
    expect(r.broker_fee_eur).toBe(null);
    expect(r.side_costs_total_eur).toBe(27_500);
    expect(r.total_acquisition_eur).toBe(527_500);
  });

  it("NRW (6,5% GrESt) mit Makler-Prozentsatz", () => {
    const r = computeAcquisitionCosts({
      purchase_price_eur: 400_000,
      postal_code: "50667", // Köln → NW
      broker_commission_eur: null,
      broker_commission_pct: 3.57,
    });
    expect(r.state_code).toBe("NW");
    expect(r.transfer_tax_eur).toBe(26_000); // 6,5%
    expect(r.broker_fee_eur).toBe(14_280); // 3,57%
    expect(r.side_costs_total_eur).toBe(48_280); // 26k + 8k + 14,28k
  });

  it("Makler-EUR wird bevorzugt vor Makler-Prozent", () => {
    const r = computeAcquisitionCosts({
      purchase_price_eur: 300_000,
      postal_code: "10115",
      broker_commission_eur: 12_000, // manuell aus Exposé
      broker_commission_pct: 5.0, // ignoriert
    });
    expect(r.broker_fee_eur).toBe(12_000);
  });

  it("Unbekannte PLZ → 5% Standard, state_code '??'", () => {
    const r = computeAcquisitionCosts({
      purchase_price_eur: 100_000,
      postal_code: "abc",
      broker_commission_eur: null,
      broker_commission_pct: null,
    });
    expect(r.state_code).toBe("??");
    expect(r.transfer_tax_pct).toBe(0.05);
  });
});

describe("computeGrossYield", () => {
  it("Miete 1.200/Monat, Kaufpreis 300k → 4,8 %", () => {
    const r = computeGrossYield({
      purchase_price_eur: 300_000,
      monthly_cold_rent_eur: 1_200,
      total_acquisition_eur: 330_000,
    });
    expect(r.gross_yield_pct).toBeCloseTo(0.048);
    // 14400 / 330000 = ~4,36 %
    expect(r.gross_yield_on_total_pct).toBeCloseTo(0.04364, 3);
  });

  it("Keine Miete → alles null (nicht raten)", () => {
    const r = computeGrossYield({
      purchase_price_eur: 300_000,
      monthly_cold_rent_eur: null,
      total_acquisition_eur: 330_000,
    });
    expect(r.gross_yield_pct).toBe(null);
    expect(r.gross_yield_on_total_pct).toBe(null);
    expect(r.monthly_rent_eur).toBe(null);
  });

  it("Miete = 0 → null (verhindert Div-by-zero-artige Anzeige 0%)", () => {
    const r = computeGrossYield({
      purchase_price_eur: 300_000,
      monthly_cold_rent_eur: 0,
      total_acquisition_eur: 330_000,
    });
    expect(r.gross_yield_pct).toBe(null);
  });
});
