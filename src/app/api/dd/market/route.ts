/**
 * POST /api/dd/market
 * Body: { dd_project_id }
 *
 * Ruft die konfigurierten MarketDataProvider mit Location aus dem
 * extrahierten Exposé auf, speichert die Datenpunkte in dd_market_data
 * und schreibt den zusammengefassten Snapshot nach
 * dd_projects.market_snapshot.
 */

export const runtime = "nodejs";
// 60s Function-Timeout: OSM Nominatim ~2s + Overpass Retry-Kette
// (3 Mirrors × je 12s max) = worst case ~38s. Puffer für Netz + DB.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { collectMarketData, buildSnapshot } from "@/lib/dd/market/registry";

export async function POST(req: Request) {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { dd_project_id?: string } | null;
  if (!body?.dd_project_id)
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("dd_projects")
    .select("id, workspace_id, extracted_expose")
    .eq("id", body.dd_project_id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (!project)
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  if (!project.extracted_expose)
    return NextResponse.json({ error: "expose_missing" }, { status: 400 });

  const exp = project.extracted_expose as {
    street?: string | null;
    postal_code?: string | null;
    city?: string | null;
    federal_state?: string | null;
    purchase_price_eur?: number | null;
    living_area_sqm?: number | null;
  };

  const loc = {
    street: exp.street ?? null,
    postal_code: exp.postal_code ?? null,
    city: exp.city ?? null,
    federal_state: exp.federal_state ?? null,
  };

  if (!loc.city && !loc.postal_code) {
    return NextResponse.json(
      { error: "location_missing", hint: "Bitte Adresse im Exposé-Editor ergänzen." },
      { status: 400 }
    );
  }

  const points = await collectMarketData(loc);

  // Alte Marktdaten dieses Projekts löschen
  await supabase
    .from("dd_market_data")
    .delete()
    .eq("dd_project_id", body.dd_project_id);

  if (points.length > 0) {
    await supabase.from("dd_market_data").insert(
      points.map((p) => ({
        dd_project_id: body.dd_project_id,
        metric: p.metric,
        value_num: p.value_num,
        value_text: p.value_text,
        unit: p.unit,
        source: p.source,
        source_url: p.source_url,
        source_date: p.source_date,
      }))
    );
  }

  const snapshot = buildSnapshot({
    points,
    purchase_price_eur: exp.purchase_price_eur ?? null,
    living_area_sqm: exp.living_area_sqm ?? null,
  });

  await supabase
    .from("dd_projects")
    .update({
      market_snapshot: snapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.dd_project_id);

  return NextResponse.json({ ok: true, points_count: points.length, snapshot });
}
