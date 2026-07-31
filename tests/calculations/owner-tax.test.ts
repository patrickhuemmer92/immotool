import { describe, expect, it } from "vitest";
import {
  blendedTaxRate,
  hasOwnTaxRate,
  taxSharesFromPropertyOwners,
} from "@/lib/calculations/owner-tax";
import { computePnL } from "@/lib/calculations/pnl";

const FALLBACK = 0.35;

describe("blendedTaxRate", () => {
  it("nutzt den Workspace-Satz, wenn kein Eigentümer zugeordnet ist", () => {
    expect(blendedTaxRate([], FALLBACK)).toBe(FALLBACK);
  });

  it("nutzt den Workspace-Satz für Eigentümer ohne eigenen Satz", () => {
    expect(
      blendedTaxRate(
        [
          { ownership_share: 0.6, tax_rate: null },
          { ownership_share: 0.4, tax_rate: null },
        ],
        FALLBACK
      )
    ).toBeCloseTo(FALLBACK, 10);
  });

  it("gewichtet zwei unterschiedlich veranlagte Eigentümer nach Anteil", () => {
    // 60 % @ 42 % + 40 % @ 25 % = 35,2 %
    expect(
      blendedTaxRate(
        [
          { ownership_share: 0.6, tax_rate: 0.42 },
          { ownership_share: 0.4, tax_rate: 0.25 },
        ],
        FALLBACK
      )
    ).toBeCloseTo(0.352, 10);
  });

  it("mischt eigene Sätze mit dem Fallback", () => {
    // 50 % @ 45 % + 50 % @ Fallback 35 % = 40 %
    expect(
      blendedTaxRate(
        [
          { ownership_share: 0.5, tax_rate: 0.45 },
          { ownership_share: 0.5, tax_rate: null },
        ],
        FALLBACK
      )
    ).toBeCloseTo(0.4, 10);
  });

  it("verarbeitet Numeric-Strings aus Postgres", () => {
    expect(
      blendedTaxRate(
        [
          { ownership_share: "0.7500", tax_rate: "0.4200" },
          { ownership_share: "0.2500", tax_rate: "0.1400" },
        ],
        FALLBACK
      )
    ).toBeCloseTo(0.35, 10);
  });

  it("normiert Anteile, die nicht auf 1.0 summieren (Altdaten)", () => {
    // Nur ein Eigentümer mit 50 % hinterlegt → sein Satz gilt voll,
    // statt gegen 0 verwässert zu werden.
    expect(
      blendedTaxRate([{ ownership_share: 0.5, tax_rate: 0.42 }], FALLBACK)
    ).toBeCloseTo(0.42, 10);
  });

  it("ignoriert Zeilen ohne verwertbaren Anteil", () => {
    expect(
      blendedTaxRate(
        [
          { ownership_share: null, tax_rate: 0.9 },
          { ownership_share: 0, tax_rate: 0.9 },
          { ownership_share: 1, tax_rate: 0.3 },
        ],
        FALLBACK
      )
    ).toBeCloseTo(0.3, 10);
  });

  it("akzeptiert 0 % als expliziten Satz (nicht als „leer\")", () => {
    expect(
      blendedTaxRate(
        [
          { ownership_share: 0.5, tax_rate: 0 },
          { ownership_share: 0.5, tax_rate: 0.4 },
        ],
        FALLBACK
      )
    ).toBeCloseTo(0.2, 10);
  });
});

describe("taxSharesFromPropertyOwners", () => {
  it("mappt den many-to-one-Embed (Objekt)", () => {
    expect(
      taxSharesFromPropertyOwners([
        { ownership_share: 0.5, owner: { tax_rate: 0.42 } },
      ])
    ).toEqual([{ ownership_share: 0.5, tax_rate: 0.42 }]);
  });

  it("mappt die Array-Variante des Embeds", () => {
    expect(
      taxSharesFromPropertyOwners([
        { ownership_share: 0.5, owner: [{ tax_rate: 0.42 }] },
      ])
    ).toEqual([{ ownership_share: 0.5, tax_rate: 0.42 }]);
  });

  it("liefert null, wenn der Eigentümer keinen Satz hat", () => {
    expect(
      taxSharesFromPropertyOwners([
        { ownership_share: 1, owner: { tax_rate: null } },
        { ownership_share: 1 },
      ])
    ).toEqual([
      { ownership_share: 1, tax_rate: null },
      { ownership_share: 1, tax_rate: null },
    ]);
  });

  it("verkraftet null/undefined", () => {
    expect(taxSharesFromPropertyOwners(null)).toEqual([]);
    expect(taxSharesFromPropertyOwners(undefined)).toEqual([]);
  });
});

describe("hasOwnTaxRate", () => {
  it("false, wenn alle Beteiligten auf den Default fallen", () => {
    expect(
      hasOwnTaxRate([
        { ownership_share: 0.5, tax_rate: null },
        { ownership_share: 0.5, tax_rate: null },
      ])
    ).toBe(false);
  });

  it("true, sobald ein Beteiligter einen eigenen Satz hat", () => {
    expect(
      hasOwnTaxRate([
        { ownership_share: 0.5, tax_rate: 0.42 },
        { ownership_share: 0.5, tax_rate: null },
      ])
    ).toBe(true);
  });

  it("ignoriert Sätze von Eigentümern ohne Anteil", () => {
    expect(
      hasOwnTaxRate([{ ownership_share: 0, tax_rate: 0.42 }])
    ).toBe(false);
  });
});

describe("Mischsatz im Steuereffekt", () => {
  // Verifiziert die Kernaussage des Modells: Steuereffekt mit Mischsatz
  // == Summe der anteiligen Steuereffekte je Eigentümer.
  const baseInput = {
    period: {
      start: new Date(Date.UTC(2024, 0, 1)),
      end: new Date(Date.UTC(2024, 11, 1)),
    },
    coldRent: 1000,
    propertyFeeRecoverable: 0,
    propertyFeeNotRecoverable: 200,
    annuityOverride: 500,
    interestOverride: 400,
    principalOverride: 100,
    buildingAfaBasis: 200000,
    depreciationRate: 0.02,
    taxRate: 0,
  };

  it("Mischsatz-Steuereffekt = Summe der anteiligen Einzel-Steuereffekte", () => {
    const shares = [
      { ownership_share: 0.6, tax_rate: 0.42 },
      { ownership_share: 0.4, tax_rate: 0.25 },
    ];
    const blended = blendedTaxRate(shares, 0.35);

    const withBlended = computePnL({ ...baseInput, taxRate: blended });
    const perOwner = shares.reduce((sum, s) => {
      const r = computePnL({
        ...baseInput,
        taxRate: Number(s.tax_rate),
      });
      return sum + Number(s.ownership_share) * r.taxEffect;
    }, 0);

    expect(withBlended.taxEffect).toBeCloseTo(perOwner, 8);
  });
});
