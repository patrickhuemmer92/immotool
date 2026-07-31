/**
 * Server-side Loader für eigentümerbezogene Steuersätze.
 *
 * Die Rechenlogik selbst ist rein und liegt in
 * `@/lib/calculations/owner-tax` — hier wird nur geladen und gemappt.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  blendedTaxRate,
  hasOwnTaxRate,
  type OwnerTaxShare,
} from "@/lib/calculations/owner-tax";

type PropertyOwnerTaxRow = {
  property_id: string;
  ownership_share: number | string | null;
  owner: { tax_rate: number | string | null } | null;
};

/** Anteile + Eigentümer-Sätze je Objekt, ein Query für alle IDs. */
async function loadTaxSharesByProperty(
  propertyIds: readonly string[]
): Promise<Map<string, OwnerTaxShare[]>> {
  const sharesByProperty = new Map<string, OwnerTaxShare[]>();
  if (propertyIds.length === 0) return sharesByProperty;

  const supabase = await createClient();
  const { data } = await supabase
    .from("property_owners")
    .select("property_id, ownership_share, owner:owners!inner(tax_rate)")
    .in("property_id", propertyIds as string[]);

  for (const row of (data ?? []) as unknown as PropertyOwnerTaxRow[]) {
    const list = sharesByProperty.get(row.property_id) ?? [];
    list.push({
      ownership_share: row.ownership_share,
      tax_rate: row.owner?.tax_rate ?? null,
    });
    sharesByProperty.set(row.property_id, list);
  }
  return sharesByProperty;
}

/**
 * Mischsteuersatz je Objekt (ein Query für alle IDs). Objekte ohne
 * zugeordnete Eigentümer bekommen `fallbackRate`, damit Aufrufer immer
 * einen Wert per Objekt-ID vorfinden.
 */
export async function loadPropertyTaxRates(
  propertyIds: readonly string[],
  fallbackRate: number
): Promise<Map<string, number>> {
  const sharesByProperty = await loadTaxSharesByProperty(propertyIds);
  const rates = new Map<string, number>();
  for (const id of propertyIds) {
    rates.set(
      id,
      blendedTaxRate(sharesByProperty.get(id) ?? [], fallbackRate)
    );
  }
  return rates;
}

export type PropertyTaxRateInfo = {
  /** Angewendeter Satz (0..1). */
  rate: number;
  /**
   * True, wenn der Satz aus mindestens einem eigenen Eigentümer-Satz
   * gemischt ist — die UI weist ihn dann als solchen aus statt als
   * Workspace-Standard.
   */
  fromOwners: boolean;
};

/** Wie `loadPropertyTaxRate`, zusätzlich mit Herkunft für die Anzeige. */
export async function loadPropertyTaxRateInfo(
  propertyId: string,
  fallbackRate: number
): Promise<PropertyTaxRateInfo> {
  const shares =
    (await loadTaxSharesByProperty([propertyId])).get(propertyId) ?? [];
  return {
    rate: blendedTaxRate(shares, fallbackRate),
    fromOwners: hasOwnTaxRate(shares),
  };
}

/**
 * Standard-Steuersatz des Workspace (settings.tax_rate). Fallback 0.35 —
 * derselbe Default, den die Rechenpfade verwenden, wenn keine
 * settings-Zeile existiert.
 */
export async function loadWorkspaceTaxRate(
  workspaceId: string
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("tax_rate")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const n = Number(data?.tax_rate);
  return Number.isFinite(n) ? n : 0.35;
}

/** Mischsteuersatz für ein einzelnes Objekt. */
export async function loadPropertyTaxRate(
  propertyId: string,
  fallbackRate: number
): Promise<number> {
  const rates = await loadPropertyTaxRates([propertyId], fallbackRate);
  return rates.get(propertyId) ?? fallbackRate;
}
