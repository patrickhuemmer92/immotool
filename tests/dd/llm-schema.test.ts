import { describe, expect, it } from "vitest";
import { z } from "zod";
import { looseStringArray } from "@/lib/dd/schemas/primitives";
import { energieExtractionSchema } from "@/lib/dd/schemas/teilung-und-energie";
import {
  buildRepairInstruction,
  tryParseAndValidate,
} from "@/lib/dd/llm";

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
  it("akzeptiert Zahlen in geg_hinweise (Regression zum Retry-Abbruch)", () => {
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

describe("tryParseAndValidate", () => {
  it("unterscheidet Syntax- von Schema-Fehlern", () => {
    const schema = z.object({ a: z.string() });

    // Leere Antwort: weder JSON.parse noch jsonrepair kommen weiter.
    const broken = tryParseAndValidate("", schema);
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.kind).toBe("syntax");

    const wrongType = tryParseAndValidate('{"a": 42}', schema);
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) expect(wrongType.kind).toBe("schema");
  });

  it("liefert bei Schema-Fehlern Pfad und tatsächlichen Wert", () => {
    const schema = z.object({ hinweise: z.array(z.string()) });
    const result = tryParseAndValidate('{"hinweise": ["a", 7]}', schema);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues?.[0].path).toBe("hinweise.1");
    expect(result.issues?.[0].received).toBe("7");
  });

  it("toleriert Markdown-Fences", () => {
    const schema = z.object({ a: z.string() });
    const result = tryParseAndValidate('```json\n{"a": "x"}\n```', schema);
    expect(result.ok).toBe(true);
  });
});

describe("buildRepairInstruction", () => {
  it("nennt bei Schema-Fehlern die konkreten Felder und verbietet Neu-Analyse", () => {
    const msg = buildRepairInstruction({
      ok: false,
      kind: "schema",
      error: "geg_hinweise.7: expected string, received number",
      issues: [
        {
          path: "geg_hinweise.7",
          message: "Invalid input: expected string, received number",
          received: "2045",
        },
      ],
    });
    expect(msg).toContain("geg_hinweise.7");
    expect(msg).toContain("2045");
    expect(msg).toContain("Analysiere das Dokument nicht neu");
    // Der Escaping-Vortrag gehört hier NICHT hin — das war der Bug.
    expect(msg).not.toContain("unescapte");
  });

  it("erklärt bei Syntax-Fehlern weiterhin das Quote-Escaping", () => {
    const msg = buildRepairInstruction({
      ok: false,
      kind: "syntax",
      error: "JSON.parse: Unexpected token",
    });
    expect(msg).toContain("unescapte");
  });
});
