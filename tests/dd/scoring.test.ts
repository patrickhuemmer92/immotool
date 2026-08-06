import { describe, it, expect } from "vitest";
import { computeScore, findingPenalty } from "@/lib/dd/scoring";
import type { ConsolidatedFinding } from "@/lib/dd/schemas/findings";

function finding(
  category: ConsolidatedFinding["category"],
  severity: ConsolidatedFinding["severity"],
  confidence = 0.9,
  extra: Partial<ConsolidatedFinding> = {}
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
    status: "offen",
    confidence,
    confidence_reason: "r",
    next_step: "n",
    ...extra,
  };
}

const FULL_COVERAGE = {
  hasExpose: true,
  hasWeg: true,
  hasWirtschaftsplan: true,
  hasTeilung: true,
  hasEnergie: true,
  hasMarket: true,
};

const ONLY_EXPOSE = {
  hasExpose: true,
  hasWeg: false,
  hasWirtschaftsplan: false,
  hasTeilung: false,
  hasEnergie: false,
  hasMarket: false,
};

describe("computeScore — Grundverhalten", () => {
  it("gibt bei leeren Findings + kompletter Datenlage einen guten Score", () => {
    const r = computeScore([], FULL_COVERAGE);
    expect(r.overall).toBe(80);
    expect(r.confidence).toBe(0.9);
    expect(r.unrated).toEqual([]);
  });

  it("Konfidenz steigt mit der Aktenlage", () => {
    const a = computeScore([], ONLY_EXPOSE);
    const b = computeScore([], { ...ONLY_EXPOSE, hasWeg: true });
    const c = computeScore([], FULL_COVERAGE);
    expect(a.confidence).toBeLessThan(b.confidence);
    expect(b.confidence).toBeLessThan(c.confidence);
  });

  it("niedrige Beleglage daempft die Strafe", () => {
    const belegt = computeScore([finding("weg", "high", 1)], FULL_COVERAGE);
    const vage = computeScore([finding("weg", "high", 0)], FULL_COVERAGE);
    expect(belegt.by_category.weg.score!).toBeLessThan(
      vage.by_category.weg.score!
    );
  });
});

describe("Kategorien ohne Quelle werden nicht bewertet", () => {
  it("markiert `recht` ohne Teilungserklaerung als nicht bewertet", () => {
    const r = computeScore([], ONLY_EXPOSE);
    expect(r.by_category.recht.score).toBeNull();
    expect(r.by_category.recht.ampel).toBe("unrated");
    expect(r.unrated).toContain("recht");
  });

  it("zaehlt Substanz ohne WEG-Protokoll nicht als gruen", () => {
    // Der gefaehrlichste Fall der alten Fassung: keine Protokolle, also
    // keine Findings, also 80 und gruen — obwohl nichts geprueft wurde.
    const r = computeScore([], ONLY_EXPOSE);
    expect(r.by_category.substanz.score).toBeNull();
    expect(r.by_category.substanz.ampel).not.toBe("green");
  });

  it("rechnet nicht bewertete Kategorien aus dem Gesamtscore heraus", () => {
    // Nur Exposé: bewertet werden finanzierung, energie, lage — alle bei
    // 80, ohne Findings. Der Gesamtscore muss 80 sein, nicht anteilig
    // heruntergezogen.
    const r = computeScore([], ONLY_EXPOSE);
    expect(r.overall).toBe(80);
  });

  it("markt braucht Marktdaten", () => {
    const ohne = computeScore([], { ...FULL_COVERAGE, hasMarket: false });
    expect(ohne.by_category.markt.score).toBeNull();
    expect(ohne.by_category.markt.ampel).toBe("unrated");
  });
});

describe("Status entscheidet ueber die Score-Wirkung", () => {
  const offen = finding("finanzierung", "high", 1, { status: "offen" });
  const zuBelegen = finding("finanzierung", "high", 1, { status: "zu_belegen" });
  const erledigt = finding("finanzierung", "high", 1, { status: "erledigt" });

  it("erledigt zieht gar nicht mehr ab", () => {
    const r = computeScore([erledigt], FULL_COVERAGE);
    expect(r.by_category.finanzierung.score).toBe(80);
    expect(r.by_category.finanzierung.count_resolved).toBe(1);
    // Es bleibt trotzdem als Finding sichtbar.
    expect(r.by_category.finanzierung.count_high).toBe(1);
  });

  it("zu_belegen liegt zwischen offen und erledigt", () => {
    const a = computeScore([offen], FULL_COVERAGE).by_category.finanzierung
      .score!;
    const b = computeScore([zuBelegen], FULL_COVERAGE).by_category.finanzierung
      .score!;
    const c = computeScore([erledigt], FULL_COVERAGE).by_category.finanzierung
      .score!;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("eine muendliche Maklerzusage rettet den Score nicht komplett", () => {
    const r = computeScore([zuBelegen], FULL_COVERAGE);
    expect(r.by_category.finanzierung.score!).toBeLessThan(80);
  });
});

describe("Kosten wiegen nach Anteil am Kaufpreis", () => {
  const klein = finding("finanzierung", "high", 1, {
    cost_min_eur: 882,
    cost_max_eur: 882,
  });
  const gross = finding("finanzierung", "high", 1, {
    cost_min_eur: 9870,
    cost_max_eur: 9870,
  });

  it("882 EUR wiegen weniger als 9.870 EUR — vorher identisch", () => {
    const a = findingPenalty(klein, 450_000);
    const b = findingPenalty(gross, 450_000);
    expect(a).toBeLessThan(b);
  });

  it("ohne Kaufpreis bleibt es beim Schweregrad allein", () => {
    expect(findingPenalty(klein, null)).toBe(findingPenalty(gross, null));
  });

  it("ohne bezifferte Kosten bleibt es beim Schweregrad allein", () => {
    const ohne = finding("finanzierung", "high", 1);
    expect(findingPenalty(ohne, 450_000)).toBe(findingPenalty(ohne, null));
  });

  it("deckelt den Ausschlag nach oben — ein Grossposten ueberschreibt den Schweregrad nicht", () => {
    const riesig = finding("finanzierung", "high", 1, {
      cost_min_eur: 200_000,
      cost_max_eur: 200_000,
    });
    const normal = finding("finanzierung", "high", 1, {
      cost_min_eur: 9_000,
      cost_max_eur: 9_000,
    });
    expect(findingPenalty(riesig, 450_000)).toBeLessThan(
      findingPenalty(normal, 450_000) * 3
    );
  });
});

describe("Mehrere Findings wirken degressiv", () => {
  it("drei hohe Findings druecken eine Kategorie nicht mehr auf 5", () => {
    const drei = [
      finding("weg", "high", 1),
      finding("weg", "high", 1),
      finding("weg", "high", 1),
    ];
    const r = computeScore(drei, FULL_COVERAGE);
    // Alte Fassung: 80 - 3*25 = 5. Neu deutlich darueber.
    expect(r.by_category.weg.score!).toBeGreaterThan(20);
    expect(r.by_category.weg.score!).toBeLessThan(50);
  });

  it("das schwerste Finding zaehlt voll, jedes weitere weniger", () => {
    const eins = computeScore([finding("weg", "high", 1)], FULL_COVERAGE)
      .by_category.weg.score!;
    const zwei = computeScore(
      [finding("weg", "high", 1), finding("weg", "high", 1)],
      FULL_COVERAGE
    ).by_category.weg.score!;
    const ersterAbzug = 80 - eins;
    const zweiterAbzug = eins - zwei;
    expect(zweiterAbzug).toBeGreaterThan(0);
    expect(zweiterAbzug).toBeLessThan(ersterAbzug);
  });
});

describe("Objektzustand und Preiswuerdigkeit getrennt", () => {
  it("ein Rentabilitaets-Problem schlaegt nicht auf den Zustand durch", () => {
    const r = computeScore(
      [finding("finanzierung", "high", 1), finding("markt", "high", 1)],
      FULL_COVERAGE
    );
    expect(r.condition).toBe(80);
    expect(r.price!).toBeLessThan(80);
  });

  it("ein Substanzproblem schlaegt nicht auf den Preis durch", () => {
    const r = computeScore([finding("substanz", "high", 1)], FULL_COVERAGE);
    expect(r.price).toBe(80);
    expect(r.condition!).toBeLessThan(80);
  });

  it("liefert null, wenn in einer Gruppe nichts bewertbar ist", () => {
    const r = computeScore([], {
      hasExpose: false,
      hasWeg: false,
      hasWirtschaftsplan: false,
      hasTeilung: false,
      hasEnergie: false,
      hasMarket: false,
    });
    expect(r.condition).toBeNull();
    expect(r.price).toBeNull();
  });
});

describe("Der gemeldete Fall", () => {
  it("zwei belegte Sonderumlagen ergeben keine 6/100 mehr", () => {
    // Nachstellung: zwei Sonderumlagen, beide belegt, plus ein drittes
    // Finding. Kaufpreis 450k. Vorher: 80 - 3*25 = 5.
    const findings = [
      finding("finanzierung", "high", 1, {
        cost_min_eur: 882,
        cost_max_eur: 882,
      }),
      finding("finanzierung", "high", 1, {
        cost_min_eur: 9870,
        cost_max_eur: 9870,
      }),
      finding("finanzierung", "high", 0.9),
    ];
    const r = computeScore(findings, FULL_COVERAGE, {
      purchasePriceEur: 450_000,
    });
    expect(r.by_category.finanzierung.score!).toBeGreaterThan(30);
  });

  it("mit Zahlungsnachweis faellt die Belastung weitgehend weg", () => {
    const belegt = [
      finding("finanzierung", "high", 1, {
        cost_min_eur: 882,
        cost_max_eur: 882,
        status: "erledigt",
      }),
      finding("finanzierung", "high", 1, {
        cost_min_eur: 9870,
        cost_max_eur: 9870,
        status: "erledigt",
      }),
    ];
    const r = computeScore(belegt, FULL_COVERAGE, {
      purchasePriceEur: 450_000,
    });
    expect(r.by_category.finanzierung.score).toBe(80);
  });
});
