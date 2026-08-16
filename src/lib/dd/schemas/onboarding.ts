import { z } from "zod";

// =====================================================================
// Kaufvertrag → properties-Basis
// =====================================================================
export const kaufvertragSchema = z.object({
  // Objekt-Identifikation
  street: z.string().nullable(),
  postal_code: z.string().nullable(),
  city: z.string().nullable(),
  location_detail: z.string().nullable(),          // "2. OG links"
  kind: z
    .enum(["apartment", "house", "row_house", "commercial", "parking", "other"])
    .nullable(),

  // Für MFH: Anzahl Einheiten, damit wir sie als Sub-Properties anlegen
  is_multi_family: z.boolean().nullable(),
  unit_count: z.number().nullable(),

  // Wirtschaftsdaten
  purchase_price_eur: z.number().nullable(),
  living_area_sqm: z.number().nullable(),
  plot_area_sqm: z.number().nullable(),
  land_value_eur: z.number().nullable(),           // Bodenwert-Anteil
  building_value_share_pct: z.number().nullable(), // 0..100

  // Termine (ISO YYYY-MM-DD)
  notary_appointment: z.string().nullable(),
  transfer_date: z.string().nullable(),            // Nutzen-Lasten-Übergang
  registration_date: z.string().nullable(),        // Grundbucheintragung

  // Nebenkosten
  transfer_tax_eur: z.number().nullable(),         // Grunderwerbsteuer
  broker_fee_eur: z.number().nullable(),
  notary_fee_eur: z.number().nullable(),
  registration_cost_eur: z.number().nullable(),

  // Verkäufer / Notar (nur für UI-Anzeige, nicht in properties)
  seller_name: z.string().nullable(),
  notary_name: z.string().nullable(),

  short_summary: z.string(),
});
export type KaufvertragExtraction = z.infer<typeof kaufvertragSchema>;

// =====================================================================
// Mietvertrag → tenants
// =====================================================================
export const mietvertragSchema = z.object({
  // Mieter (kann mehrere Personen sein — wir speichern den Anzeigename)
  tenant_name: z.string().nullable(),
  additional_tenants: z.array(z.string()),

  // Vertrag
  contract_start: z.string().nullable(),          // ISO
  is_fixed_term: z.boolean().nullable(),
  contract_end: z.string().nullable(),

  // Wirtschaft
  cold_rent_per_month_eur: z.number().nullable(),
  ancillary_costs_per_month_eur: z.number().nullable(),
  deposit_eur: z.number().nullable(),

  // Objekt-Zuordnung (bei MFH-Onboarding wichtig)
  unit_reference: z.string().nullable(),          // "Wohnung Nr. 3", "2. OG links"

  // Sondertermine
  rent_adjustments_notes: z.string().nullable(),  // Staffel/Index-Miete etc.

  short_summary: z.string(),
});
export type MietvertragExtraction = z.infer<typeof mietvertragSchema>;

// =====================================================================
// Darlehensvertrag → loans
// =====================================================================
export const darlehensvertragSchema = z.object({
  designation: z.string().nullable(),
  bank: z.string().nullable(),
  loan_number: z.string().nullable(),

  // Neuer vs. bestehender Kredit — bei Bestand sind die
  // Original-Konditionen oft irrelevant, wichtig ist die aktuelle
  // Restschuld / letzte Rate / Restlaufzeit. Wir extrahieren was da
  // ist; der User justiert im Confirm-Screen.
  //  "new"      = frisch abgeschlossenes / geplantes Darlehen
  //  "existing" = laufendes Bestandsdarlehen (Bank-Übernahme, letzte Rate
  //               als Grundlage — nicht die ursprünglichen Konditionen)
  loan_kind: z.enum(["new", "existing"]).nullable(),

  loan_amount_eur: z.number().nullable(),
  interest_rate_pa_pct: z.number().nullable(),    // 3.5 = 3,5 %
  amortization_pa_pct: z.number().nullable(),

  disbursement_date: z.string().nullable(),
  first_payment_date: z.string().nullable(),
  rate_lock_until: z.string().nullable(),
  maturity_date: z.string().nullable(),

  interest_share_first_rate_eur: z.number().nullable(),

  // Sondertilgungs-Rechte (relevant für Findings, aber nicht auto-anlegen)
  special_repayment_max_pct_pa: z.number().nullable(),
  special_repayment_notes: z.string().nullable(),

  // Bestandsdarlehen — nur relevant wenn loan_kind === "existing"
  current_balance_eur: z.number().nullable(),        // aktuelle Restschuld
  current_monthly_rate_eur: z.number().nullable(),   // letzte gezahlte Rate
  remaining_term_months: z.number().nullable(),      // Restlaufzeit

  short_summary: z.string(),
});
export type DarlehensvertragExtraction = z.infer<typeof darlehensvertragSchema>;
