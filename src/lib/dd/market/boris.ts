/**
 * Bodenrichtwerte-Provider (BORIS).
 *
 * Bodenrichtwerte werden in Deutschland von den Gutachterausschüssen der
 * Länder / Kreise erhoben und in Portalen wie BORIS-NRW, BORIS-BW,
 * BayernAtlas, ImmobilienBoerse veröffentlicht. Die Datenlagen sind
 * uneinheitlich — kaum ein Portal bietet eine dokumentierte REST-API
 * mit Geocoding-Adress-Lookup, die meisten sind WMS/WFS für GIS-Tools.
 *
 * v1-Strategie („best effort"):
 *   1. Location muss geokodiert sein (Lat/Lon) — sonst kein Punkt.
 *   2. Wir versuchen zwei Best-Effort-Wege:
 *      a) NRW hat einen offenen WFS mit Adress-Query — für NRW-PLZ
 *         (40000-59999) versuchen wir das.
 *      b) Alle anderen Länder: kein direkter API-Punkt in v1 →
 *         `null` (der Provider liefert dann keine Bodenrichtwert-Row).
 *
 * Wenn nichts gefunden wird: STATT einer erfundenen Zahl liefern wir
 * gar keinen Datenpunkt zurück. Die UI markiert das als „nicht
 * verfügbar" — kein Bauchgefühl, keine Ersatzheuristik.
 *
 * Für spätere Iterationen sinnvoll:
 *   - BKG-BORIS-Web-Feature-Service mit Rechteschlüssel des Kunden
 *   - Bezahlte kommerzielle Adress-Bodenrichtwert-APIs
 *   - Konfigurierbare Manual-Overrides pro Bundesland
 */

import type {
  LocationInput,
  MarketDataPoint,
  MarketDataProvider,
} from "./types";

/**
 * NRW-PLZ-Range (grob): 40000-59999. Ist nicht 100 % genau (überlappt
 * mit Grenzgebieten anderer Länder), reicht aber als billiger Vor-Check.
 */
function isNrwPostalCode(pc: string | null): boolean {
  if (!pc) return false;
  const n = parseInt(pc, 10);
  return Number.isFinite(n) && n >= 40000 && n <= 59999;
}

/**
 * Ruft die BORIS-NRW-Feature-Service-Schnittstelle mit einer POI-Anfrage
 * an einer bestimmten Koordinate ab. Der WFS gibt XML zurück; wir
 * suchen den ersten `<gml:featureMember>` mit `<boris:BRW>`-Wert.
 *
 * Die Endpoint-URL ist bewusst hardgekodet — der WFS ist öffentlich,
 * ohne Key nutzbar. Bei Ausfall: `null`, kein Throw.
 */
async function fetchBorisNrw(
  lat: number,
  lon: number
): Promise<number | null> {
  // BORIS-NRW nutzt EPSG:25832 (UTM32N) intern, aber der WFS akzeptiert
  // auch EPSG:4326 (WGS84) via `srsName`. Wir bauen einen kleinen Buffer
  // (~50 m in Lat/Lon-Approximation, ausreichend für Bodenrichtwert-Zone).
  const buf = 0.0005;
  const bbox = `${lon - buf},${lat - buf},${lon + buf},${lat + buf},EPSG:4326`;

  const url =
    "https://www.wms.nrw.de/gd/BORISPlus_BRW_WFS?" +
    new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "boris:BRW",
      srsName: "EPSG:4326",
      bbox,
      count: "1",
      outputFormat: "application/json",
    });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "estateably-dd/1.0 (contact: kontakt@estateably.de)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const json = (await res.json().catch(() => null)) as
      | {
          features?: Array<{
            properties?: {
              BRW?: number | string;
              brw?: number | string;
              wert?: number | string;
            };
          }>;
        }
      | null;

    if (!json?.features?.length) return null;
    const p = json.features[0].properties ?? {};
    const raw = p.BRW ?? p.brw ?? p.wert;
    if (raw == null) return null;
    const v = typeof raw === "number" ? raw : parseFloat(String(raw));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * BORIS-Provider — braucht Lat/Lon-Koordinaten, die aus dem OSM-Provider
 * kommen. Damit die Reihenfolge in der Registry stimmt: BORIS läuft
 * NACH OSM, holt sich die Koordinaten aus dem bereits erzeugten
 * Punkte-Pool via `previouslyCollected` (kommt später in der Registry
 * dazu). v1 vereinfachen wir und fordern selber ein Geocode, indem wir
 * den OSM-Geocoder nochmal aufrufen — das ist ein Extra-Roundtrip,
 * aber trivial.
 */
async function geocodeQuick(loc: LocationInput): Promise<{
  lat: number;
  lon: number;
} | null> {
  if (!loc.city && !loc.postal_code) return null;
  const q = [loc.street, loc.postal_code, loc.city, "Deutschland"]
    .filter(Boolean)
    .join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "estateably-dd/1.0",
        "Accept-Language": "de",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (!rows.length) return null;
    return {
      lat: parseFloat(rows[0].lat),
      lon: parseFloat(rows[0].lon),
    };
  } catch {
    return null;
  }
}

export const borisProvider: MarketDataProvider = {
  name: "BORIS",
  supports(loc) {
    // Wir supporten nur NRW in v1 — andere Länder brauchen eigene WFS-
    // Implementierungen bzw. kommerzielle APIs, siehe Header-Kommentar.
    return isNrwPostalCode(loc.postal_code);
  },
  async fetch(loc) {
    const geo = await geocodeQuick(loc);
    if (!geo) return null;

    const brw = await fetchBorisNrw(geo.lat, geo.lon);
    if (brw == null) return null;

    const today = new Date().toISOString().slice(0, 10);
    const points: MarketDataPoint[] = [
      {
        metric: "bodenrichtwert_eur_per_sqm",
        value_num: brw,
        value_text: null,
        unit: "eur_per_sqm",
        source: "BORIS-NRW",
        source_url:
          "https://www.boris.nrw.de/borisnrw/?lang=de",
        source_date: today,
      },
    ];
    return points;
  },
};
