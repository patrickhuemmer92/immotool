import { describe, expect, it } from "vitest";
import {
  selectConsolidationDocs,
  type ExtractedDoc,
} from "@/lib/dd/documents";

function doc(p: Partial<ExtractedDoc> & { kind: string }): ExtractedDoc {
  return {
    kind: p.kind,
    ocr_status: p.ocr_status ?? "extracted",
    extraction: p.extraction ?? {},
    uploaded_at: p.uploaded_at ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("selectConsolidationDocs", () => {
  it("nimmt den NEUESTEN Wirtschaftsplan, nicht irgendeinen", () => {
    const sel = selectConsolidationDocs([
      doc({
        kind: "wirtschaftsplan",
        uploaded_at: "2026-01-10T00:00:00.000Z",
        extraction: { jahr: 2025 },
      }),
      doc({
        kind: "wirtschaftsplan",
        uploaded_at: "2026-05-02T00:00:00.000Z",
        extraction: { jahr: 2026 },
      }),
    ]);
    expect(sel.wirtschaftsplan).toEqual({ jahr: 2026 });
  });

  it("gibt Teilungserklärung samt Nachträgen vollständig weiter", () => {
    const sel = selectConsolidationDocs([
      doc({ kind: "teilungserklaerung", extraction: { datum_urkunde: "1998-03-04", n: "Nachtrag" } }),
      doc({ kind: "teilungserklaerung", extraction: { datum_urkunde: "1972-11-20", n: "Urschrift" } }),
    ]);
    expect(sel.teilung).toHaveLength(2);
    // Chronologisch nach Urkundendatum — die Urschrift zuerst, damit das
    // Modell den Nachtrag als Änderung lesen kann.
    expect(sel.teilung.map((t) => (t as { n: string }).n)).toEqual([
      "Urschrift",
      "Nachtrag",
    ]);
  });

  it("sortiert nach Urkundendatum, nicht nach Upload-Zeitpunkt", () => {
    const sel = selectConsolidationDocs([
      // Der Nachtrag wurde ZUERST hochgeladen, ist fachlich aber jünger.
      doc({
        kind: "teilungserklaerung",
        uploaded_at: "2026-01-01T00:00:00.000Z",
        extraction: { datum_urkunde: "2004-06-01", n: "Nachtrag" },
      }),
      doc({
        kind: "teilungserklaerung",
        uploaded_at: "2026-02-01T00:00:00.000Z",
        extraction: { datum_urkunde: "1972-11-20", n: "Urschrift" },
      }),
    ]);
    expect(sel.teilung.map((t) => (t as { n: string }).n)).toEqual([
      "Urschrift",
      "Nachtrag",
    ]);
  });

  it("faellt auf den Upload-Zeitpunkt zurueck, wenn kein Datum extrahiert wurde", () => {
    const sel = selectConsolidationDocs([
      doc({
        kind: "teilungserklaerung",
        uploaded_at: "2026-03-01T00:00:00.000Z",
        extraction: { datum_urkunde: null, n: "B" },
      }),
      doc({
        kind: "teilungserklaerung",
        uploaded_at: "2026-01-01T00:00:00.000Z",
        extraction: { datum_urkunde: null, n: "A" },
      }),
    ]);
    expect(sel.teilung.map((t) => (t as { n: string }).n)).toEqual(["A", "B"]);
  });

  it("nimmt den neuesten Energieausweis nach Ausstellungsdatum", () => {
    const sel = selectConsolidationDocs([
      doc({ kind: "energieausweis", extraction: { ausstellungsdatum: "2016-04-01", v: "alt" } }),
      doc({ kind: "energieausweis", extraction: { ausstellungsdatum: "2025-09-12", v: "neu" } }),
    ]);
    expect((sel.energie as { v: string }).v).toBe("neu");
  });

  it("ignoriert Dokumente, deren Extraktion nicht durchgelaufen ist", () => {
    const sel = selectConsolidationDocs([
      doc({ kind: "wirtschaftsplan", ocr_status: "pending", extraction: null }),
      doc({ kind: "weg_minutes", ocr_status: "failed", extraction: null }),
    ]);
    expect(sel.wirtschaftsplan).toBeNull();
    expect(sel.weg).toEqual([]);
  });

  it("ordnet WEG-Protokolle nach Sitzungsdatum", () => {
    const sel = selectConsolidationDocs([
      doc({ kind: "weg_minutes", extraction: { meeting_date: "2025-06-10", j: 2025 } }),
      doc({ kind: "weg_minutes", extraction: { meeting_date: "2023-05-02", j: 2023 } }),
      doc({ kind: "weg_minutes", extraction: { meeting_date: "2024-04-18", j: 2024 } }),
    ]);
    expect(sel.weg.map((w) => (w as { j: number }).j)).toEqual([2023, 2024, 2025]);
  });

  it("kommt mit einem leeren Projekt klar", () => {
    const sel = selectConsolidationDocs([]);
    expect(sel).toEqual({
      weg: [],
      wirtschaftsplan: null,
      teilung: [],
      energie: null,
    });
  });
});
