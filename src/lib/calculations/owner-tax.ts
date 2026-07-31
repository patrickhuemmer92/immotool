/**
 * Eigentümer-spezifische Steuersätze → effektiver Steuersatz je Objekt.
 *
 * Hintergrund: `settings.tax_rate` ist ein einziger Satz pro Workspace.
 * Das trifft nur zu, wenn alle Objekte demselben Steuersubjekt gehören.
 * Sobald ein Objekt mehreren, nicht zusammen veranlagten Eigentümern
 * gehört, hat jeder seinen eigenen Grenzsteuersatz (Migration 0027:
 * `owners.tax_rate`, NULL = Workspace-Default).
 *
 * Modell: Der Steuereffekt eines Objekts wird mit einem anteilsgewichteten
 * Mischsatz gerechnet:
 *
 *   effektiver Satz = Σ (ownership_share_i × Satz_i)
 *
 * Das ist exakt äquivalent dazu, jedem Eigentümer sein steuerliches
 * Ergebnis anteilig zuzurechnen und einzeln zu versteuern — solange die
 * Steuer linear im Ergebnis ist (was die App überall unterstellt:
 * `pretaxProfit × taxRate`). Progression, Freibeträge oder Verlust-
 * verrechnung über andere Einkünfte bildet die App bewusst nicht ab.
 */

export type OwnerTaxShare = {
  /** Anteil am Objekt (0..1) aus property_owners.ownership_share. */
  ownership_share: number | string | null;
  /** Persönlicher Satz (0..1) oder null = Workspace-Default. */
  tax_rate: number | string | null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Anteilsgewichteter Mischsteuersatz für ein Objekt.
 *
 * - Eigentümer ohne eigenen Satz gehen mit `fallbackRate` ein.
 * - Ohne zugeordnete Eigentümer (oder bei Anteilssumme 0) gilt
 *   `fallbackRate` — das Objekt rechnet dann wie vor Migration 0027.
 * - Die Gewichte werden auf ihre Summe normiert. Der DB-Trigger
 *   `check_property_owners_sum` erzwingt Summe = 1.0; die Normierung ist
 *   nur eine Absicherung gegen Altdaten/Rundungsdrift, damit kein
 *   Objekt versehentlich mit einem zu niedrigen Satz rechnet.
 */
export function blendedTaxRate(
  shares: readonly OwnerTaxShare[],
  fallbackRate: number
): number {
  let weightSum = 0;
  let weightedRate = 0;

  for (const s of shares) {
    const share = num(s.ownership_share);
    if (share == null || share <= 0) continue;
    const rate = num(s.tax_rate) ?? fallbackRate;
    weightSum += share;
    weightedRate += share * rate;
  }

  if (weightSum <= 0) return fallbackRate;
  return weightedRate / weightSum;
}

/** Rohform einer `property_owners(ownership_share, owner:owners(tax_rate))`-Zeile. */
export type PropertyOwnerJoinRow = {
  ownership_share: number | string | null;
  owner?:
    | { tax_rate: number | string | null }
    | { tax_rate: number | string | null }[]
    | null;
};

/**
 * Mappt die Supabase-Join-Zeilen auf `OwnerTaxShare[]`. Der Embed ist
 * many-to-one und kommt als Objekt zurück; die Array-Variante wird
 * mitbehandelt, weil die Client-Typen sie je nach Query zulassen.
 */
export function taxSharesFromPropertyOwners(
  rows: readonly PropertyOwnerJoinRow[] | null | undefined
): OwnerTaxShare[] {
  return (rows ?? []).map((r) => {
    const owner = Array.isArray(r.owner) ? r.owner[0] : r.owner;
    return {
      ownership_share: r.ownership_share,
      tax_rate: owner?.tax_rate ?? null,
    };
  });
}

/**
 * True, wenn mindestens ein beteiligter Eigentümer einen eigenen Satz
 * hat — die UI nutzt das, um den Mischsatz als solchen auszuweisen
 * statt ihn wie den globalen Standardsatz darzustellen.
 */
export function hasOwnTaxRate(shares: readonly OwnerTaxShare[]): boolean {
  return shares.some(
    (s) => num(s.tax_rate) != null && (num(s.ownership_share) ?? 0) > 0
  );
}
