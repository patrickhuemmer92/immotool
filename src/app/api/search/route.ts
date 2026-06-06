/**
 * GET /api/search
 *
 * Liefert eine flache Liste aller searchbaren Entitäten im aktiven
 * Workspace (Objekte, Portfolios, Eigentümer, Mieter). Die Command-Palette
 * lädt das einmal beim ersten ⌘K-Open und filtert dann clientseitig — bei
 * <500 Entitäten reicht das locker.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";

export type SearchResultKind =
  | "property"
  | "portfolio"
  | "owner"
  | "tenant";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  label: string;
  /** Optional secondary text (z. B. zugehöriges Objekt für Mieter). */
  sublabel?: string;
  href: string;
};

export async function GET() {
  const active = await getActiveWorkspace();
  if (!active) return NextResponse.json({ results: [] });

  const supabase = await createClient();

  const [
    { data: properties },
    { data: portfolios },
    { data: owners },
    { data: tenants },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("workspace_id", active.id),
    supabase
      .from("portfolios")
      .select("id, name")
      .eq("workspace_id", active.id),
    supabase
      .from("owners")
      .select("id, name")
      .eq("workspace_id", active.id),
    supabase
      .from("tenants")
      .select(
        "id, name, property_id, properties!inner(id, street, postal_code, city, location_detail, description, workspace_id)"
      )
      .eq("properties.workspace_id", active.id),
  ]);

  const results: SearchResult[] = [];

  for (const p of properties ?? []) {
    results.push({
      kind: "property",
      id: p.id,
      label: formatPropertyAddress(p),
      href: `/objekte/${p.id}`,
    });
  }
  for (const p of portfolios ?? []) {
    results.push({
      kind: "portfolio",
      id: p.id,
      label: p.name,
      href: `/portfolios/${p.id}`,
    });
  }
  for (const o of owners ?? []) {
    results.push({
      kind: "owner",
      id: o.id,
      label: o.name,
      href: `/eigentuemer/${o.id}`,
    });
  }
  for (const tn of tenants ?? []) {
    type TenantRow = {
      properties:
        | {
            street: string;
            postal_code: string;
            city: string;
            location_detail: string | null;
            description: string | null;
          }
        | null;
    };
    const propRow = (tn as unknown as TenantRow).properties;
    const propLabel = propRow ? formatPropertyAddress(propRow) : "";
    results.push({
      kind: "tenant",
      id: tn.id,
      label: tn.name,
      sublabel: propLabel,
      href: `/objekte/${tn.property_id}/mieter`,
    });
  }

  return NextResponse.json({ results });
}
