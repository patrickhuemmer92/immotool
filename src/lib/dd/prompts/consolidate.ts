/**
 * Konsolidierungs-Prompt: arbeitet auf strukturierten Extraktions-
 * Ergebnissen (nicht auf Rohtext) und erzeugt eine kohärente Liste
 * von Findings + Fragen + Verhandlungsargumenten.
 *
 * Design-Entscheidung: das LLM produziert NUR die Findings. Der
 * Gesamt-Score kommt aus einer deterministischen Regel-Engine
 * (src/lib/dd/scoring.ts), damit dieselbe Datenlage denselben Score
 * ergibt.
 */

export const CONSOLIDATION_SYSTEM_PROMPT = `Du bist Immobilien-Berater für einen Privatkäufer. Aufgabe: aus strukturierten Extraktions-Ergebnissen belegte Findings, priorisierte Fragen und preisrelevante Verhandlungsargumente ableiten.

HARTE REGELN:
1. Jede Finding braucht einen Beleg. Wenn die Extraktion keinen Beleg bietet: keine Finding.
2. Zitate: übernimm sie WÖRTLICH aus den Extraktions-Ergebnissen — erfinde keine.
3. Kostenschätzungen NUR als grobe Orientierung ("Dach ~30-60k€") und nur wenn ein Beleg das nahelegt. Sonst null.
4. Confidence realistisch:
   - 0.9+ nur bei glasklarem Zitat + belegter Zahl.
   - 0.5-0.7 bei "diskutiert" oder "erwähnt".
   - < 0.4 bei Ableitungen ohne direkten Beleg.
5. Bei Widersprüchen zwischen Dokumenten: das aktuellere Dokument wiegt schwerer, aber beide Perspektiven in der Beschreibung erwähnen.
6. Sprache: laienverständlich, ohne Fachjargon.
7. Kein juristischer oder finanzieller Rat — nur Hinweise.
8. Antwort AUSSCHLIESSLICH JSON.

KATEGORIEN:
- substanz: Bausubstanz, Sanierungsbedarf, konkrete Baumängel
- finanzierung: Hausgeld-Höhe, Sonderumlagerisiko, Rücklage-Unterdeckung, Nebenkosten
- recht: Vertrag, Sondereigentum, Sondernutzung, Nutzungsbeschränkungen
- weg: WEG-spezifisch — Verwalterwechsel, Streit, Beschluss-Klima
- energie: GEG/EnEV, Sanierungspflicht, Heizungstausch-Risiko
- markt: Preis-Einordnung (ergänzt durch Marktdaten, falls vorhanden)
- lage: Anbindung, Lärm, Umgebung

SCHWEREGRAD — bemisst sich am Betrag, der DEN KAEUFER TRIFFT, nicht am
Gesamtbetrag der Gemeinschaft. Eine Sonderumlage von 21.000 EUR, von der
bei 42/1000 MEA rund 882 EUR auf die Einheit entfallen, ist ein
DREISTELLIGER Impakt und damit "low" — nicht "high".
- high: 5-stelliger Kostenimpakt ODER unmittelbares Rechts-/Bau-Risiko
- medium: 4-stelliger Kostenimpakt ODER offene Fragen mit Kostenpotential
- low: kleinere Hinweise
- positive: Pluspunkt (z.B. hohe Rücklage, frisch sanierte Heizung, gute Effizienzklasse)

STATUS je Finding:
- offen: nichts entkraeftet es (Standard).
- zu_belegen: es gibt eine Aussage, dass die Sache erledigt sei, aber
  keinen Nachweis — etwa eine muendliche Bestaetigung aus einer
  Gespraechsnotiz. Nenne im naechsten Schritt, WELCHER Beleg fehlt.
- erledigt: aus den Unterlagen belegt erledigt (Rechnung,
  Zahlungsbestaetigung, Beschluss ueber Abschluss der Massnahme).
  Kosten dann auf null setzen — sie treffen den Kaeufer nicht mehr.
Eine Aussage des Verkaeufers oder Maklers allein ist NIE "erledigt".

VERHANDLUNGSARGUMENTE: konkret + rechenbar. Beispiel: "Rücklage 12k€ unter Empfehlung → Preisabschlag 12k€ begründbar".`;

export function buildConsolidationUserMessage(input: {
  extractedExpose: unknown;
  extractedWeg: unknown[];       // ggf. mehrere Protokolle
  extractedWirtschaftsplan: unknown | null;
  /** Urschrift + Nachtraege, aeltestes zuerst. */
  extractedTeilung: unknown[];
  extractedEnergie: unknown | null;
  marketSnapshot?: unknown | null;
  propertyTypeGuidance?: string | null;
  /** Vorformatierte Notizliste (s. lib/dd/notes.ts) oder null. */
  notesBlock?: string | null;
}): string {
  return `${
    input.propertyTypeGuidance
      ? `${input.propertyTypeGuidance}\n\n`
      : ""
  }${
    input.notesBlock
      ? `GESPRÄCHSNOTIZEN DES KÄUFERS (chronologisch, älteste zuerst). ` +
        `Diese Angaben stammen NICHT aus den Dokumenten — behandle sie als ` +
        `Aussagen der jeweiligen Quelle, nicht als belegte Fakten. Wenn eine ` +
        `spätere Notiz einer früheren oder einem Dokument widerspricht, ` +
        `gilt die spätere Aussage als aktueller Stand und der Widerspruch ` +
        `gehört als Finding benannt:\n${input.notesBlock}\n\n`
      : ""
  }EXTRAHIERTE DATEN:

## Exposé
${JSON.stringify(input.extractedExpose ?? null, null, 2)}

## WEG-Protokolle (${input.extractedWeg.length} Stück)
${JSON.stringify(input.extractedWeg ?? [], null, 2)}

## Wirtschaftsplan
${JSON.stringify(input.extractedWirtschaftsplan ?? null, null, 2)}

## Teilungserklärung — Urschrift + Nachträge (${input.extractedTeilung.length} Dokument(e), älteste zuerst)
Spätere Nachträge ändern die Urschrift. Wenn sich Angaben unterscheiden,
gilt der jüngste Stand; die Änderung selbst ist erwähnenswert.
${JSON.stringify(input.extractedTeilung ?? [], null, 2)}

## Energieausweis
${JSON.stringify(input.extractedEnergie ?? null, null, 2)}

## Marktdaten (falls vorhanden)
${JSON.stringify(input.marketSnapshot ?? null, null, 2)}

AUFGABE: Erzeuge das folgende JSON. Referenziere in "related_finding_titles" IMMER exakt die Titel der Findings, die du oben erzeugt hast — damit die Fragen und Argumente eindeutig zugeordnet werden können.

{
  "findings": [
    {
      "category": "substanz|finanzierung|recht|weg|energie|markt|lage",
      "severity": "high|medium|low|positive",
      "title": "kurzer, prägnanter Titel",
      "description": "2-4 Sätze, laienverständlich",
      "cost_min_eur": "number|null",
      "cost_max_eur": "number|null",
      "cost_horizon": "short|medium|long|null",
      "source_kind": "expose|weg_minutes|wirtschaftsplan|teilungserklaerung|energieausweis|grundriss|market|computed",
      "source_quote": "string|null (wörtliches Zitat aus dem Dokument)",
      "source_location": "string|null (z.B. 'TOP 4', '§ 5 Abs. 2')",
      "confidence": "number 0..1",
      "confidence_reason": "1 Satz warum diese Confidence",
      "next_step": "was der Käufer prüfen sollte"
    }
  ],
  "questions": [
    {
      "question": "string",
      "addressed_to": "makler|verwalter|verkaeufer|bank|andere",
      "priority": "high|medium|low",
      "related_finding_titles": ["exakter Finding-Titel", ...]
    }
  ],
  "negotiation_arguments": [
    {
      "argument": "string (mit konkreter Zahl und Begründung)",
      "preisabschlag_eur_min": "number|null",
      "preisabschlag_eur_max": "number|null",
      "related_finding_titles": ["..."]
    }
  ]
}`;
}
