import { z } from "zod";
import { looseStringArray } from "./primitives";

// ------------------------------------------------------------------
// Teilungserklärung / Gemeinschaftsordnung
// ------------------------------------------------------------------
export const teilungExtractionSchema = z.object({
  // Meta
  datum_urkunde: z.string().nullable(),

  // Sondereigentum + Sondernutzungsrechte
  sondereigentum_einheit: looseStringArray(),           // z.B. ["Wohnung Nr. 7", "Keller Nr. 7"]
  sondernutzungsrechte: z.array(
    z.object({
      thema: z.string(),                                 // "PKW-Stellplatz", "Gartenanteil"
      begrenzung: z.string().nullable(),
      zitat: z.string(),
    })
  ),

  // Miteigentumsanteile
  mea_this_unit: z.number().nullable(),                  // Anteile in ‰

  // Nutzungs-Beschränkungen
  nutzungs_beschraenkungen: z.array(
    z.object({
      thema: z.string(),                                 // "Kurzzeitvermietung untersagt"
      zitat: z.string(),
    })
  ),

  // Stimmrecht
  stimmrecht_mode: z.enum(["kopf", "objekt", "anteil", "unklar"]),

  // Bauliche Besonderheiten
  bauliche_besonderheiten: looseStringArray(),

  summary: z.string(),
});
export type TeilungExtraction = z.infer<typeof teilungExtractionSchema>;

// ------------------------------------------------------------------
// Energieausweis
// ------------------------------------------------------------------
export const energieExtractionSchema = z.object({
  ausweis_typ: z.enum(["bedarf", "verbrauch", "unklar"]),
  gueltig_bis: z.string().nullable(),
  ausstellungsdatum: z.string().nullable(),

  endenergie_kwh_per_sqm_a: z.number().nullable(),
  primaerenergie_kwh_per_sqm_a: z.number().nullable(),
  effizienzklasse: z.enum([
    "A_PLUS", "A", "B", "C", "D", "E", "F", "G", "H", "UNKNOWN",
  ]),
  co2_kg_per_sqm_a: z.number().nullable(),

  heizung: z.string().nullable(),
  heizung_baujahr: z.number().nullable(),

  // GEG-relevante Warnungen
  geg_hinweise: looseStringArray(),

  summary: z.string(),
});
export type EnergieExtraction = z.infer<typeof energieExtractionSchema>;
