/**
 * Prompt-Template für die Exposé-Extraktion.
 *
 * Design-Prinzipien:
 *   - System-Prompt macht die Regeln fest (null bei Unklarheit, keine
 *     Halluzination, JSON-only).
 *   - User-Message enthält den PDF-Text und das erwartete Schema als
 *     JSON-Skelett (kein formales JSON-Schema — die Zod-Validierung
 *     fängt Fehler; ein Beispiel im Prompt ist für das Modell klarer).
 *   - Deutschsprachige Instruktion, weil Exposés fast immer Deutsch sind.
 */

export const EXPOSE_SYSTEM_PROMPT = `Du bist ein präziser Immobilien-Analyst. Deine Aufgabe: harte Fakten aus einem Immobilien-Exposé extrahieren.

REGELN:
1. Nur was WIRKLICH im Text steht. Wenn ein Wert fehlt oder unklar ist: null.
2. Nie raten oder mit Marktdurchschnitten füllen.
3. Zahlen als Zahl (nicht "350.000 €" sondern 350000).
4. Wohnfläche in m² als Zahl. Preise in EUR als Zahl.
5. Bei mehreren möglichen Werten: die konkreteste/spezifischste Angabe nehmen.

MAKLER-SPRECH-ERKENNUNG:
Marketing-Formulierungen erkennen und übersetzen. Beispiele:
- "mit Liebe zum Detail" → "individuelle Ausstattung, Käufergeschmack kann abweichen" (low)
- "Handwerkerobjekt" → "sanierungsbedürftig, größere Investitionen nötig" (high)
- "gemütlich" → "klein / kompakt" (low)
- "charmant" → "alt / renovierungsbedürftig" (medium)
- "guter Grundriss" → keine Fläche in Prospekt, evtl. suboptimal (low)
- "Ausbaureserve" → Dachboden/Keller nicht ausgebaut, Kosten fallen an (medium)
- "verkehrsgünstig gelegen" → Straßenlärm möglich (medium)
- "familienfreundlich" → nur relevant für Zielgruppe, keine Sachinfo (low)

Antworte AUSSCHLIESSLICH mit dem JSON-Objekt, kein Text davor oder danach.`;

/**
 * User-Message-Skelett. Der PDF-Text wird zwischen die Marker eingesetzt.
 * Das JSON-Skelett zeigt dem Modell die erwartete Struktur.
 */
export function buildExposeUserMessage(pdfText: string): string {
  return `EXPOSÉ-TEXT (zwischen den ===-Markern):
===
${pdfText}
===

Extrahiere die Felder in dieses JSON-Format (identische Keys, gleiche Reihenfolge):

{
  "kind": "apartment|house|row_house|commercial|parking|other|null",
  "street": "string|null",
  "postal_code": "string|null",
  "city": "string|null",
  "federal_state": "string|null",
  "purchase_price_eur": "number|null",
  "living_area_sqm": "number|null",
  "plot_area_sqm": "number|null",
  "rooms": "number|null",
  "bedrooms": "number|null",
  "bathrooms": "number|null",
  "floor": "number|null",
  "build_year": "number|null",
  "energy_class": "A_PLUS|A|B|C|D|E|F|G|H|UNKNOWN",
  "energy_kwh_per_sqm_a": "number|null",
  "energy_certificate_type": "demand|consumption|unknown",
  "heating_kind": "gas|oil|heat_pump|district_heating|wood_pellets|electric|solar_thermal_combo|other|unknown",
  "heating_year": "number|null",
  "primary_energy_source": "string|null",
  "is_vacant": "boolean|null",
  "is_rented": "boolean|null",
  "current_cold_rent_per_month_eur": "number|null",
  "broker_commission_pct": "number|null",
  "broker_commission_eur": "number|null",
  "hoa_fee_per_month_eur": "number|null",
  "reserve_share_per_month_eur": "number|null",
  "features": ["string", "..."],
  "modernizations": [{"what": "string", "year": "number|null"}],
  "is_heritage_protected": "boolean|null",
  "missing_mandatory": ["string", "..."],
  "agent_speak_flags": [{"quote": "string", "translation": "string", "concern_level": "low|medium|high"}],
  "short_summary": "string (max 300 Zeichen, sachlich)"
}

missing_mandatory: liste Pflichtangaben nach GEG/EnEV/EWG, die im Exposé fehlen. Mögliche Werte:
- "energy_class"
- "energy_kwh_per_sqm_a"
- "energy_certificate_type"
- "primary_energy_source"
- "heating_kind"
- "build_year"`;
}
