import { describe, expect, it } from "vitest";
import {
  tenantScore,
  tenantScoreBand,
  readTenantScoreWeights,
  DEFAULT_TENANT_SCORE_WEIGHTS,
} from "@/lib/calculations/tenant";

describe("tenantScore (unweighted = default)", () => {
  it("Mittelwert aller gesetzten Felder", () => {
    expect(
      tenantScore({
        family_status: 5,
        schufa: 5,
        rental_duration: 4,
        personal_impression: 5,
        employment_status: 4,
        income_level: 3,
      })
    ).toBeCloseTo((5 + 5 + 4 + 5 + 4 + 3) / 6, 6);
  });

  it("ignoriert null/undefined", () => {
    expect(
      tenantScore({
        family_status: 4,
        schufa: 2,
        rental_duration: null,
        personal_impression: undefined,
        employment_status: 3,
        income_level: 5,
      })
    ).toBeCloseTo((4 + 2 + 3 + 5) / 4, 6);
  });

  it("leerer Tenant → null", () => {
    expect(tenantScore({})).toBeNull();
  });
});

describe("tenantScore (gewichtet)", () => {
  it("SCHUFA doppelt gewichtet zieht Score in Richtung SCHUFA-Wert", () => {
    const plain = tenantScore({ schufa: 5, family_status: 1 });
    const weighted = tenantScore(
      { schufa: 5, family_status: 1 },
      { schufa: 2, family_status: 1 }
    );
    expect(plain).toBeCloseTo(3, 6); // (5+1)/2
    expect(weighted).toBeCloseTo((5 * 2 + 1 * 1) / 3, 6); // 11/3 = 3.666…
    expect(weighted).toBeGreaterThan(plain as number);
  });

  it("Faktor mit Gewicht 0 wird komplett ignoriert", () => {
    expect(
      tenantScore(
        { schufa: 5, family_status: 1 },
        { schufa: 1, family_status: 0 }
      )
    ).toBe(5);
  });

  it("alle Gewichte 1 = klassischer Mittelwert", () => {
    const scores = {
      family_status: 4,
      schufa: 3,
      rental_duration: 5,
      personal_impression: 2,
      employment_status: 4,
      income_level: 5,
    };
    expect(tenantScore(scores)).toBeCloseTo(
      tenantScore(scores, DEFAULT_TENANT_SCORE_WEIGHTS) as number,
      10
    );
  });
});

describe("readTenantScoreWeights", () => {
  it("liefert Defaults wenn Input null/undefined", () => {
    expect(readTenantScoreWeights(null)).toEqual(DEFAULT_TENANT_SCORE_WEIGHTS);
    expect(readTenantScoreWeights(undefined)).toEqual(
      DEFAULT_TENANT_SCORE_WEIGHTS
    );
  });

  it("übernimmt nur valide numerische Werte", () => {
    const w = readTenantScoreWeights({
      family_status: 2,
      schufa: "1.5",
      rental_duration: "abc",
      personal_impression: -1,
    });
    expect(w.family_status).toBe(2);
    expect(w.schufa).toBe(1.5);
    expect(w.rental_duration).toBe(1); // fallback (invalid)
    expect(w.personal_impression).toBe(1); // fallback (negative rejected)
  });
});

describe("tenantScoreBand", () => {
  it("Bandbreiten klassifizieren", () => {
    expect(tenantScoreBand(null).label).toBe("unknown");
    expect(tenantScoreBand(4.5).label).toBe("high");
    expect(tenantScoreBand(3.5).label).toBe("medium");
    expect(tenantScoreBand(2.5).label).toBe("low");
  });
});
