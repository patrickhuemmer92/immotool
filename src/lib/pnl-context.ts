import {
  buildingAfaBasis,
  computeBankView,
  computePnL,
  computePropertyKPIs,
  type BankViewResult,
  type CashflowConvention,
  type PnLInput,
  type PnLResult,
  type PropertyKPIResult,
} from "@/lib/calculations/pnl";
import type { LoanInput } from "@/lib/calculations/loan";

export type PropertyForPnL = {
  kind?: string | null;
  sqm?: string | number | null;
  purchase_price: string | number | null;
  building_value_share_pct: string | number | null;
  land_value: string | number | null;
  depreciation_rate: string | number | null;
  transfer_tax?: string | number | null;
  broker_fee?: string | number | null;
  notary_fee?: string | number | null;
  registration_cost?: string | number | null;
  vacancy_risk_pct?: string | number | null;
  management_costs_monthly?: string | number | null;
  bank_maintenance_pauschale_per_sqm?: string | number | null;
};

export type LoanForPnL = {
  loan_amount: string | number;
  interest_rate_pa: string | number;
  amortization_pa: string | number;
  first_payment_date: string;
  interest_share_first_rate: string | number | null;
  rate_lock_until?: string | null;
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
  management_costs?: string | number | null;
  vacancy_risk_amount?: string | number | null;
  annuity_override: string | number | null;
  interest_override: string | number | null;
  principal_override: string | number | null;
};

export type SettingsForPnL = {
  tax_rate: string | number;
  default_depreciation_rate: string | number;
  cashflow_convention?: CashflowConvention | string | null;
  default_vacancy_residential?: string | number | null;
  default_vacancy_commercial?: string | number | null;
  default_management_per_unit?: string | number | null;
  bank_maintenance_per_sqm?: string | number | null;
};

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Resolve the effective vacancy rate (0..1) for this property. */
export function resolveVacancyRate(
  property: PropertyForPnL,
  settings: SettingsForPnL
): number {
  const override = num(property.vacancy_risk_pct);
  if (override != null) return override;
  const commercial =
    property.kind === "commercial" || property.kind === "parking";
  return num(
    commercial
      ? settings.default_vacancy_commercial
      : settings.default_vacancy_residential
  ) ?? (commercial ? 0.04 : 0.02);
}

/** Resolve the effective SEV-Verwaltungskosten (€/Monat) for this property. */
export function resolveManagementMonthly(
  property: PropertyForPnL,
  settings: SettingsForPnL
): number {
  const override = num(property.management_costs_monthly);
  if (override != null) return override;
  return num(settings.default_management_per_unit) ?? 0;
}

/** Resolve the bank-side maintenance allowance (€/m²/p.a.). */
export function resolveBankMaintenancePerSqm(
  property: PropertyForPnL,
  settings: SettingsForPnL
): number {
  const override = num(property.bank_maintenance_pauschale_per_sqm);
  if (override != null) return override;
  return num(settings.bank_maintenance_per_sqm) ?? 8;
}

export function buildPnLInput(
  snapshot: SnapshotInputRow,
  property: PropertyForPnL,
  loans: LoanForPnL[],
  settings: SettingsForPnL
): PnLInput {
  const depreciationRate =
    num(property.depreciation_rate) ??
    num(settings.default_depreciation_rate) ??
    0;
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

  const convention: CashflowConvention =
    settings.cashflow_convention === "gross" ? "gross" : "net";

  const vacancyRate = resolveVacancyRate(property, settings);
  const managementDefault = resolveManagementMonthly(property, settings);
  const managementCosts =
    num(snapshot.management_costs) ?? (managementDefault || null);

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
    managementCosts,
    vacancyAmountMonthly: num(snapshot.vacancy_risk_amount),
    vacancyRate,
    annuityOverride: num(snapshot.annuity_override),
    interestOverride: num(snapshot.interest_override),
    principalOverride: num(snapshot.principal_override),
    loans: loansMapped,
    buildingAfaBasis: afaBasis,
    depreciationRate,
    taxRate: Number(settings.tax_rate),
    convention,
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

export function computeSnapshotBankView(
  snapshot: SnapshotInputRow,
  property: PropertyForPnL,
  loans: LoanForPnL[],
  settings: SettingsForPnL,
  options: { stressBps?: number } = {}
): BankViewResult {
  const pnl = buildPnLInput(snapshot, property, loans, settings);
  // Earliest rate-lock end across all loans drives the stress projection.
  let rateLockUntil: Date | null = null;
  for (const l of loans) {
    if (l.rate_lock_until) {
      const d = new Date(l.rate_lock_until);
      if (rateLockUntil == null || d.getTime() < rateLockUntil.getTime()) {
        rateLockUntil = d;
      }
    }
  }
  return computeBankView({
    pnl,
    sqm: num(property.sqm),
    bankMaintenancePerSqm: resolveBankMaintenancePerSqm(property, settings),
    stressBps: options.stressBps ?? 0,
    rateLockUntil,
  });
}

export type PropertyKPIArgs = {
  property: PropertyForPnL;
  /** Annualized cold rent (€/year). */
  annualColdRent: number;
  /** Non-recoverable operating costs, annualized (€/year). */
  annualNetOperatingCosts: number;
  /** Sum of remaining loan balances today (€). */
  remainingLoans?: number | null;
  /** Latest valuation — combined market value (€). */
  marketValue?: number | null;
};

export function computeSnapshotKPIs(args: PropertyKPIArgs): PropertyKPIResult {
  const ancillary =
    (num(args.property.transfer_tax) ?? 0) +
    (num(args.property.broker_fee) ?? 0) +
    (num(args.property.notary_fee) ?? 0) +
    (num(args.property.registration_cost) ?? 0);
  const acquisitionCost = (num(args.property.purchase_price) ?? 0) + ancillary;
  return computePropertyKPIs({
    annualColdRent: args.annualColdRent,
    acquisitionCost,
    annualNetOperatingCosts: args.annualNetOperatingCosts,
    remainingLoans: args.remainingLoans ?? null,
    marketValue: args.marketValue ?? null,
  });
}
