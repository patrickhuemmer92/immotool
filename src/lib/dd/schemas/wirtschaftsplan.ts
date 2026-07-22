import { z } from "zod";

/**
 * Wirtschaftsplan / Hausgeldabrechnung.
 * Kernfrage: reicht die Instandhaltungsrücklage für absehbare
 * Sanierungen, oder droht Sonderumlage?
 */

export const wirtschaftsplanExtractionSchema = z.object({
  // Meta
  plan_year: z.number().nullable(),
  is_actual: z.boolean(),                             // true = Abrechnung, false = Plan
  einheiten_gesamt: z.number().nullable(),            // Anzahl WEG-Einheiten
  mea_of_this_unit: z.number().nullable(),            // MEA dieser Einheit (Miteigentumsanteile ‰)

  // Hausgeld
  hausgeld_total_per_month_eur: z.number().nullable(),
  hausgeld_umlagefaehig_per_month_eur: z.number().nullable(),
  hausgeld_nicht_umlagefaehig_per_month_eur: z.number().nullable(),

  // Instandhaltungsrücklage
  ruecklage_zufuehrung_per_month_eur: z.number().nullable(),
  ruecklage_zufuehrung_per_year_eur: z.number().nullable(),
  ruecklage_stand_gesamt_eur: z.number().nullable(),       // ganze WEG
  ruecklage_stand_pro_einheit_eur: z.number().nullable(),  // für DIESE Einheit
  ruecklage_stichtag: z.string().nullable(),               // ISO

  // Konkrete Ausgaben-Positionen (nur die 5-10 größten)
  ausgaben_positionen: z.array(
    z.object({
      name: z.string(),
      betrag_per_year_eur: z.number().nullable(),
    })
  ),

  // Absehbare Sonderumlagen (aus Kommentaren im Plan)
  geplante_sonderumlagen: z.array(
    z.object({
      zweck: z.string(),
      hoehe_eur: z.number().nullable(),
      zitat: z.string(),
    })
  ),

  summary: z.string(),
});

export type WirtschaftsplanExtraction = z.infer<typeof wirtschaftsplanExtractionSchema>;
