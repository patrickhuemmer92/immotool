import { z } from "zod";

/**
 * Zod-Schema für das strukturierte Extraktions-Ergebnis eines Exposés.
 *
 * Wichtige Konventionen (die dem LLM per Prompt beigebracht werden):
 *   - Alle Felder OPTIONAL: das LLM muss `null` liefern, wenn ein Wert
 *     nicht im Exposé steht — nicht raten.
 *   - Zahlen werden als Zahl ausgegeben, nicht als String mit „€"/"m²".
 *   - Datum: falls Baujahr nur Jahr, als Nummer (1978).
 *   - `agent_speak_flags`: erkannte Marketing-Formulierungen mit
 *     Klartext-Übersetzung ("Handwerkerobjekt" → "sanierungsbedürftig"),
 *     damit Laien wissen, was tatsächlich gemeint ist.
 */

export const exposeKindEnum = z.enum([
  "apartment",   // Eigentumswohnung
  "house",       // Einfamilienhaus
  "row_house",   // Reihenhaus
  "commercial",  // Gewerbe
  "parking",     // Stellplatz/Garage
  "other",
]);

export const heatingKindEnum = z.enum([
  "gas",
  "oil",
  "heat_pump",
  "district_heating",   // Fernwärme
  "wood_pellets",
  "electric",
  "solar_thermal_combo",
  "other",
  "unknown",
]);

export const energyClassEnum = z.enum([
  "A_PLUS", "A", "B", "C", "D", "E", "F", "G", "H", "UNKNOWN",
]);

export const agentSpeakFlagSchema = z.object({
  quote: z.string(),                    // wörtliches Zitat aus dem Exposé
  translation: z.string(),              // Klartext-Übersetzung
  concern_level: z.enum(["low", "medium", "high"]),
});

export const exposeExtractionSchema = z.object({
  // Identifikation
  kind: exposeKindEnum.nullable(),
  street: z.string().nullable(),
  postal_code: z.string().nullable(),
  city: z.string().nullable(),
  federal_state: z.string().nullable(),    // z.B. "Bayern", "NRW"

  // Wirtschaftliche Kernfelder (in EUR bzw. m², keine Einheiten in String)
  purchase_price_eur: z.number().nullable(),
  living_area_sqm: z.number().nullable(),
  plot_area_sqm: z.number().nullable(),
  rooms: z.number().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  floor: z.number().nullable(),            // 0 = EG, -1 = KG, etc.
  build_year: z.number().nullable(),

  // Energie
  energy_class: energyClassEnum,
  energy_kwh_per_sqm_a: z.number().nullable(),
  energy_certificate_type: z.enum(["demand", "consumption", "unknown"]),
  heating_kind: heatingKindEnum,
  heating_year: z.number().nullable(),
  primary_energy_source: z.string().nullable(),

  // Vertragsstruktur / Bezugsfrei
  is_vacant: z.boolean().nullable(),
  is_rented: z.boolean().nullable(),
  current_cold_rent_per_month_eur: z.number().nullable(),

  // Nebenkosten des Erwerbs (falls im Exposé beziffert)
  broker_commission_pct: z.number().nullable(),
  broker_commission_eur: z.number().nullable(),
  hoa_fee_per_month_eur: z.number().nullable(),          // Hausgeld
  reserve_share_per_month_eur: z.number().nullable(),    // enthaltener Instandhaltungsanteil

  // Ausstattung / Modernisierung
  features: z.array(z.string()),                          // ["Balkon", "Aufzug", ...]
  modernizations: z.array(
    z.object({
      what: z.string(),
      year: z.number().nullable(),
    })
  ),
  is_heritage_protected: z.boolean().nullable(),          // Denkmalschutz

  // Fehlende Pflichtangaben (KI-Selbst-Check)
  missing_mandatory: z.array(z.string()),                 // z.B. ["energy_class", "build_year"]

  // Makler-Sprech mit Übersetzung
  agent_speak_flags: z.array(agentSpeakFlagSchema),

  // Freitext-Kurzbeschreibung (KI-generiert für UI-Overview, max 300 Zeichen)
  short_summary: z.string(),
});

export type ExposeExtraction = z.infer<typeof exposeExtractionSchema>;
