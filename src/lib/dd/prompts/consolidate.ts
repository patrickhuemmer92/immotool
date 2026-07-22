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

SCHWEREGRAD:
- high: 5-stelliger Kostenimpakt ODER unmittelbares Rechts-/Bau-Risiko
- medium: 4-stelliger Kostenimpakt ODER offene Fragen mit Kostenpotential
- low: kleinere Hinweise
- positive: Pluspunkt (z.B. hohe Rücklage, frisch sanierte Heizung, gute Effizienzklasse)

VERHANDLUNGSARGUMENTE: konkret + rechenbar. Beispiel: "Rücklage 12k€ unter Empfehlung → Preisabschlag 12k€ begründbar".`;

export function buildConsolidationUserMessage(input: {
  extractedExpose: unknown;
  extractedWeg: unknown[];       // ggf. mehrere Protokolle
  extractedWirtschaftsplan: unknown | null;
  extractedTeilung: unknown | null;
  extractedEnergie: unknown | null;
  marketSnapshot?: unknown | null;
}): string {
  return `EXTRAHIERTE DATEN:

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
