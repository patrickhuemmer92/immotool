import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildToolInputSchema, truncationError } from "@/lib/dd/llm";
import { exposeExtractionSchema } from "@/lib/dd/schemas/expose";
import {
  energieExtractionSchema,
  teilungExtractionSchema,
} from "@/lib/dd/schemas/teilung-und-energie";
import { consolidationResultSchema } from "@/lib/dd/schemas/findings";
import { mietvertragSchema } from "@/lib/dd/schemas/onboarding";

/**
 * Diese Tests sichern die Zod→JSON-Schema-Konvertierung ab. Sie ist
 * still ausgefallen: `zod-to-json-schema` (für Zod 3 gebaut) gab unter
 * Zod 4 für jedes Schema `{}` zurück, das Tool ging ohne Feldvorgaben
 * raus und das Modell hat die Struktur geraten. Nichts hat gemeckert —
 * bis die Zod-Validierung der Antwort scheiterte.
 */
const SCHEMAS: [string, z.ZodType][] = [
  ["expose", exposeExtractionSchema],
  ["teilung", teilungExtractionSchema],
  ["energie", energieExtractionSchema],
  ["consolidation", consolidationResultSchema],
  ["mietvertrag", mietvertragSchema],
];

describe("buildToolInputSchema", () => {
  it.each(SCHEMAS)("%s: liefert ein Objekt-Schema mit Feldern", (_name, schema) => {
    const js = buildToolInputSchema(schema) as unknown as {
      type: string;
      properties?: Record<string, unknown>;
      $schema?: unknown;
    };
    expect(js.type).toBe("object");
    expect(Object.keys(js.properties ?? {}).length).toBeGreaterThan(0);
    // $schema ist Validator-Metadatum und hat im Tool nichts verloren.
    expect(js.$schema).toBeUndefined();
  });

  it("bildet die Felder tatsächlich ab, nicht nur irgendein Objekt", () => {
    const js = buildToolInputSchema(energieExtractionSchema) as unknown as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(js.properties)).toEqual(
      expect.arrayContaining([
        "ausweis_typ",
        "effizienzklasse",
        "geg_hinweise",
        "summary",
      ])
    );
  });

  it("wirft bei leerem Ergebnis, statt ein nutzloses Tool zu schicken", () => {
    // z.record hat keine benannten Properties — steht hier für jedes
    // Schema, aus dem sich keine Feldvorgaben ableiten lassen.
    expect(() => buildToolInputSchema(z.record(z.string(), z.unknown()))).toThrow(
      /Tool-Input-Schema ist leer/
    );
  });
});

describe("truncationError", () => {
  it("erkennt das Token-Limit und nennt Limit und Zweck", () => {
    const msg = truncationError("max_tokens", 8192, "consolidate_findings");
    expect(msg).toContain("8192");
    expect(msg).toContain("consolidate_findings");
    expect(msg).toContain("abgeschnitten");
  });

  it("schweigt bei regulaeren Stop-Gruenden", () => {
    expect(truncationError("tool_use", 8192, "x")).toBeNull();
    expect(truncationError("end_turn", 8192, "x")).toBeNull();
    expect(truncationError(null, 8192, "x")).toBeNull();
    expect(truncationError(undefined, 8192, "x")).toBeNull();
  });
});
