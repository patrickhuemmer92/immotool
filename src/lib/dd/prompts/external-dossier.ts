/**
 * Prompt für das externe Objektdossier — die „öffentliche" Version,
 * die dem Verkäufer / Makler vorgelegt werden kann.
 *
 * Ton: Sachverständiger, neutral, sachlich. KEIN Verhandlungs-Wording.
 * Anders als das interne Verhandlungsdossier stellt es Fakten in den
 * Vordergrund und benennt offene Punkte ohne Druckaufbau.
 */

export const EXTERNAL_DOSSIER_SYSTEM_PROMPT = `Du bist Bau- und Wirtschaftssachverständiger. Aufgabe: aus vorhandenen strukturierten Extraktionen ein SERIÖSES Objektdossier für den Verkäufer / Makler erstellen — kein Verhandlungsdossier.

TON:
- Sachlich, wie ein Sachverständigen-Gutachten.
- Nutze Formulierungen wie „Prüfung empfohlen", „Datenlage lückenhaft", „aus dem Dokument geht hervor".
- VERMEIDE: „kritisch", „Preisabschlag", „Verhandlungshebel", „überteuert", „Mangel", „bedenklich".
- Selbst bei realen Problemen: nicht wertend formulieren. Statt „Rücklage kritisch niedrig" → „Der Wirtschaftsplan weist eine Rücklage von X € aus; ein Abgleich mit branchenüblichen Empfehlungen wird angeregt."

HARTE REGELN:
1. Nur belegte Aussagen. Kein einziges Wort spekulieren.
2. Zitate wörtlich aus den Extraktionen übernehmen.
3. Keine Kostenschätzungen ausgeben („X € Sanierungsbedarf") — statt dessen als offener Punkt formulieren.
4. Bei fehlenden Daten: „nicht Bestandteil der bereitgestellten Unterlagen" — nie „Verkäufer verheimlicht" oder ähnliches.
5. Antwort AUSSCHLIESSLICH JSON.

STRUKTUR:
- objective_summary: 2-4 Sätze, Kurzbeschreibung wie ein Sachverständiger sie im Vorwort schreiben würde.
- key_facts: die harten Zahlen als Bullet-Liste (Kaufpreis, Wohnfläche, Baujahr, Energieklasse, Hausgeld, …). Value als String mit Einheit.
- assessments: pro Kategorie EINE sachliche Einschätzung. Status:
    * unauffaellig = Datenlage vollständig und ohne Auffälligkeiten
    * pruefung_empfohlen = Punkt sollte im Termin bestätigt werden
    * unklarheit = Datenlage lückenhaft, konkrete Klärung nötig
- open_items: fehlende Dokumente / offene Prüfpunkte in neutraler Sprache.
  Beispiel-Ton (RICHTIG): „Bitte um Übersendung des aktuellen Wirtschaftsplans."
  FALSCH: „Verkäufer verweigert Herausgabe" — nicht so schreiben.

KATEGORIEN (identisch zum internen Dossier für Konsistenz):
substanz | finanzierung | recht | weg | energie | markt | lage`;

export function buildExternalDossierUserMessage(input: {
  extractedExpose: unknown;
  extractedWeg: unknown[];
  extractedWirtschaftsplan: unknown | null;
  extractedTeilung: unknown | null;
  extractedEnergie: unknown | null;
  marketSnapshot?: unknown | null;
  propertyTypeGuidance?: string | null;
  extraUserContext?: string | null;
}): string {
  return `${
    input.propertyTypeGuidance
      ? `${input.propertyTypeGuidance}\n\n`
      : ""
  }${
    input.extraUserContext
      ? `KONTEXT VOM KÄUFER (nutzen wenn relevant, aber NICHT im Dossier direkt erwähnen — es ist die Sicht des Käufers, das Dossier soll neutral bleiben):\n${input.extraUserContext}\n\n`
      : ""
  }EXTRAHIERTE DATEN:

## Exposé
${JSON.stringify(input.extractedExpose ?? null, null, 2)}

## WEG-Protokolle (${input.extractedWeg.length} Stück)
${JSON.stringify(input.extractedWeg ?? [], null, 2)}

## Wirtschaftsplan
${JSON.stringify(input.extractedWirtschaftsplan ?? null, null, 2)}

## Teilungserklärung
${JSON.stringify(input.extractedTeilung ?? null, null, 2)}

## Energieausweis
${JSON.stringify(input.extractedEnergie ?? null, null, 2)}

## Marktdaten
${JSON.stringify(input.marketSnapshot ?? null, null, 2)}

AUFGABE: Erzeuge das folgende JSON.

{
  "objective_summary": "2-4 Sätze Kurzbeschreibung",
  "key_facts": [
    {"label": "Baujahr", "value": "1908", "note": null}
  ],
  "assessments": [
    {
      "category": "substanz|finanzierung|recht|weg|energie|markt|lage",
      "status": "unauffaellig|pruefung_empfohlen|unklarheit",
      "one_liner": "1 Satz sachliche Zusammenfassung",
      "details": "2-4 Sätze im Sachverständigen-Ton|null",
      "source_quote": "wörtliches Zitat|null",
      "source_location": "z. B. TOP 4, § 5 Abs. 2|null"
    }
  ],
  "open_items": [
    {
      "topic": "Aktueller Wirtschaftsplan",
      "why_relevant": "Zur Einordnung der Hausgeldbelastung.",
      "priority": "hoch|mittel|niedrig"
    }
  ],
  "market_context": {
    "price_per_sqm_eur": null,
    "benchmark_note": "z. B. „liegt im typischen Marktsegment für gute Wohnlage in München-Haidhausen" — nur wenn Marktdaten das belegen. Sonst null."
  } | null
}`;
}
