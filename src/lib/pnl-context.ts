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
import {
  depreciationForCalendarYear,
  type DepreciationMethod,
  type DepreciationParams,
} from "@/lib/calculations/depreciation";
import type { LoanInput } from "@/lib/calculations/loan";

export type PropertyForPnL = {
  kind?: string | null;
  sqm?: string | number | null;
  transfer_date?: string | null;
  purchase_price: string | number | null;
  building_value_share_pct: string | number | null;
  land_value: string | number | null;
  depreciation_rate: string | number | null;
  depreciation_method?: DepreciationMethod | string | null;
  depreciation_start_year?: number | null;
  sonder_7b_basis_limit?: string | number | null;
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
  degressive_7v_rate?: string | number | null;
  sonder_7b_rate?: string | number | null;
  sonder_7b_years?: string | number | null;
  sonder_7b_linear_rate?: string | number | null;
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

/** Resolve the AfA start year for a property (= year of transfer date). */
export function resolveDepreciationStartYear(
  property: PropertyForPnL
): number | null {
  if (property.depreciation_start_year != null) {
    return Number(property.depreciation_start_year);
  }
  if (property.transfer_date) {
    return new Date(property.transfer_date).getUTCFullYear();
  }
  return null;
}

/**
 * Build the depreciation params for this property based on its method and
 * the global settings. Returns null if no AfA-Basis is available.
 */
export function buildDepreciationParams(
  property: PropertyForPnL,
  settings: SettingsForPnL,
  afaBasis: number
): DepreciationParams | null {
  if (afaBasis <= 0) return null;
  const method = ((property.depreciation_method as DepreciationMethod) ??
    "linear") as DepreciationMethod;
  const linearRate =
    method === "sonder_7b"
      ? num(settings.sonder_7b_linear_rate) ?? 0.03
      : num(property.depreciation_rate) ??
        num(settings.default_depreciation_rate) ??
        0.02;
  return {
    method,
    basis: afaBasis,
    linearRate,
    degressiveRate: num(settings.degressive_7v_rate) ?? 0.05,
    sonderRate: num(settings.sonder_7b_rate) ?? 0.05,
    sonderYears: Number(num(settings.sonder_7b_years) ?? 4),
    sonderLinearRate: num(settings.sonder_7b_linear_rate) ?? 0.03,
    sonder7bBasisLimit: num(property.sonder_7b_basis_limit),
  };
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

  // Default to GROSS convention so the display matches "Bruttomiete = Kaltmiete
  // + NK − Hausgeld − Rücklage − Zins − Tilgung" — the intuitive form
  // requested by the user. Workspaces can still pin "net" explicitly.
  const convention: CashflowConvention =
    settings.cashflow_convention === "net" ? "net" : "gross";

  const vacancyRate = resolveVacancyRate(property, settings);
  const managementDefault = resolveManagementMonthly(property, settings);
  const managementCosts =
    num(snapshot.management_costs) ?? (managementDefault || null);

  // Methodikbasierte AfA fürs Periodenjahr — fällt auf lineare AfA zurück,
  // wenn Methode 'linear' und kein Start-Jahr gesetzt ist.
  const depParams = buildDepreciationParams(property, settings, afaBasis);
  const startYear = resolveDepreciationStartYear(property);
  const periodYear = new Date(snapshot.period_start).getUTCFullYear();
  let annualBuildingDepreciationOverride: number | null = null;
  if (depParams && startYear != null) {
    const slice = depreciationForCalendarYear(depParams, startYear, periodYear);
    annualBuildingDepreciationOverride = slice.total;
  }

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
    annualBuildingDepreciationOverride,
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

/**
 * Steuereffekt-Zeitreihe — projiziert pro Jahr Zinsen, Tilgung, AfA und
 * Cashflow nach Steuer, basierend auf einem "Status-quo"-Snapshot.
 *
 * Annahmen:
 *   - Miete / Hausgeld / Rücklage / SEV / MAW bleiben konstant
 *     (keine Inflation, keine Mieterhöhung). Wenn du eine Mietsteigerung
 *     modellieren willst: kein UI dafür hier.
 *   - Zinsen + Tilgung kommen aus dem Tilgungsplan der hinterlegten
 *     Darlehen — Annuität bleibt nominell konstant, das Verhältnis
 *     verschiebt sich.
 *   - AfA folgt der gewählten Methode (linear / degressiv / Sonder).
 */
export type InvestmentForProjection = {
  year: number | null;
  is_long_term: boolean | null;
  amount: string | number | null;
  tax_treatment:
    | "expense_immediate"
    | "expense_82b"
    | "capitalized_building"
    | "capitalized_separate"
    | "non_deductible"
    | string
    | null;
  expense_82b_years: number | null;
  useful_life_years: number | null;
};

export type TaxProjectionRow = {
  /** AfA-Jahr (1-basiert). */
  year: number;
  /** Konkretes Kalenderjahr. */
  calendarYear: number;
  /** Jahres-Zinsen. */
  interest: number;
  /** Jahres-Tilgung. */
  principal: number;
  /** Jahres-Gebäude-AfA. */
  depreciation: number;
  /** Anteil aus Investitionen, der dieses Jahr steuerlich abzugsfähig ist
   *  (Erhaltungsaufwand sofort, § 82b-Tranche, AfA-Tranche aus
   *  capitalized_separate, AfA aus capitalized_building). */
  investmentDeductible: number;
  /** Cash-Abfluss aus Investitionen, der dieses Jahr fällig wird
   *  (capitalized_* zahlt im Jahr der Anschaffung 100 % Cash, wird aber
   *  über Jahre steuerlich verteilt). */
  investmentCashOutflow: number;
  /** Cashflow vor Steuer p.a. (inkl. Investment-Cash). */
  cashflowBeforeTax: number;
  /** Steuerlicher Gewinn p.a. (inkl. Investment-Abzug). */
  pretaxProfit: number;
  /** Steuereffekt p.a. (positiv = Steuerzahlung, negativ = Erstattung). */
  taxEffect: number;
  /** Cashflow nach Steuer p.a. */
  afterTaxCashflow: number;
};

export const TAX_PROJECTION_YEARS: readonly number[] = [
  1, 3, 5, 10, 15, 20, 30,
];

/**
 * Compute the deductible amount and cash outflow from investment plans
 * for a single calendar year. See investment_plans.tax_treatment for the
 * five treatments — this is the projection-side counterpart.
 */
function investmentImpactForYear(
  investments: InvestmentForProjection[],
  calendarYear: number,
  buildingAfaRate: number
): { deductible: number; cashOutflow: number } {
  let deductible = 0;
  let cashOutflow = 0;
  for (const inv of investments) {
    const yr = inv.year;
    if (yr == null) continue; // long-term: nicht in der Zeitreihe
    const amount = Number(inv.amount ?? 0);
    if (amount <= 0) continue;
    const treatment = inv.tax_treatment ?? "expense_immediate";

    // Cash-Abfluss immer im Jahr der Maßnahme.
    if (treatment !== "non_deductible" || calendarYear === yr) {
      // Egal welches Treatment — fließt im Anschaffungsjahr Cash ab.
    }
    if (calendarYear === yr) {
      cashOutflow += amount;
    }

    if (treatment === "non_deductible") continue;

    if (treatment === "expense_immediate") {
      if (calendarYear === yr) deductible += amount;
    } else if (treatment === "expense_82b") {
      const years = inv.expense_82b_years ?? 3;
      if (calendarYear >= yr && calendarYear < yr + years) {
        deductible += amount / years;
      }
    } else if (treatment === "capitalized_separate") {
      const years = inv.useful_life_years ?? 10;
      if (calendarYear >= yr && calendarYear < yr + years) {
        deductible += amount / years;
      }
    } else if (treatment === "capitalized_building") {
      // Wird wie Gebäude abgeschrieben — vereinfacht über Restnutzungsdauer
      // mit dem aktuellen Gebäude-AfA-Satz (linear).
      const years = buildingAfaRate > 0 ? Math.round(1 / buildingAfaRate) : 50;
      if (calendarYear >= yr && calendarYear < yr + years) {
        deductible += amount / years;
      }
    }
  }
  return { deductible, cashOutflow };
}

export function computeTaxProjection(args: {
  snapshot: SnapshotInputRow;
  property: PropertyForPnL;
  loans: LoanForPnL[];
  settings: SettingsForPnL;
  investments?: InvestmentForProjection[];
  years?: readonly number[];
}): TaxProjectionRow[] {
  const startYear = resolveDepreciationStartYear(args.property);
  if (startYear == null) return [];
  const targetYears = args.years ?? TAX_PROJECTION_YEARS;
  const investments = args.investments ?? [];
  const taxRate = Number(args.settings.tax_rate ?? 0);
  // Gebäude-AfA-Rate für die Zerlegung von capitalized_building.
  const buildingAfaRate =
    num(args.property.depreciation_rate) ??
    num(args.settings.default_depreciation_rate) ??
    0.02;

  return targetYears.map((y) => {
    const calendarYear = startYear + y - 1;
    const start = `${calendarYear}-01-01`;
    const end = `${calendarYear}-12-01`;
    const periodSnap: SnapshotInputRow = {
      ...args.snapshot,
      period_start: start,
      period_end: end,
      annuity_override: null,
      interest_override: null,
      principal_override: null,
    };
    const r = computeSnapshotResult(
      periodSnap,
      args.property,
      args.loans,
      args.settings
    );

    const { deductible, cashOutflow } = investmentImpactForYear(
      investments,
      calendarYear,
      buildingAfaRate
    );

    // Investitionen wirken zusätzlich:
    //   - Cashflow: minus cashOutflow (Cash, der raus ging)
    //   - Pretax: minus deductible (Steuerabzug verteilt)
    //   - Steuer: pretax × rate; cashflowAfterTax = cashflowBeforeTax − tax
    const cashflowBeforeTax = r.cashflowBeforeTax - cashOutflow;
    const pretaxProfit = r.pretaxProfit - deductible;
    const taxEffect = pretaxProfit * taxRate;
    const afterTaxCashflow = cashflowBeforeTax - taxEffect;

    return {
      year: y,
      calendarYear,
      interest: r.interest,
      principal: r.principal,
      depreciation: r.depreciation,
      investmentDeductible: deductible,
      investmentCashOutflow: cashOutflow,
      cashflowBeforeTax,
      pretaxProfit,
      taxEffect,
      afterTaxCashflow,
    };
  });
}

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
