/**
 * Bodenrichtwerte-Provider (BORIS) — Multi-Bundesland.
 *
 * Jedes Bundesland betreibt sein eigenes Portal mit eigener API (fast
 * immer OGC WFS, uneinheitliche Feature- und Property-Namen). Dieser
 * Provider mappt anhand der PLZ auf das jeweilige Land und ruft dessen
 * WFS mit der Objekt-Koordinate ab. Wenn ein Land keinen brauchbaren
 * öffentlichen Endpoint hat: `null` (statt erfundener Zahl).
 *
 * v1-Länder mit Impl:
 *   - NRW  (BORIS-NRW WFS)
 *   - BW   (BORIS-BW WFS)
 *   - BE   (Berlin FIS-Broker WFS)
 *   - HH   (GeoOnline Hamburg WFS)
 *   - NI   (BORIS.NI WFS)
 *
 * Andere Länder (BY, BB, HE, MV, RP, SL, SN, SH, ST, TH, HB): kein
 * einfacher offener REST/WFS-Endpoint mit Adress-Query in v1. Der
 * Provider gibt für diese Länder `null` zurück und die UI markiert
 * das als „nicht verfügbar".
 */

import type {
  LocationInput,
  MarketDataPoint,
  MarketDataProvider,
} from "./types";

const USER_AGENT =
  "estateably-dd/1.0 (contact: kontakt@estateably.de)";

// ---------------------------------------------------------------------
// PLZ → Bundesland
// Grobe Range-basierte Zuordnung (nicht 100 % genau in Grenzgebieten,
// aber ausreichend als Provider-Vor-Check). Diese Ranges sind das
// öffentlich publizierte grob-Schema der Deutschen Post.
// ---------------------------------------------------------------------
type StateCode =
  | "BW"
  | "BY"
  | "BE"
  | "BB"
  | "HB"
  | "HH"
  | "HE"
  | "MV"
  | "NI"
  | "NW"
  | "RP"
  | "SL"
  | "SN"
  | "ST"
  | "SH"
  | "TH"
  | "UNKNOWN";

function stateFromPlz(pc: string | null): StateCode {
  if (!pc) return "UNKNOWN";
  const n = parseInt(pc, 10);
  if (!Number.isFinite(n)) return "UNKNOWN";

  // Rough public-domain ranges (Deutsche Post PLZ-Struktur). Es gibt
  // Grenzfälle, in denen z. B. eine 34xxx-PLZ zu HE ODER NRW gehört.
  // Fürs Provider-Vor-Filtering reicht die Näherung.
  if (n >= 1000 && n <= 9999) return "SN"; // Sachsen (Teile Thüringens 07xxx überlappen — grob)
  if (n >= 10000 && n <= 14199) return "BE";
  if (n >= 14400 && n <= 16999) return "BB";
  if (n >= 17000 && n <= 17999) return "MV";
  if (n >= 18000 && n <= 19999) return "MV";
  if (n >= 20000 && n <= 21149) return "HH";
  if (n >= 21200 && n <= 21449) return "NI";
  if (n >= 21450 && n <= 21929) return "SH";
  if (n >= 22000 && n <= 22999) return "HH";
  if (n >= 23000 && n <= 23999) return "SH";
  if (n >= 24000 && n <= 25999) return "SH";
  if (n >= 26000 && n <= 26999) return "NI";
  if (n >= 27000 && n <= 27999) return "NI";
  if (n >= 28000 && n <= 28999) return "HB";
  if (n >= 29000 && n <= 29999) return "NI";
  if (n >= 30000 && n <= 31999) return "NI";
  if (n >= 32000 && n <= 33999) return "NW";
  if (n >= 34000 && n <= 34999) return "HE"; // 34xxx-Grenze zu NW
  if (n >= 35000 && n <= 35999) return "HE";
  if (n >= 36000 && n <= 36999) return "HE";
  if (n >= 37000 && n <= 37999) return "NI";
  if (n >= 38000 && n <= 39999) return "ST"; // Grenz-Region, ST-lastig
  if (n >= 40000 && n <= 48999) return "NW";
  if (n >= 49000 && n <= 49999) return "NI";
  if (n >= 50000 && n <= 53999) return "NW"; // NRW Süd
  if (n >= 54000 && n <= 56999) return "RP";
  if (n >= 57000 && n <= 59999) return "NW";
  if (n >= 60000 && n <= 65999) return "HE";
  if (n >= 66000 && n <= 66999) return "SL"; // 66xxx Saar-Kern
  if (n >= 67000 && n <= 69999) return "RP";
  if (n >= 70000 && n <= 79999) return "BW";
  if (n >= 80000 && n <= 87999) return "BY";
  if (n >= 88000 && n <= 88999) return "BW";
  if (n >= 89000 && n <= 89999) return "BW";
  if (n >= 90000 && n <= 96999) return "BY";
  if (n >= 97000 && n <= 97999) return "BY";
  if (n >= 98000 && n <= 99999) return "TH";
  return "UNKNOWN";
}

// ---------------------------------------------------------------------
// Geocode — kleiner Nominatim-Aufruf, damit der Provider für sich
// alleine steht (Registry-neutral).
// ---------------------------------------------------------------------
async function geocodeQuick(
  loc: LocationInput
): Promise<{ lat: number; lon: number } | null> {
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
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (!rows.length) return null;
    return { lat: parseFloat(rows[0].lat), lon: parseFloat(rows[0].lon) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Land-spezifische Aufrufe. Jede Funktion:
//   - baut eine BBOX um den Punkt (kleiner Buffer)
//   - fragt den WFS mit outputFormat=application/json
//   - extrahiert den ersten Feature mit dem land-spezifischen
//     Property-Namen (BRW / brw / bodenrichtwert / wert / …)
//   - gibt (value, source_label, source_url) zurück oder null
// ---------------------------------------------------------------------

type BorisResult = {
  value: number;
  source: string;
  source_url: string;
};

async function fetchWfs(
  url: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
  } catch {
    return null;
  }
}

/** Liefert ersten Feature-Property mit einem der Schlüssel-Aliase. */
function firstPropertyValue(
  json: Record<string, unknown> | null,
  keys: string[]
): number | null {
  const features = (json?.features as Array<{
    properties?: Record<string, unknown>;
  }>) || [];
  for (const f of features) {
    const p = f.properties ?? {};
    for (const k of keys) {
      const v = p[k];
      if (v == null) continue;
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/** BBOX um Punkt mit ~50m-Buffer in EPSG:4326 (grob). */
function bbox4326(lat: number, lon: number, buf = 0.0005): string {
  return `${lon - buf},${lat - buf},${lon + buf},${lat + buf},EPSG:4326`;
}

async function fetchBorisNrw(lat: number, lon: number): Promise<BorisResult | null> {
  const url =
    "https://www.wms.nrw.de/gd/BORISPlus_BRW_WFS?" +
    new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "boris:BRW",
      srsName: "EPSG:4326",
      bbox: bbox4326(lat, lon),
      count: "1",
      outputFormat: "application/json",
    });
  const json = await fetchWfs(url);
  const v = firstPropertyValue(json, ["BRW", "brw", "wert"]);
  if (v == null) return null;
  return {
    value: v,
    source: "BORIS-NRW",
    source_url: "https://www.boris.nrw.de/borisnrw/?lang=de",
  };
}

async function fetchBorisBw(lat: number, lon: number): Promise<BorisResult | null> {
  // BORIS-BW WFS — öffentlich, ohne Key. Endpunkt kann sich ändern; im
  // Fehlerfall liefern wir null (kein Throw), Registry ignoriert das.
  const url =
    "https://geodaten.gutachterausschuesse-bw.de/boris-bw/services/BORIS_BW/MapServer/WFSServer?" +
    new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "BORIS_BW:Bodenrichtwerte",
      srsName: "EPSG:4326",
      bbox: bbox4326(lat, lon),
      count: "1",
      outputFormat: "GEOJSON",
    });
  const json = await fetchWfs(url);
  const v = firstPropertyValue(json, ["BRW", "BODENRICHTWERT", "brw", "wert"]);
  if (v == null) return null;
  return {
    value: v,
    source: "BORIS-BW",
    source_url: "https://www.gutachterausschuesse-bw.de/BORIS-BW",
  };
}

async function fetchBorisBerlin(
  lat: number,
  lon: number
): Promise<BorisResult | null> {
  // Berlin publiziert Bodenrichtwerte über den FIS-Broker WFS.
  const url =
    "https://gdi.berlin.de/services/wfs/brw_2024?" +
    new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "brw_2024:brw_2024",
      srsName: "EPSG:4326",
      bbox: bbox4326(lat, lon),
      count: "1",
      outputFormat: "application/json",
    });
  const json = await fetchWfs(url);
  const v = firstPropertyValue(json, ["BRW", "brw", "brw_2024", "wert"]);
  if (v == null) return null;
  return {
    value: v,
    source: "FIS-Broker Berlin (BRW 2024)",
    source_url:
      "https://fbinter.stadt-berlin.de/fb/index.jsp",
  };
}

async function fetchBorisHamburg(
  lat: number,
  lon: number
): Promise<BorisResult | null> {
  // Hamburg publiziert BRW über den Geo-Online-WFS.
  const url =
    "https://geodienste.hamburg.de/HH_WFS_Bodenrichtwerte?" +
    new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "app:bodenrichtwert",
      srsName: "EPSG:4326",
      bbox: bbox4326(lat, lon),
      count: "1",
      outputFormat: "application/json",
    });
  const json = await fetchWfs(url);
  const v = firstPropertyValue(json, ["brw", "BRW", "bodenrichtwert", "wert"]);
  if (v == null) return null;
  return {
    value: v,
    source: "GeoPortal Hamburg",
    source_url: "https://geoportal-hamburg.de/",
  };
}

async function fetchBorisNiedersachsen(
  lat: number,
  lon: number
): Promise<BorisResult | null> {
  const url =
    "https://www.geodaten.niedersachsen.de/services/wfs/boris_ni?" +
    new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "boris_ni:brw",
      srsName: "EPSG:4326",
      bbox: bbox4326(lat, lon),
      count: "1",
      outputFormat: "application/json",
    });
  const json = await fetchWfs(url);
  const v = firstPropertyValue(json, ["brw", "BRW", "wert"]);
  if (v == null) return null;
  return {
    value: v,
    source: "BORIS.NI",
    source_url: "https://www.gag.niedersachsen.de/",
  };
}

// ---------------------------------------------------------------------
// Provider-Registrierung
// ---------------------------------------------------------------------

/** Land-Code → Fetcher-Funktion. Nicht gelistete Länder haben v1 keinen Provider. */
const FETCHERS: Partial<
  Record<StateCode, (lat: number, lon: number) => Promise<BorisResult | null>>
> = {
  NW: fetchBorisNrw,
  BW: fetchBorisBw,
  BE: fetchBorisBerlin,
  HH: fetchBorisHamburg,
  NI: fetchBorisNiedersachsen,
};

export const borisProvider: MarketDataProvider = {
  name: "BORIS",
  supports(loc) {
    const state = stateFromPlz(loc.postal_code);
    return state !== "UNKNOWN" && !!FETCHERS[state];
  },
  async fetch(loc) {
    const state = stateFromPlz(loc.postal_code);
    const fetcher = FETCHERS[state];
    if (!fetcher) return null;

    const geo = await geocodeQuick(loc);
    if (!geo) return null;

    const result = await fetcher(geo.lat, geo.lon);
    if (!result) return null;

    const today = new Date().toISOString().slice(0, 10);
    const points: MarketDataPoint[] = [
      {
        metric: "bodenrichtwert_eur_per_sqm",
        value_num: result.value,
        value_text: null,
        unit: "eur_per_sqm",
        source: result.source,
        source_url: result.source_url,
        source_date: today,
      },
      // Ein zweiter Punkt mit dem erkannten Bundesland — hilft in der UI
      // ohne extra Reverse-Geocode.
      {
        metric: "state_code",
        value_num: null,
        value_text: state,
        unit: null,
        source: "PLZ-Range",
        source_url: null,
        source_date: today,
      },
    ];
    return points;
  },
};

// Für Test / Debug exponiert
export const _stateFromPlz = stateFromPlz;
