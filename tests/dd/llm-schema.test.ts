import { describe, expect, it } from "vitest";
import { z } from "zod";
import { looseStringArray } from "@/lib/dd/schemas/primitives";
import { energieExtractionSchema } from "@/lib/dd/schemas/teilung-und-energie";

/** Minimaler, sonst valider Energieausweis-Extrakt. */
const validEnergie = {
  ausweis_typ: "bedarf",
  gueltig_bis: "2030-01-01",
  ausstellungsdatum: "2020-01-01",
  endenergie_kwh_per_sqm_a: 120,
  primaerenergie_kwh_per_sqm_a: 140,
  effizienzklasse: "D",
  co2_kg_per_sqm_a: 30,
  heizung: "Gas-Brennwert",
  heizung_baujahr: 1998,
  geg_hinweise: ["Austauschpflicht prüfen"],
  summary: "Bedarfsausweis, Klasse D.",
};

describe("looseStringArray", () => {
  const schema = z.object({ hinweise: looseStringArray() });

  it("lässt normale String-Listen unverändert", () => {
    expect(schema.parse({ hinweise: ["a", "b"] }).hinweise).toEqual(["a", "b"]);
  });

  it("wandelt Zahlen in Text (der gemeldete Fehlerfall)", () => {
    expect(
      schema.parse({ hinweise: ["Heizung Baujahr", 1998, "Frist", 2045] })
        .hinweise
    ).toEqual(["Heizung Baujahr", "1998", "Frist", "2045"]);
  });

  it("wandelt Booleans in Text", () => {
    expect(schema.parse({ hinweise: [true] }).hinweise).toEqual(["true"]);
  });

  it("wirft null-Einträge raus statt zu scheitern", () => {
    expect(schema.parse({ hinweise: ["a", null, "b"] }).hinweise).toEqual([
      "a",
      "b",
    ]);
  });

  it("hebt einen einzelnen Skalar in eine Liste", () => {
    expect(schema.parse({ hinweise: "Keine Hinweise" }).hinweise).toEqual([
      "Keine Hinweise",
    ]);
  });

  it("macht aus null/undefined eine leere Liste", () => {
    expect(schema.parse({ hinweise: null }).hinweise).toEqual([]);
    expect(schema.parse({}).hinweise).toEqual([]);
  });

  it("akzeptiert KEINE Objekte — dann hat das Modell die Struktur missverstanden", () => {
    expect(schema.safeParse({ hinweise: [{ text: "a" }] }).success).toBe(false);
  });
});

describe("energieExtractionSchema", () => {
  // Seit dem Umbau auf Tool Use ist kaputtes JSON ausgeschlossen — die
  // Feld-TYPEN garantiert Anthropic aber nur mit `strict: true`, was auf
  // claude-sonnet-4-5 nicht verfügbar ist. Das input_schema ist dort ein
  // starker Hinweis, keine Zusage. Und da `tryValidate` keinen Retry mehr
  // kennt, ist diese Toleranz jetzt die einzige Absicherung.
  it("akzeptiert Zahlen in geg_hinweise (Regression zum Extraktions-Abbruch)", () => {
    const parsed = energieExtractionSchema.safeParse({
      ...validEnergie,
      // Genau die Konstellation aus dem Fehler: Index 7 und 9 sind Zahlen.
      geg_hinweise: ["a", "b", "c", "d", "e", "f", "g", 2045, "i", 65],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.geg_hinweise[7]).toBe("2045");
      expect(parsed.data.geg_hinweise[9]).toBe("65");
    }
  });
});
