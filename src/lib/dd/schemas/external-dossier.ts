/**
 * Schema für das externe Objektdossier — die „seriöse" Version,
 * die man dem Verkäufer / Makler zeigen kann. Kein Verhandlungs-Wording,
 * keine Preisdrücker-Argumente, keine Kostenschätzungen die Druck
 * aufbauen sollen.
 *
 * Statt Findings + Verhandlungsargumente:
 *   - key_facts: die harten Fakten (Kaufpreis, Fläche, Baujahr, GEG-Klasse)
 *   - assessments: sachliche Bewertung pro Kategorie (Ton wie Sachverständiger)
 *   - open_items: was noch fehlt / geklärt werden soll (neutral formuliert)
 *   - marketContext: Preis-Einordnung neutral (kein „überteuert")
 */

import { z } from "zod";

export const externalDossierSchema = z.object({
  /** Ein kurzer objektiver Fließtext: „Es handelt sich um eine ETW im
   *  Baujahr X …" — 2-4 Sätze, wie eine Kurzbeschreibung im
   *  Objektexposé eines Sachverständigen. */
  objective_summary: z.string(),

  /** Harte Fakten in Bullet-Form, keine Interpretation. */
  key_facts: z.array(
    z.object({
      label: z.string(),   // z.B. "Baujahr", "Wohnfläche"
      value: z.string(),   // z.B. "1908", "112 m²"
      note: z.string().nullable(), // optionaler Kurzhinweis, z.B. "vom Verkäufer angegeben"
    })
  ),

  /** Bewertung pro Kategorie in neutraler Sprache. Kein „kritisch",
   *  „bedenklich" — statt dessen „Prüfung empfohlen", „gut belegt",
   *  „Datenlage lückenhaft". */
  assessments: z.array(
    z.object({
      category: z.enum([
        "substanz",
        "finanzierung",
        "recht",
        "weg",
        "energie",
        "markt",
        "lage",
      ]),
      status: z.enum([
        "unauffaellig",       // grün: keine Auffälligkeiten
        "pruefung_empfohlen", // gelb: Punkt sollte im Termin bestätigt werden
        "unklarheit",         // rot: Datenlage lückenhaft, muss geklärt werden
      ]),
      one_liner: z.string(),  // 1 Satz Zusammenfassung
      details: z.string().nullable(), // 2-4 Sätze Sachverständigen-Sprache
      source_quote: z.string().nullable(),
      source_location: z.string().nullable(),
    })
  ),

  /** Offene Punkte / Dokumente die noch fehlen — neutral formuliert
   *  als „bitte um Übersendung von X" statt als Verhandlungshebel. */
  open_items: z.array(
    z.object({
      topic: z.string(),
      why_relevant: z.string(),  // sachlicher Grund
      priority: z.enum(["hoch", "mittel", "niedrig"]),
    })
  ),

  /** Optionale Markteinordnung — neutral, ohne Preisdrücker-Ton. */
  market_context: z
    .object({
      price_per_sqm_eur: z.number().nullable(),
      benchmark_note: z.string().nullable(), // z.B. "liegt im Marktsegment X"
    })
    .nullable(),
});

export type ExternalDossierData = z.infer<typeof externalDossierSchema>;
