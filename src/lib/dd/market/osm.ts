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
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
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
async function countNearby(
  lat: number,
  lon: number,
  radiusMeters: number
): Promise<Record<string, number> | null> {
  const bbox = `around:${radiusMeters},${lat},${lon}`;
  const query = `
[out:json][timeout:20];
(
  node["public_transport"~"^(station|stop_position)$"](${bbox});
  node["railway"~"^(station|halt)$"](${bbox});
  node["amenity"~"^(school|hospital|doctors|pharmacy|supermarket|kindergarten)$"](${bbox});
  node["shop"="supermarket"](${bbox});
);
out tags;`.trim();

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: "data=" + encodeURIComponent(query),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      elements: { tags?: Record<string, string> }[];
    };

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
        tags.railway === "halt"
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
    return null;
  }
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
    }

    return points;
  },
};
