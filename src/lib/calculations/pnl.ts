import type { LoanInput, SpecialRepayment } from "./loan";
import { generateSchedule } from "./loan";

export type PnLPeriod = {
  /** Inclusive month-aligned start date. */
  start: Date;
  /** Inclusive month-aligned end date. */
  end: Date;
};

export type PnLLoanRef = {
  loan: LoanInput;
  specialRepayments?: SpecialRepayment[];
};

/**
 * Inputs for one P&L snapshot. ALL non-override monetary fields are treated
 * as €/month and scaled to the period internally (so the user enters
 * "Kaltmiete 850" once, regardless of whether the snapshot covers a quarter
 * or a whole year). Override fields are also €/month — they replace the
 * auto-derived per-month value before scaling.
 *
 * Formula (Spec, see PR description):
 *   Warmmiete          = Kaltmiete + Umlagefähiges Hausgeld
 *   Cashflow vor Steuer = Warmmiete − Zinsen − Tilgung − Hausgeld_total − Zuführung Rücklage
 *   Steuerlicher Gewinn = Warmmiete − Hausgeld_total − Zinsen − Afa
 *                        (Tilgung und Rücklage sind nicht abziehbar)
 *   Steuer              = Steuerlicher Gewinn × Steuersatz
 *   Cashflow nach Steuer = Cashflow vor Steuer − Steuer
 */
export type PnLInput = {
  period: PnLPeriod;
  /** Cold rent — €/month. */
  coldRent: number;
  /** Single Hausgeld total — €/month. Used only if neither
   *  property_fee_recoverable nor property_fee_not_recoverable is set. */
  ancillaryCosts?: number | null;
  /** Recoverable portion of Hausgeld — €/month (paid back by tenant). */
  propertyFeeRecoverable?: number | null;
  /** Non-recoverable portion of Hausgeld — €/month (owner bears). */
  propertyFeeNotRecoverable?: number | null;
  /** Reserve / maintenance contribution — €/month (not tax-deductible). */
  maintenance?: number | null;
  /** Loan-service overrides — €/month. */
  annuityOverride?: number | null;
  interestOverride?: number | null;
  principalOverride?: number | null;
  loans?: PnLLoanRef[];
  /** Annual building Afa basis (€). */
  buildingAfaBasis: number;
  /** Annual building Afa rate (e.g. 0.02). */
  depreciationRate: number;
  /** Additional annual depreciation (e.g. kitchen, individual life). */
  otherAnnualDepreciation?: number;
  /** Personal income-tax rate applied to the taxable result. */
  taxRate: number;
};

export type PnLResult = {
  months: number;
  /** Warmmiete for the whole period. */
  rentTotal: number;
  /** Hausgeld + Rücklage for the period (cash-out display). */
  operatingCosts: number;
  /** Hausgeld total for the period (deductible portion of operating costs). */
  hausgeldTotal: number;
  /** Reserve contribution for the period (NOT tax-deductible). */
  reserveContribution: number;
  annuity: number;
  interest: number;
  principal: number;
  depreciation: number;
  cashflowBeforeTax: number;
  pretaxProfit: number;
  taxEffect: number;
  afterTaxCashflow: number;
  source: {
    annuity: "auto" | "override";
    interest: "auto" | "override";
    principal: "auto" | "override";
  };
};

export function periodMonths(p: PnLPeriod): number {
  const start = new Date(Date.UTC(p.start.getUTCFullYear(), p.start.getUTCMonth(), 1));
  const end = new Date(Date.UTC(p.end.getUTCFullYear(), p.end.getUTCMonth(), 1));
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

function loansAggregate(input: PnLInput): {
  interest: number;
  principal: number;
  annuity: number;
} {
  if (!input.loans || input.loans.length === 0) {
    return { interest: 0, principal: 0, annuity: 0 };
  }
  let interest = 0;
  let principal = 0;
  const startTime = new Date(
    Date.UTC(
      input.period.start.getUTCFullYear(),
      input.period.start.getUTCMonth(),
      1
    )
  ).getTime();
  const endTime = new Date(
    Date.UTC(
      input.period.end.getUTCFullYear(),
      input.period.end.getUTCMonth(),
      1
    )
  ).getTime();
  for (const ref of input.loans) {
    const sched = generateSchedule(ref.loan, {
      untilDate: input.period.end,
      specialRepayments: ref.specialRepayments,
    });
    for (const e of sched) {
      if (e.date.getTime() >= startTime && e.date.getTime() <= endTime) {
        interest += e.interest;
        principal += e.principal;
      }
    }
  }
  return { interest, principal, annuity: interest + principal };
}

export function computePnL(input: PnLInput): PnLResult {
  const months = periodMonths(input.period);
  const auto = loansAggregate(input);

  const annuitySource: "auto" | "override" =
    input.annuityOverride != null ? "override" : "auto";
  const interestSource: "auto" | "override" =
    input.interestOverride != null ? "override" : "auto";
  const principalSource: "auto" | "override" =
    input.principalOverride != null ? "override" : "auto";

  // Overrides are €/month → scale to period sum to match auto's unit.
  const annuity =
    input.annuityOverride != null
      ? input.annuityOverride * months
      : auto.annuity;
  const interest =
    input.interestOverride != null
      ? input.interestOverride * months
      : auto.interest;
  const principal =
    input.principalOverride != null
      ? input.principalOverride * months
      : auto.principal;

  // Monthly rental / cost inputs → period totals.
  const coldRentPeriod = (input.coldRent ?? 0) * months;
  const propFeeRecPeriod = (input.propertyFeeRecoverable ?? 0) * months;
  const propFeeNotRecPeriod = (input.propertyFeeNotRecoverable ?? 0) * months;
  const ancillaryPeriod = (input.ancillaryCosts ?? 0) * months;

  // Total Hausgeld: prefer the split when at least one part is given; else fall back.
  const hasSplit =
    input.propertyFeeRecoverable != null ||
    input.propertyFeeNotRecoverable != null;
  const hausgeldTotal = hasSplit
    ? propFeeRecPeriod + propFeeNotRecPeriod
    : ancillaryPeriod;

  // Recoverable portion (only when explicit) — used to build Warmmiete.
  const recoverableForWarmmiete = hasSplit ? propFeeRecPeriod : 0;

  const reserveContribution = (input.maintenance ?? 0) * months;

  const annualDepreciation =
    input.buildingAfaBasis * input.depreciationRate +
    (input.otherAnnualDepreciation ?? 0);
  const depreciation = (annualDepreciation * months) / 12;

  // Spec formula.
  const warmmiete = coldRentPeriod + recoverableForWarmmiete;
  const cashflowBeforeTax =
    warmmiete - annuity - hausgeldTotal - reserveContribution;
  const pretaxProfit =
    warmmiete - hausgeldTotal - interest - depreciation;
  const taxEffect = pretaxProfit * input.taxRate;
  const afterTaxCashflow = cashflowBeforeTax - taxEffect;

  return {
    months,
    rentTotal: warmmiete,
    operatingCosts: hausgeldTotal + reserveContribution,
    hausgeldTotal,
    reserveContribution,
    annuity,
    interest,
    principal,
    depreciation,
    cashflowBeforeTax,
    pretaxProfit,
    taxEffect,
    afterTaxCashflow,
    source: {
      annuity: annuitySource,
      interest: interestSource,
      principal: principalSource,
    },
  };
}

/**
 * Convenience for properties: compute the AfA basis (annual building share to
 * be depreciated) from purchase price and incidentals.
 */
export function buildingAfaBasis(args: {
  purchasePrice: number | null;
  buildingValueSharePct: number | null;
  landValue: number | null;
}): number {
  if (args.buildingValueSharePct != null && args.purchasePrice != null) {
    return args.purchasePrice * args.buildingValueSharePct;
  }
  if (args.landValue != null && args.purchasePrice != null) {
    return Math.max(0, args.purchasePrice - args.landValue);
  }
  return 0;
}
