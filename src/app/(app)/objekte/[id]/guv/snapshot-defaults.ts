/**
 * Shape used by both the snapshot form (client) and the GuV page (server)
 * to seed initial values. Lives in a non-"use client" module so the server
 * may import the helper without dragging client code along.
 */
export type SnapshotDefaults = {
  period_start: string;
  period_end: string;
  cold_rent: string;
  ancillary_costs: string;
  property_fee_recoverable: string;
  property_fee_not_recoverable: string;
  maintenance: string;
  management_costs: string;
  vacancy_risk_amount: string;
  annuity_override: string;
  interest_override: string;
  principal_override: string;
  notes: string;
};

export function buildEmptyDefaults(
  period_start: string,
  period_end: string
): SnapshotDefaults {
  return {
    period_start,
    period_end,
    cold_rent: "",
    ancillary_costs: "",
    property_fee_recoverable: "",
    property_fee_not_recoverable: "",
    maintenance: "",
    management_costs: "",
    vacancy_risk_amount: "",
    annuity_override: "",
    interest_override: "",
    principal_override: "",
    notes: "",
  };
}

/**
 * Seed defaults from the tenant's Kaltmiete + NK. The tenant record is the
 * single source of truth for Bruttomiete — the snapshot form pre-fills both
 * fields and the user can still override per period.
 */
export function buildDefaultsFromTenant(
  period_start: string,
  period_end: string,
  tenant: {
    cold_rent_per_month: number | string | null | undefined;
    ancillary_costs_per_month: number | string | null | undefined;
  } | null
): SnapshotDefaults {
  const base = buildEmptyDefaults(period_start, period_end);
  if (!tenant) return base;
  const fmt = (v: number | string | null | undefined): string => {
    if (v == null || v === "") return "";
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? String(n).replace(".", ",") : "";
  };
  return {
    ...base,
    cold_rent: fmt(tenant.cold_rent_per_month),
    ancillary_costs: fmt(tenant.ancillary_costs_per_month),
  };
}
