import { z } from "zod";

/**
 * WEG-Protokoll (Eigentümerversammlung).
 * v1 fokussiert auf die kostenrelevanten Findings — nicht auf jeden TOP.
 */

const sanierungStatusEnum = z.enum([
  "beschlossen",
  "diskutiert",
  "abgelehnt",
  "erwaehnt",  // nur nebenbei erwähnt, kein Beschluss
]);

const sanierungThemaEnum = z.enum([
  "dach",
  "fassade",
  "heizung",
  "elektrik",
  "wasserleitungen",
  "aufzug",
  "keller_bodenplatte",
  "fenster_tueren",
  "brandschutz",
  "gemeinschafts_treppenhaus",
  "aussenanlagen",
  "sonstiges",
]);

export const wegExtractionSchema = z.object({
  // Meta
  meeting_date: z.string().nullable(),                // ISO YYYY-MM-DD
  meeting_kind: z.enum(["ordentlich", "ausserordentlich", "unklar"]),
  location: z.string().nullable(),
  verwalter_name: z.string().nullable(),
  anwesende_stimmen_pct: z.number().nullable(),       // % Anwesenheit

  // Sanierungs- und Instandsetzungs-Themen (das ist der Hebel)
  sanierungen: z.array(
    z.object({
      thema: sanierungThemaEnum,
      status: sanierungStatusEnum,
      kostenschaetzung_eur: z.number().nullable(),
      top_nummer: z.string().nullable(),              // "TOP 4"
      zitat: z.string(),                              // wörtliches Zitat
      beschreibung: z.string(),
    })
  ),

  // Sonderumlagen
  sonderumlagen: z.array(
    z.object({
      hoehe_eur: z.number().nullable(),
      zweck: z.string(),
      faelligkeit: z.string().nullable(),
      status: z.enum(["beschlossen", "geplant", "vorgeschlagen"]),
      top_nummer: z.string().nullable(),
      zitat: z.string(),
    })
  ),

  // Konfliktsignale
  streitigkeiten: z.array(
    z.object({
      beschreibung: z.string(),
      betroffene_parteien: z.string().nullable(),
      rechtsstreit: z.boolean(),
      top_nummer: z.string().nullable(),
      zitat: z.string(),
    })
  ),

  // Wechsel & sonstige Warnsignale
  verwalter_wechsel: z.boolean().nullable(),
  verwalter_wechsel_zitat: z.string().nullable(),

  bau_maengel_hinweise: z.array(
    z.object({
      thema: z.string(),
      zitat: z.string(),
      top_nummer: z.string().nullable(),
    })
  ),

  // Zusammenfassung für UI
  summary: z.string(),   // max 500 Zeichen, sachlich
});

export type WegExtraction = z.infer<typeof wegExtractionSchema>;
