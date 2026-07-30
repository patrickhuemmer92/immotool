/**
 * Objektart-Definition für DD- und Onboarding-Projekte.
 *
 * Zentrale Wahrheit für:
 *   - Zod-Enum der Server-Actions
 *   - UI-Selector-Optionen
 *   - Prompt-Dispatch (welcher System-Prompt wird injected)
 *   - Doku-Checkliste (welche Dokumente werden empfohlen)
 *
 * Die Migration 0030 setzt denselben CHECK-Constraint auf der DB —
 * neue Werte müssen an BEIDEN Stellen hinzugefügt werden.
 */

export const PROPERTY_TYPES = [
  "etw_weg",
  "mfh",
  "efh",
  "gewerbe",
  "mixed",
  "other",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export function isPropertyType(v: unknown): v is PropertyType {
  return typeof v === "string" && (PROPERTY_TYPES as readonly string[]).includes(v);
}

/**
 * Welche Dokumententypen sind für welche Objektart sinnvoll?
 *
 * "empfohlen": User sollte sie hochladen — bringt hohen Erkenntniswert.
 * "optional": Kann hilfreich sein, aber nicht essenziell.
 * "irrelevant": Existiert für diese Objektart nicht — nicht anfragen.
 *
 * "expose" ist immer Pflicht (Basis).
 */
export type DocumentRelevance = "required" | "recommended" | "optional" | "irrelevant";

export type DocumentKind =
  | "expose"
  | "weg_minutes"
  | "wirtschaftsplan"
  | "teilungserklaerung"
  | "energieausweis"
  | "grundriss"
  | "grundbuchauszug"
  | "mieterliste"
  | "other";

/**
 * Doku-Checkliste pro Objektart. "expose" ist immer required.
 * Bei MFH: keine WEG-Dokumente (kein Teileigentum) — dafür Mieterliste
 * und Grundbuch. Bei Gewerbe zusätzlich der Gewerbe-Mietvertrag als
 * "other" gepflegt (kein eigener Typ in v1).
 */
export const DOC_RELEVANCE: Record<
  PropertyType,
  Record<DocumentKind, DocumentRelevance>
> = {
  etw_weg: {
    expose: "required",
    weg_minutes: "recommended",
    wirtschaftsplan: "recommended",
    teilungserklaerung: "recommended",
    energieausweis: "recommended",
    grundriss: "optional",
    grundbuchauszug: "optional",
    mieterliste: "irrelevant",
    other: "optional",
  },
  mfh: {
    expose: "required",
    weg_minutes: "irrelevant",
    wirtschaftsplan: "irrelevant",
    teilungserklaerung: "irrelevant",
    energieausweis: "recommended",
    grundriss: "optional",
    grundbuchauszug: "recommended",
    mieterliste: "recommended",
    other: "optional",
  },
  efh: {
    expose: "required",
    weg_minutes: "irrelevant",
    wirtschaftsplan: "irrelevant",
    teilungserklaerung: "irrelevant",
    energieausweis: "recommended",
    grundriss: "recommended",
    grundbuchauszug: "optional",
    mieterliste: "irrelevant",
    other: "optional",
  },
  gewerbe: {
    expose: "required",
    weg_minutes: "irrelevant",
    wirtschaftsplan: "irrelevant",
    teilungserklaerung: "irrelevant",
    energieausweis: "optional",
    grundriss: "recommended",
    grundbuchauszug: "recommended",
    mieterliste: "recommended",
    other: "optional",
  },
  mixed: {
    expose: "required",
    weg_minutes: "optional",
    wirtschaftsplan: "optional",
    teilungserklaerung: "optional",
    energieausweis: "recommended",
    grundriss: "recommended",
    grundbuchauszug: "recommended",
    mieterliste: "recommended",
    other: "optional",
  },
  other: {
    expose: "required",
    weg_minutes: "optional",
    wirtschaftsplan: "optional",
    teilungserklaerung: "optional",
    energieausweis: "optional",
    grundriss: "optional",
    grundbuchauszug: "optional",
    mieterliste: "optional",
    other: "optional",
  },
};

/**
 * Kurzer Prompt-Zusatz für die Konsolidierung — sagt der KI, welche
 * Fragen sie NICHT stellen soll (weil sie für den Typ irrelevant sind)
 * und welche Aspekte im Fokus stehen.
 */
export function propertyTypeGuidance(t: PropertyType): string {
  switch (t) {
    case "mfh":
      return `OBJEKTART: Mehrfamilienhaus (MFH / Zinshaus, ganzes Objekt, KEIN WEG-Teileigentum).
FOKUS: Mieterstruktur, IST-Mieten vs. Marktmiete (Mieterhöhungspotenzial), Leerstandsrisiko, Grundbuch, Zustand des Gesamtobjekts, Instandhaltungsstau, Gewerbeanteil falls vorhanden, Denkmalschutz.
IGNORIERE (nicht anfragen, nicht als offene Frage listen): Teilungserklärung, WEG-Protokolle, Wirtschaftsplan, Hausgeld, Sonderumlagen, Instandhaltungsrücklage der WEG, Mit-Eigentumsanteile, Beschluss-Klima der Eigentümerversammlung.
NEGOTIATION-HEBEL beim MFH: Instandhaltungsstau, unter Marktmiete vermietet, Sanierungspflichten aus GEG.`;
    case "efh":
      return `OBJEKTART: Einfamilienhaus / Doppelhaushälfte / Reihenhaus (KEIN WEG-Teileigentum).
FOKUS: Bausubstanz, Sanierungsbedarf, Grundstück (Größe, Zuschnitt, Erschließung), Baulasten, Denkmalschutz, Energieklasse und GEG-Sanierungspflichten, ggf. Anbau-/Umbaupotenzial.
IGNORIERE: Teilungserklärung, WEG-Protokolle, Wirtschaftsplan, Hausgeld, Mit-Eigentumsanteile, Sondernutzungsrechte, Mieterstruktur (falls selbstgenutzt).
NEGOTIATION-HEBEL beim EFH: Renovierungsbedarf, GEG-Nachrüstpflichten, Grundstückszuschnitt.`;
    case "gewerbe":
      return `OBJEKTART: Gewerbeobjekt.
FOKUS: Nutzungsart-Beschränkungen, Baugenehmigung / Nutzungsgenehmigung, Mieterbonität, Mietvertragslaufzeit, Anschlussvermietungsrisiko, Bodenkontamination / Altlasten, technische Ausstattung.
IGNORIERE: WEG-Themen (falls nicht Teileigentum), Wohnnutzungs-Fragen.
NEGOTIATION-HEBEL: Auslaufender Ankermieter, Altlasten, sanierungsbedürftige Haustechnik.`;
    case "mixed":
      return `OBJEKTART: Wohn-/Gewerbe-Misch (typisch: EG Laden + Wohnungen darüber).
FOKUS: Sowohl Wohnungs- als auch Gewerbemieter, Nutzungsart-Genehmigungen, gemischte Nebenkosten-Abrechnung, Energie- und Sanierungspflichten fürs Gesamtobjekt.
Nutze WEG-Themen NUR wenn die Extraktion klar zeigt dass Teileigentum vorliegt.`;
    case "other":
      return `OBJEKTART: Sonstiges. Halte dich strikt an belegte Findings, keine Standardfragen die auf ETW/MFH ausgelegt sind — es sei denn die Extraktion legt sie nahe.`;
    case "etw_weg":
    default:
      return `OBJEKTART: Eigentumswohnung in WEG-Struktur (klassische ETW mit Miteigentumsanteilen).
FOKUS: WEG-Protokoll-Signale (Streit, Verwalterwechsel, offene Beschlüsse), Wirtschaftsplan (Hausgeld, Rücklage-Deckung, Sonderumlagerisiko), Teilungserklärung (Sondernutzung, Nutzungsbeschränkungen), Bausubstanz Sondereigentum, GEG-Pflichten.`;
  }
}

/**
 * Kurzer Titel für die UI (i18n-Keys — kein Text hier).
 */
export const PROPERTY_TYPE_I18N_KEY: Record<PropertyType, string> = {
  etw_weg: "dd.ptype_etw_weg",
  mfh: "dd.ptype_mfh",
  efh: "dd.ptype_efh",
  gewerbe: "dd.ptype_gewerbe",
  mixed: "dd.ptype_mixed",
  other: "dd.ptype_other",
};

export const PROPERTY_TYPE_DESC_KEY: Record<PropertyType, string> = {
  etw_weg: "dd.ptype_etw_weg_desc",
  mfh: "dd.ptype_mfh_desc",
  efh: "dd.ptype_efh_desc",
  gewerbe: "dd.ptype_gewerbe_desc",
  mixed: "dd.ptype_mixed_desc",
  other: "dd.ptype_other_desc",
};
