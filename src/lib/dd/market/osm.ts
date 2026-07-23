/**
 * OpenStreetMap-Provider — Geocoding + Umgebungsprofil.
 *
 * Nutzt zwei öffentliche Endpunkte:
 *   - Nominatim: Adresse → Koordinaten
 *   - Overpass: OSM-Objekte in einem Radius (Bahn, ÖPNV, Schulen, Ärzte …)
 *
 * Beide Endpunkte haben Rate-Limits (Nominatim: 1 req/s, Overpass: fair
 * use). Für v1 ohne Cache — bei Skalierung eigene Nominatim/Overpass-
 * Instanzen oder Cloud-Geocoder erwägen.
 */

import type {
  LocationInput,
  MarketDataPoint,
  MarketDataProvider,
} from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Overpass hat einen einzelnen public Endpoint, der regelmäßig überlastet
// ist (HTTP 504). Wir probieren die offiziellen Instanzen + einen
// Community-Mirror durch, bis eine antwortet. Reihenfolge = Präferenz.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

const USER_AGENT = "estateably-dd/1.0 (contact: kontakt@estateably.de)";

async function geocode(loc: LocationInput): Promise<{
  lat: number;
  lon: number;
  display_name: string;
} | null> {
  if (!loc.city && !loc.postal_code) return null;

  const q = [
    loc.street,
    loc.postal_code,
    loc.city,
    loc.federal_state,
    "Deutschland",
  ]
    .filter(Boolean)
    .join(", ");

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "de");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];
    if (!rows.length) return null;
    return {
      lat: parseFloat(rows[0].lat),
      lon: parseFloat(rows[0].lon),
      display_name: rows[0].display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Zählt in einem Radius von 800 m interessante POIs. Kein Perfekt-
 * Score, aber ein sinnvoller Lage-Kontext ("gute Anbindung / dünn
 * besiedelt / Krankenhäuser in der Nähe").
 */
/**
 * Zählt POIs in einem Radius um die gegebene Koordinate.
 *
 * Zwei wichtige Details:
 *   1. `nwr` (node/way/relation) statt `node` — Supermärkte,
 *      Krankenhäuser etc. sind in OSM überwiegend als Polygone (way)
 *      oder Multi-Polygone (relation) getaggt, nicht als Punkte.
 *      Mit `node` hätten wir sie fast alle verpasst.
 *   2. Multi-Endpoint-Retry: der offizielle Overpass-Endpoint hat
 *      regelmäßig 504-Timeouts. Wir probieren mehrere Mirrors durch.
 *
 * Rückgabe: null nur wenn ALLE Endpoints fehlgeschlagen sind — dann
 * markiert die UI die Punkte als „nicht verfügbar". „0 gefunden" ist
 * ein legitimes Ergebnis (ländliche Lage), das wir nicht unterdrücken.
 */
async function countNearby(
  lat: number,
  lon: number,
  radiusMeters: number
): Promise<Record<string, number> | null> {
  const bbox = `around:${radiusMeters},${lat},${lon}`;
  // Query: `nwr` findet auch Polygone. Timeout 15s im Query, 25s auf
  // dem fetch-Client — der Server-Timeout muss < Client-Timeout sein,
  // sonst kriegen wir eine leere 504-Antwort statt einer klaren Anfrage-
  // Absage.
  const query = `[out:json][timeout:15];
(
  nwr["amenity"~"^(school|hospital|doctors|pharmacy|supermarket|kindergarten)$"](${bbox});
  nwr["shop"="supermarket"](${bbox});
  node["public_transport"~"^(station|stop_position)$"](${bbox});
  node["railway"~"^(station|halt|tram_stop)$"](${bbox});
);
out tags 300;`;

  const body = "data=" + encodeURIComponent(query);

  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body,
        signal: AbortSignal.timeout(25_000),
      });
      // Bei 429/504/503 versuchen wir den nächsten Mirror.
      if (!res.ok) continue;

      // Content-Type prüfen: einige Mirrors liefern bei Timeout HTML
      // statt JSON. Ohne diesen Check würde JSON.parse crashen und wir
      // den nächsten Mirror verpassen.
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) continue;

      const json = (await res.json().catch(() => null)) as {
        elements?: { tags?: Record<string, string> }[];
      } | null;
      if (!json?.elements) continue;

      const counts: Record<string, number> = {
        transit: 0,
        school: 0,
        hospital: 0,
        doctors: 0,
        pharmacy: 0,
        supermarket: 0,
        kindergarten: 0,
      };
      for (const el of json.elements) {
        const tags = el.tags ?? {};
        if (
          tags.public_transport === "station" ||
          tags.public_transport === "stop_position" ||
          tags.railway === "station" ||
          tags.railway === "halt" ||
          tags.railway === "tram_stop"
        )
          counts.transit++;
        const am = tags.amenity;
        if (am === "school") counts.school++;
        else if (am === "hospital") counts.hospital++;
        else if (am === "doctors") counts.doctors++;
        else if (am === "pharmacy") counts.pharmacy++;
        else if (am === "kindergarten") counts.kindergarten++;
        if (tags.shop === "supermarket" || am === "supermarket")
          counts.supermarket++;
      }
      return counts;
    } catch {
      // Timeout / DNS / TLS — nächsten Mirror probieren.
      continue;
    }
  }
  return null;
}

export const osmProvider: MarketDataProvider = {
  name: "OpenStreetMap",
  supports(loc) {
    return !!(loc.city || loc.postal_code);
  },
  async fetch(loc) {
    const geo = await geocode(loc);
    if (!geo) return null;

    const points: MarketDataPoint[] = [];
    const today = new Date().toISOString().slice(0, 10);

    points.push({
      metric: "geo_lat",
      value_num: geo.lat,
      value_text: null,
      unit: "degree",
      source: "OpenStreetMap Nominatim",
      source_url: "https://nominatim.openstreetmap.org",
      source_date: today,
    });
    points.push({
      metric: "geo_lon",
      value_num: geo.lon,
      value_text: null,
      unit: "degree",
      source: "OpenStreetMap Nominatim",
      source_url: "https://nominatim.openstreetmap.org",
      source_date: today,
    });
    points.push({
      metric: "geo_display_name",
      value_num: null,
      value_text: geo.display_name,
      unit: null,
      source: "OpenStreetMap Nominatim",
      source_url: "https://nominatim.openstreetmap.org",
      source_date: today,
    });

    const counts = await countNearby(geo.lat, geo.lon, 800);
    if (counts) {
      for (const [k, v] of Object.entries(counts)) {
        points.push({
          metric: `nearby_${k}_800m`,
          value_num: v,
          value_text: null,
          unit: "count",
          source: "OpenStreetMap Overpass",
          source_url: "https://overpass-api.de",
          source_date: today,
        });
      }
      // Erfolgsmarker — UI kann so 0 (echt keine POI) von
      // "nicht verfügbar" unterscheiden.
      points.push({
        metric: "nearby_status",
        value_num: null,
        value_text: "ok",
        unit: null,
        source: "OpenStreetMap Overpass",
        source_url: null,
        source_date: today,
      });
    } else {
      // Alle Overpass-Mirrors haben nicht geantwortet. Legen wir einen
      // Status-Punkt an, damit die UI eine klare Fehlermeldung zeigen
      // kann statt drei nichtssagender Bindestriche.
      points.push({
        metric: "nearby_status",
        value_num: null,
        value_text: "unavailable",
        unit: null,
        source: "OpenStreetMap Overpass",
        source_url: null,
        source_date: today,
      });
    }

    return points;
  },
};
