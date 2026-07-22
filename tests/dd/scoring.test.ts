import { describe, it, expect } from "vitest";
import { computeScore } from "@/lib/dd/scoring";
import type { ConsolidatedFinding } from "@/lib/dd/schemas/findings";

function finding(
  category: ConsolidatedFinding["category"],
  severity: ConsolidatedFinding["severity"],
  confidence = 0.9
): ConsolidatedFinding {
  return {
    category,
    severity,
    title: "t",
    description: "d",
    cost_min_eur: null,
    cost_max_eur: null,
    cost_horizon: null,
    source_kind: "expose",
    source_quote: null,
    source_location: null,
    confidence,
    confidence_reason: "r",
    next_step: "n",
  };
}

const FULL_COVERAGE = {
  hasExpose: true,
  hasWeg: true,
  hasWirtschaftsplan: true,
  hasTeilung: true,
  hasEnergie: true,
};

const ONLY_EXPOSE = {
  hasExpose: true,
  hasWeg: false,
  hasWirtschaftsplan: false,
  hasTeilung: false,
  hasEnergie: false,
};

describe("computeScore", () => {
  it("gibt bei leeren Findings + kompletter Datenlage einen guten Score", () => {
    const r = computeScore([], FULL_COVERAGE);
    // Alle Kategorien starten bei 80, gewichteter Mittelwert = 80.
    expect(r.overall).toBe(80);
    expect(r.confidence).toBe(0.9);
    for (const c of Object.values(r.by_category)) {
      expect(c.ampel).toBe("green");
    }
  });

  it("nur Exposé → niedrige Konfidenz auch bei perfekten Findings", () => {
    const r = computeScore([], ONLY_EXPOSE);
    expect(r.confidence).toBe(0.3);
    expect(r.overall).toBe(80);
  });

  it("high-Severity mit hoher Confidence senkt Score deutlich", () => {
    const findings = [
      finding("substanz", "high", 1),
      finding("substanz", "high", 1),
    ];
    const r = computeScore(findings, FULL_COVERAGE);
    // substanz: 80 - 2*25 = 30 → ampel rot
    expect(r.by_category.substanz.score).toBe(30);
    expect(r.by_category.substanz.ampel).toBe("red");
    expect(r.by_category.substanz.count_high).toBe(2);
  });

  it("niedrige Confidence dämpft die Strafe", () => {
    const high = computeScore([finding("finanzierung", "high", 1)], FULL_COVERAGE);
    const low = computeScore([finding("finanzierung", "high", 0)], FULL_COVERAGE);
    // 80 - 25 = 55 vs. 80 - 12.5 = 67.5
    expect(high.by_category.finanzierung.score).toBe(55);
    expect(low.by_category.finanzierung.score).toBeCloseTo(67.5);
  });

  it("positive Findings geben Bonus", () => {
    const r = computeScore(
      [finding("weg", "positive", 1), finding("weg", "positive", 1)],
      FULL_COVERAGE
    );
    // 80 + 2*5 = 90, aber Cap ist 100
    expect(r.by_category.weg.score).toBe(90);
    expect(r.by_category.weg.count_positive).toBe(2);
  });

  it("Ampel-Grenzen: 65 grün, 40-64 gelb, <40 rot", () => {
    const green = computeScore([finding("energie", "medium", 1)], FULL_COVERAGE);
    // 80 - 12 = 68 → grün
    expect(green.by_category.energie.ampel).toBe("green");

    const yellow = computeScore(
      [finding("energie", "medium", 1), finding("energie", "medium", 1), finding("energie", "medium", 1)],
      FULL_COVERAGE
    );
    // 80 - 3*12 = 44 → gelb
    expect(yellow.by_category.energie.ampel).toBe("yellow");
  });

  it("Konfidenz-Progression: mehr Docs = mehr Konfidenz", () => {
    const a = computeScore([], { hasExpose: true, hasWeg: false, hasWirtschaftsplan: false, hasTeilung: false, hasEnergie: false });
    const b = computeScore([], { hasExpose: true, hasWeg: true, hasWirtschaftsplan: false, hasTeilung: false, hasEnergie: false });
    const c = computeScore([], { hasExpose: true, hasWeg: true, hasWirtschaftsplan: true, hasTeilung: false, hasEnergie: false });
    const d = computeScore([], FULL_COVERAGE);
    expect(a.confidence).toBeLessThan(b.confidence);
    expect(b.confidence).toBeLessThan(c.confidence);
    expect(c.confidence).toBeLessThan(d.confidence);
  });
});
