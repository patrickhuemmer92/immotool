import { describe, expect, it } from "vitest";
import { tenantScore, tenantScoreBand } from "@/lib/calculations/tenant";

describe("tenantScore", () => {
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

describe("tenantScoreBand", () => {
  it("Bandbreiten klassifizieren", () => {
    expect(tenantScoreBand(null).label).toBe("unknown");
    expect(tenantScoreBand(4.5).label).toBe("high");
    expect(tenantScoreBand(3.5).label).toBe("medium");
    expect(tenantScoreBand(2.5).label).toBe("low");
  });
});
