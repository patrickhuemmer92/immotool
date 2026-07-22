/**
 * Prompt-Templates für die Dokumenten-Analyse (Phase 3).
 *
 * Gemeinsamer System-Header: Anti-Halluzination + Zitat-Pflicht +
 * JSON-only. Pro Doku-Typ wird der Header wiederverwendet, die
 * spezifischen Regeln kommen darüber.
 */

const COMMON_HEADER = `Du bist ein präziser Analyst für Immobilien-Unterlagen. Regeln:

1. Nur was WIRKLICH im Text steht. Bei Unklarheit: null.
2. Nie raten, nie schätzen wo keine Zahl steht.
3. Für jede Finding, die du berichtest, MUSS ein wörtliches Zitat aus dem Dokument mit. Kein Zitat = keine Finding.
4. TOP-Nummern, Datumsangaben und Beträge exakt aus dem Text übernehmen.
5. Antworte AUSSCHLIESSLICH mit gültigem JSON — kein Text davor oder danach.`;

// -------- WEG-Protokoll --------
export const WEG_SYSTEM_PROMPT = `${COMMON_HEADER}

DOMÄNE: Protokoll einer Eigentümerversammlung (WEG). Für den Käufer sind DREI Dinge kritisch:
- Sanierungen und Instandsetzungen (Dach, Heizung, Fassade, Aufzug, …) — beschlossen ODER diskutiert
- Sonderumlagen (Höhe, Zweck, Fälligkeit)
- Streit / Rechtsstreit / Verwalterwechsel

Bei "diskutiert, aber nicht beschlossen" → status = "diskutiert" (das ist ein Kostenrisiko, nicht -sicherheit).`;

export function buildWegUserMessage(text: string): string {
  return `PROTOKOLL-TEXT:
===
${text}
===

Extrahiere in dieses Format:
{
  "meeting_date": "YYYY-MM-DD|null",
  "meeting_kind": "ordentlich|ausserordentlich|unklar",
  "location": "string|null",
  "verwalter_name": "string|null",
  "anwesende_stimmen_pct": "number|null",
  "sanierungen": [
    {
      "thema": "dach|fassade|heizung|elektrik|wasserleitungen|aufzug|keller_bodenplatte|fenster_tueren|brandschutz|gemeinschafts_treppenhaus|aussenanlagen|sonstiges",
      "status": "beschlossen|diskutiert|abgelehnt|erwaehnt",
      "kostenschaetzung_eur": "number|null",
      "top_nummer": "string|null",
      "zitat": "string",
      "beschreibung": "string"
    }
  ],
  "sonderumlagen": [
    {"hoehe_eur": "number|null", "zweck": "string", "faelligkeit": "string|null", "status": "beschlossen|geplant|vorgeschlagen", "top_nummer": "string|null", "zitat": "string"}
  ],
  "streitigkeiten": [
    {"beschreibung": "string", "betroffene_parteien": "string|null", "rechtsstreit": "boolean", "top_nummer": "string|null", "zitat": "string"}
  ],
  "verwalter_wechsel": "boolean|null",
  "verwalter_wechsel_zitat": "string|null",
  "bau_maengel_hinweise": [{"thema": "string", "zitat": "string", "top_nummer": "string|null"}],
  "summary": "string (max 500 Zeichen)"
}`;
}

// -------- Wirtschaftsplan --------
export const WIRTSCHAFTSPLAN_SYSTEM_PROMPT = `${COMMON_HEADER}

DOMÄNE: Wirtschaftsplan oder Hausgeldabrechnung einer WEG. Kritische Zahlen:
- Hausgeld gesamt / umlagefähig / nicht umlagefähig (pro Monat)
- Zuführung zur Instandhaltungsrücklage (pro Monat oder Jahr)
- Aktueller Stand der Instandhaltungsrücklage (absolut UND — wenn möglich — pro Einheit gemäß MEA)
- Hinweise auf geplante Sonderumlagen im Fließtext

Sei präzise beim Unterscheiden zwischen "Plan" (Vorschau) und "Abrechnung" (rückblickend).`;

export function buildWirtschaftsplanUserMessage(text: string): string {
  return `PLAN-TEXT:
===
${text}
===

Extrahiere in dieses Format:
{
  "plan_year": "number|null",
  "is_actual": "boolean",
  "einheiten_gesamt": "number|null",
  "mea_of_this_unit": "number|null",
  "hausgeld_total_per_month_eur": "number|null",
  "hausgeld_umlagefaehig_per_month_eur": "number|null",
  "hausgeld_nicht_umlagefaehig_per_month_eur": "number|null",
  "ruecklage_zufuehrung_per_month_eur": "number|null",
  "ruecklage_zufuehrung_per_year_eur": "number|null",
  "ruecklage_stand_gesamt_eur": "number|null",
  "ruecklage_stand_pro_einheit_eur": "number|null",
  "ruecklage_stichtag": "YYYY-MM-DD|null",
  "ausgaben_positionen": [{"name": "string", "betrag_per_year_eur": "number|null"}],
  "geplante_sonderumlagen": [{"zweck": "string", "hoehe_eur": "number|null", "zitat": "string"}],
  "summary": "string (max 400 Zeichen)"
}`;
}

// -------- Teilungserklärung --------
export const TEILUNG_SYSTEM_PROMPT = `${COMMON_HEADER}

DOMÄNE: Teilungserklärung / Gemeinschaftsordnung. Fokus:
- Sondereigentum + Sondernutzungsrechte dieser Einheit
- Miteigentumsanteil (MEA) in Tausendstel
- Beschränkungen: Ferienvermietung, Kurzzeitvermietung, gewerbliche Nutzung
- Stimmrechtsverteilung (Kopf / Objekt / Anteil)`;

export function buildTeilungUserMessage(text: string): string {
  return `TEILUNGSERKLÄRUNG-TEXT:
===
${text}
===

Format:
{
  "datum_urkunde": "YYYY-MM-DD|null",
  "sondereigentum_einheit": ["string"],
  "sondernutzungsrechte": [{"thema": "string", "begrenzung": "string|null", "zitat": "string"}],
  "mea_this_unit": "number|null",
  "nutzungs_beschraenkungen": [{"thema": "string", "zitat": "string"}],
  "stimmrecht_mode": "kopf|objekt|anteil|unklar",
  "bauliche_besonderheiten": ["string"],
  "summary": "string (max 400 Zeichen)"
}`;
}

// -------- Energieausweis --------
export const ENERGIE_SYSTEM_PROMPT = `${COMMON_HEADER}

DOMÄNE: Energieausweis (GEG / EnEV). Kritisch für Kaufentscheidung: Endenergiebedarf und Effizienzklasse (Kaufpreisrelevant + spätere Sanierungspflicht). Klasse H-G bedeuten oft: Austauschpflicht Heizung, Dach-/Fassaden-Dämmung notwendig.`;

export function buildEnergieUserMessage(text: string): string {
  return `ENERGIEAUSWEIS-TEXT:
===
${text}
===

Format:
{
  "ausweis_typ": "bedarf|verbrauch|unklar",
  "gueltig_bis": "YYYY-MM-DD|null",
  "ausstellungsdatum": "YYYY-MM-DD|null",
  "endenergie_kwh_per_sqm_a": "number|null",
  "primaerenergie_kwh_per_sqm_a": "number|null",
  "effizienzklasse": "A_PLUS|A|B|C|D|E|F|G|H|UNKNOWN",
  "co2_kg_per_sqm_a": "number|null",
  "heizung": "string|null",
  "heizung_baujahr": "number|null",
  "geg_hinweise": ["string"],
  "summary": "string (max 300 Zeichen)"
}`;
}
