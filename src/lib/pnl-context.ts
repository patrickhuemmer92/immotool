import {
  buildingAfaBasis,
  computePnL,
  type PnLInput,
  type PnLResult,
} from "@/lib/calculations/pnl";
import type { LoanInput } from "@/lib/calculations/loan";

export type PropertyForPnL = {
  purchase_price: string | number | null;
  building_value_share_pct: string | number | null;
  land_value: string | number | null;
  depreciation_rate: string | number | null;
  transfer_tax?: string | number | null;
  broker_fee?: string | number | null;
  notary_fee?: string | number | null;
  registration_cost?: string | number | null;
};

export type LoanForPnL = {
  loan_amount: string | number;
  interest_rate_pa: string | number;
  amortization_pa: string | number;
  first_payment_date: string;
  interest_share_first_rate: string | number | null;
  special_repayments?: { payment_date: string; amount: string | number }[];
};

export type SnapshotInputRow = {
  period_start: string;
  period_end: string;
  cold_rent: string | number | null;
  ancillary_costs: string | number | null;
  property_fee_recoverable: string | number | null;
  property_fee_not_recoverable: string | number | null;
  maintenance: string | number | null;
  annuity_override: string | number | null;
  interest_override: string | number | null;
  principal_override: string | number | null;
};

export type SettingsForPnL = {
  tax_rate: string | number;
  default_depreciation_rate: string | number;
};

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function buildPnLInput(
  snapshot: SnapshotInputRow,
  property: PropertyForPnL,
  loans: LoanForPnL[],
  settings: SettingsForPnL
): PnLInput {
  const depreciationRate =
    num(property.depreciation_rate) ?? num(settings.default_depreciation_rate) ?? 0;
  const ancillary =
    (num(property.transfer_tax) ?? 0) +
    (num(property.broker_fee) ?? 0) +
    (num(property.notary_fee) ?? 0) +
    (num(property.registration_cost) ?? 0);
  const afaBasis = buildingAfaBasis({
    purchasePrice: num(property.purchase_price),
    buildingValueSharePct: num(property.building_value_share_pct),
    landValue: num(property.land_value),
    ancillaryCosts: ancillary || null,
  });

  const loansMapped = loans.map((l) => {
    const loan: LoanInput = {
      loanAmount: Number(l.loan_amount),
      interestRatePa: Number(l.interest_rate_pa),
      amortizationPa: Number(l.amortization_pa),
      firstPaymentDate: new Date(l.first_payment_date),
      interestShareFirstRate: num(l.interest_share_first_rate),
    };
    return {
      loan,
      specialRepayments: (l.special_repayments ?? []).map((s) => ({
        date: new Date(s.payment_date),
        amount: Number(s.amount),
      })),
    };
  });

  return {
    period: {
      start: new Date(snapshot.period_start),
      end: new Date(snapshot.period_end),
    },
    coldRent: num(snapshot.cold_rent) ?? 0,
    ancillaryCosts: num(snapshot.ancillary_costs),
    propertyFeeRecoverable: num(snapshot.property_fee_recoverable),
    propertyFeeNotRecoverable: num(snapshot.property_fee_not_recoverable),
    maintenance: num(snapshot.maintenance),
    annuityOverride: num(snapshot.annuity_override),
    interestOverride: num(snapshot.interest_override),
    principalOverride: num(snapshot.principal_override),
    loans: loansMapped,
    buildingAfaBasis: afaBasis,
    depreciationRate,
    taxRate: Number(settings.tax_rate),
  };
}

export function computeSnapshotResult(
  snapshot: SnapshotInputRow,
  property: PropertyForPnL,
  loans: LoanForPnL[],
  settings: SettingsForPnL
): PnLResult {
  return computePnL(buildPnLInput(snapshot, property, loans, settings));
}
