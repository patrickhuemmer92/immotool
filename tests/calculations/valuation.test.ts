import { describe, expect, it } from "vitest";
import { computeValuation } from "@/lib/calculations/valuation";

describe("computeValuation", () => {
  it("Ertragswert = sqm * rent/m² * 12 * multiple", () => {
    const r = computeValuation({
      sqm: 60,
      marketRentPerSqm: 10,
      multiple: 22,
      landValue: null,
      buildingValue: null,
    });
    expect(r.ertragswert).toBe(60 * 10 * 12 * 22);
    expect(r.sachwert).toBeNull();
    expect(r.combined).toBe(60 * 10 * 12 * 22);
  });

  it("Sachwert = Bodenwert + Gebäudewert", () => {
    const r = computeValuation({
      sqm: null,
      marketRentPerSqm: null,
      multiple: null,
      landValue: 30000,
      buildingValue: 120000,
    });
    expect(r.sachwert).toBe(150000);
    expect(r.ertragswert).toBeNull();
    expect(r.combined).toBe(150000);
  });

  it("Kombiniert 50/50", () => {
    const r = computeValuation({
      sqm: 60,
      marketRentPerSqm: 10,
      multiple: 22,
      landValue: 30000,
      buildingValue: 120000,
    });
    expect(r.combined).toBe((60 * 10 * 12 * 22) * 0.5 + 150000 * 0.5);
  });

  it("kein Input → alles null", () => {
    expect(
      computeValuation({
        sqm: null,
        marketRentPerSqm: null,
        multiple: null,
        landValue: null,
        buildingValue: null,
      })
    ).toEqual({ ertragswert: null, sachwert: null, combined: null });
  });
});
