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
