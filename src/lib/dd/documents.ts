/**
 * Auswahl der extrahierten Dokumente für die Konsolidierung.
 *
 * Bisher lag diese Logik doppelt in den beiden Routen (Analyse und
 * externes Dossier) und war an zwei Stellen falsch:
 *
 *   - `.find()` ohne Sortierung nahm bei Wirtschaftsplan, Teilungs-
 *     erklärung und Energieausweis „irgendeines" der vorhandenen
 *     Dokumente. Wer einen aktuelleren Wirtschaftsplan nachlud, konnte
 *     weiterhin die alte Fassung ausgewertet bekommen, ohne dass das
 *     irgendwo auffiel.
 *   - Die Teilungserklärung wurde als Einzeldokument behandelt. Sie
 *     besteht in der Praxis aus Urschrift plus Nachträgen, die sie
 *     ändern — nur die Urschrift zu lesen führt zu falschen Aussagen
 *     über Sondernutzungsrechte oder Stimmrecht.
 *
 * Regel: was in Fassungen existiert (Wirtschaftsplan, Energieausweis),
 * geht in der NEUESTEN Fassung ein. Was sich fortschreibt (WEG-
 * Protokolle, Teilungserklärung + Nachträge), geht VOLLSTÄNDIG und
 * chronologisch ein — sonst kann das Modell eine spätere Änderung nicht
 * als solche erkennen.
 */

export type ExtractedDoc = {
  kind: string;
  ocr_status: string;
  extraction: unknown;
  uploaded_at?: string | null;
};

export type ConsolidationDocs = {
  /** Alle WEG-Protokolle, ältestes zuerst. */
  weg: unknown[];
  /** Neuester Wirtschaftsplan oder null. */
  wirtschaftsplan: unknown | null;
  /** Urschrift + Nachträge, ältestes zuerst. */
  teilung: unknown[];
  /** Neuester Energieausweis oder null. */
  energie: unknown | null;
};

/** Datumsfeld aus der jeweiligen Extraktion, wenn vorhanden. */
function extractionDate(extraction: unknown, field: string): string | null {
  if (!extraction || typeof extraction !== "object") return null;
  const v = (extraction as Record<string, unknown>)[field];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * Sortierschlüssel: fachliches Datum aus der Extraktion, sonst der
 * Upload-Zeitpunkt. Das fachliche Datum ist das richtige Kriterium —
 * ein Nachtrag von 1998 kann Jahre nach der Urschrift hochgeladen
 * worden sein, gehört in der Kette aber an seine Stelle.
 */
function sortKey(doc: ExtractedDoc, dateField: string | null): string {
  const fromExtraction = dateField
    ? extractionDate(doc.extraction, dateField)
    : null;
  return fromExtraction ?? doc.uploaded_at ?? "";
}

function chronological(
  docs: readonly ExtractedDoc[],
  kind: string,
  dateField: string | null
): ExtractedDoc[] {
  return docs
    .filter((d) => d.kind === kind && d.ocr_status === "extracted")
    .sort((a, b) => sortKey(a, dateField).localeCompare(sortKey(b, dateField)));
}

/** Neuestes Dokument eines Typs — oder null, wenn keines da ist. */
function newest(
  docs: readonly ExtractedDoc[],
  kind: string,
  dateField: string | null
): unknown | null {
  const list = chronological(docs, kind, dateField);
  return list.length > 0 ? list[list.length - 1].extraction : null;
}

export function selectConsolidationDocs(
  docs: readonly ExtractedDoc[]
): ConsolidationDocs {
  return {
    weg: chronological(docs, "weg_minutes", "meeting_date").map(
      (d) => d.extraction
    ),
    wirtschaftsplan: newest(docs, "wirtschaftsplan", null),
    teilung: chronological(docs, "teilungserklaerung", "datum_urkunde").map(
      (d) => d.extraction
    ),
    energie: newest(docs, "energieausweis", "ausstellungsdatum"),
  };
}
