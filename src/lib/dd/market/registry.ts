/**
 * Registry aller aktiven MarketDataProvider.
 *
 * Reihenfolge = Präferenz: der erste Provider, der einen Metric-Key
 * liefert, gewinnt. Duplikate werden verworfen.
 *
 * v1: nur OSM. BORIS-Provider (Bodenrichtwerte) folgen — die APIs sind
 * pro Bundesland unterschiedlich strukturiert, viele nur als WMS/WFS
 * ohne einfache REST-Schicht. Kommt als Best-Effort in einer nächsten
 * Iteration.
 */

import { osmProvider } from "./osm";
import type {
  LocationInput,
  MarketDataPoint,
  MarketDataProvider,
  MarketSnapshot,
} from "./types";

const PROVIDERS: MarketDataProvider[] = [osmProvider];

/**
 * Sammelt Datenpunkte von allen unterstützenden Providern.
 * Bei Doppelungen (gleicher metric-Key) gewinnt der ERSTE, der ihn liefert.
 */
export async function collectMarketData(
  loc: LocationInput
): Promise<MarketDataPoint[]> {
  const collected: MarketDataPoint[] = [];
  const seen = new Set<string>();

  for (const p of PROVIDERS) {
    const ok = await p.supports(loc);
    if (!ok) continue;
    const points = await p.fetch(loc).catch(() => null);
    if (!points) continue;
    for (const pt of points) {
      if (seen.has(pt.metric)) continue;
      seen.add(pt.metric);
      collected.push(pt);
    }
  }
  return collected;
}

/**
 * Baut einen Snapshot mit abgeleiteten Kennzahlen (€/m², Preis-Position
 * vs. Referenz). Fehlende Referenzdaten: eur_per_sqm bleibt null,
 * price_position bleibt null.
 */
export function buildSnapshot(input: {
  points: MarketDataPoint[];
  purchase_price_eur: number | null;
  living_area_sqm: number | null;
}): MarketSnapshot {
  const eurPerSqm =
    input.purchase_price_eur && input.living_area_sqm
      ? Math.round(input.purchase_price_eur / input.living_area_sqm)
      : null;

  // Referenz-Preis (€/m²) aus Marktdaten — v1 haben wir noch keinen,
  // deshalb bleibt price_position null. Sobald BORIS integriert ist
  // oder ein anderer Referenz-Preis-Provider, hier verrechnen.
  const referenceEurPerSqm: number | null = null;
  const deviation =
    eurPerSqm != null && referenceEurPerSqm != null
      ? (eurPerSqm - referenceEurPerSqm) / referenceEurPerSqm
      : null;
  const position: MarketSnapshot["price_position"] =
    deviation == null
      ? null
      : deviation < -0.1
        ? "under"
        : deviation > 0.1
          ? "over"
          : "at";

  return {
    points: input.points,
    computed_at: new Date().toISOString(),
    eur_per_sqm: eurPerSqm,
    price_position: position,
    price_deviation_pct: deviation == null ? null : Math.round(deviation * 100),
  };
}
