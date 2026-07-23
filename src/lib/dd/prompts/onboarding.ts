/**
 * Extraktions-Prompts für die KI-Onboarding-Pipeline.
 * Design analog Phase-3-Prompts: null bei Unsicherheit, keine Erfindung,
 * JSON-only.
 */

const COMMON_HEADER = `Du bist ein präziser Analyst für Immobilien-Verträge. Regeln:

1. Nur was WIRKLICH im Text steht. Bei Unklarheit: null.
2. Nie raten, nie schätzen wo keine Zahl steht.
3. Zahlen als Zahl (nicht "350.000 €" sondern 350000).
4. Datumsangaben als ISO-Format YYYY-MM-DD.
5. Prozent-Angaben als Zahl ohne Einheit (3,5 % → 3.5).
6. Antworte AUSSCHLIESSLICH mit gültigem JSON, keine Prosa davor oder danach.`;

// ------------- Kaufvertrag ------------------------------------------

export const KAUFVERTRAG_SYSTEM_PROMPT = `${COMMON_HEADER}

DOMÄNE: Immobilien-Kaufvertrag (Notarurkunde).

WICHTIG:
- transfer_date = Nutzen-Lasten-Übergang (nicht Beurkundungsdatum).
- Bei Wohn- und Teileigentum: falls es um EINE Wohnung geht → is_multi_family=false, unit_count=null.
  Bei einem MFH oder Reihenhaus mit Aufteilung → is_multi_family=true, unit_count = Anzahl WE.
- land_value_eur = Bodenwertanteil, falls im Vertrag ausgewiesen (oft im Kaufpreisverteiler).
- building_value_share_pct = Gebäudeanteil in Prozent des Kaufpreises (typisch 70-85 %).`;

export function buildKaufvertragUserMessage(text: string): string {
  return `KAUFVERTRAG-TEXT:
===
${text}
===

Format:
{
  "street": "string|null",
  "postal_code": "string|null",
  "city": "string|null",
  "location_detail": "string|null",
  "kind": "apartment|house|row_house|commercial|parking|other|null",
  "is_multi_family": "boolean|null",
  "unit_count": "number|null",
  "purchase_price_eur": "number|null",
  "living_area_sqm": "number|null",
  "plot_area_sqm": "number|null",
  "land_value_eur": "number|null",
  "building_value_share_pct": "number|null",
  "notary_appointment": "YYYY-MM-DD|null",
  "transfer_date": "YYYY-MM-DD|null",
  "registration_date": "YYYY-MM-DD|null",
  "transfer_tax_eur": "number|null",
  "broker_fee_eur": "number|null",
  "notary_fee_eur": "number|null",
  "registration_cost_eur": "number|null",
  "seller_name": "string|null",
  "notary_name": "string|null",
  "short_summary": "string (max 300 Zeichen)"
}`;
}

// ------------- Mietvertrag ------------------------------------------

export const MIETVERTRAG_SYSTEM_PROMPT = `${COMMON_HEADER}

DOMÄNE: Wohnraum- oder Gewerbe-Mietvertrag.

WICHTIG:
- Bei mehreren Mietern (Ehepaare, WG): tenant_name = erste Person, additional_tenants = Rest.
- ancillary_costs_per_month_eur = Nebenkosten-Vorauszahlung (Kalt-Miete nicht doppelt zählen).
- is_fixed_term=true nur wenn ein konkretes Enddatum vereinbart ist (Kettenmiete zählt als unbefristet).
- unit_reference: die Wohnungsbezeichnung wie im Vertrag ("Whg. Nr. 4", "2. OG links") — hilft bei MFH-Onboarding zur Zuordnung.
- rent_adjustments_notes: Kernaussage zu Staffel-/Indexmiete + Erhöhungsrhythmus in einem Satz.`;

export function buildMietvertragUserMessage(text: string): string {
  return `MIETVERTRAG-TEXT:
===
${text}
===

Format:
{
  "tenant_name": "string|null",
  "additional_tenants": ["string"],
  "contract_start": "YYYY-MM-DD|null",
  "is_fixed_term": "boolean|null",
  "contract_end": "YYYY-MM-DD|null",
  "cold_rent_per_month_eur": "number|null",
  "ancillary_costs_per_month_eur": "number|null",
  "deposit_eur": "number|null",
  "unit_reference": "string|null",
  "rent_adjustments_notes": "string|null",
  "short_summary": "string (max 300 Zeichen)"
}`;
}

// ------------- Darlehensvertrag -------------------------------------

export const DARLEHENSVERTRAG_SYSTEM_PROMPT = `${COMMON_HEADER}

DOMÄNE: Darlehensvertrag / Baufinanzierung (Bank).

WICHTIG:
- interest_rate_pa_pct: Sollzins gebunden p. a. (nicht effektiver Jahreszins).
- amortization_pa_pct: anfängliche Tilgung.
- disbursement_date = Auszahlung; first_payment_date = erste Rate.
- rate_lock_until = Ende der Sollzinsbindung.
- maturity_date = Endfälligkeit (bei tilgungsfreien Darlehen wichtig).
- special_repayment_max_pct_pa: maximale jährliche Sondertilgung als % der Original-Darlehenssumme (5 % typisch).`;

export function buildDarlehensvertragUserMessage(text: string): string {
  return `DARLEHENSVERTRAG-TEXT:
===
${text}
===

Format:
{
  "designation": "string|null",
  "bank": "string|null",
  "loan_number": "string|null",
  "loan_amount_eur": "number|null",
  "interest_rate_pa_pct": "number|null",
  "amortization_pa_pct": "number|null",
  "disbursement_date": "YYYY-MM-DD|null",
  "first_payment_date": "YYYY-MM-DD|null",
  "rate_lock_until": "YYYY-MM-DD|null",
  "maturity_date": "YYYY-MM-DD|null",
  "interest_share_first_rate_eur": "number|null",
  "special_repayment_max_pct_pa": "number|null",
  "special_repayment_notes": "string|null",
  "short_summary": "string (max 300 Zeichen)"
}`;
}
