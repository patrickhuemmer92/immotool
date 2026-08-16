/**
 * Provider-Abstraktion für Marktdaten.
 *
 * Jeder Provider liefert null oder mehrere Kennzahlen zurück, jeweils
 * mit Quelle + Stand. Nie erfundene Zahlen — fehlende Daten kommen
 * einfach nicht in der Antwort vor.
 */

export type MarketDataPoint = {
  metric: string;                 // z.B. 'bodenrichtwert', 'nearby_transit_count'
  value_num: number | null;
  value_text: string | null;
  unit: string | null;            // 'eur', 'eur_per_sqm', 'count', 'boolean'
  source: string;                 // 'BORIS-NRW', 'OpenStreetMap', ...
  source_url: string | null;
  source_date: string | null;     // ISO YYYY-MM-DD
};

export type LocationInput = {
  street: string | null;
  postal_code: string | null;
  city: string | null;
  federal_state: string | null;
};

export type MarketDataProvider = {
  name: string;
  /** Prüft, ob der Provider für diese Location Daten liefern kann. */
  supports(loc: LocationInput): boolean | Promise<boolean>;
  /** Liefert null (kein Ergebnis) oder eine Liste von Punkten. */
  fetch(loc: LocationInput): Promise<MarketDataPoint[] | null>;
};

export type MarketSnapshot = {
  points: MarketDataPoint[];
  computed_at: string;            // ISO
  eur_per_sqm: number | null;
  price_position: "under" | "at" | "over" | null;   // vs. Referenz
  price_deviation_pct: number | null;
};
