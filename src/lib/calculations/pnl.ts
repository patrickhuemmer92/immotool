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
 * Inputs for one P&L snapshot. Override fields, when set, win over the auto-
 * computed values from loans / property AfA.
 */
export type PnLInput = {
  period: PnLPeriod;
  /** Cold rent for the entire period. */
  coldRent: number;
  /** Operating cost inputs — either give a single ancillaryCosts total or
   *  the breakdown (recoverable + not_recoverable). */
  ancillaryCosts?: number | null;
  propertyFeeRecoverable?: number | null;
  propertyFeeNotRecoverable?: number | null;
  maintenance?: number | null;
  /** Loan service overrides for the period. */
  annuityOverride?: number | null;
  interestOverride?: number | null;
  principalOverride?: number | null;
  /** Loans associated with the property. */
  loans?: PnLLoanRef[];
  /** Annual depreciation basis (for buildings). */
  buildingAfaBasis: number;
  /** Annual depreciation rate (e.g. 0.02). */
  depreciationRate: number;
  /** Additional annual depreciation, e.g. kitchen. */
  otherAnnualDepreciation?: number;
  /** Personal income-tax rate applied to the taxable result. */
  taxRate: number;
};

export type PnLResult = {
  months: number;
  rentTotal: number;
  operatingCosts: number;
  annuity: number;
  interest: number;
  principal: number;
  depreciation: number;
  cashflowBeforeTax: number;
  pretaxProfit: number;
  taxEffect: number;
  afterTaxCashflow: number;
  /** Per-field origin: "auto" | "override". */
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
  for (const ref of input.loans) {
    const sched = generateSchedule(ref.loan, {
      untilDate: input.period.end,
      specialRepayments: ref.specialRepayments,
    });
    for (const e of sched) {
      if (
        e.date.getTime() >=
          new Date(
            Date.UTC(
              input.period.start.getUTCFullYear(),
              input.period.start.getUTCMonth(),
              1
            )
          ).getTime() &&
        e.date.getTime() <=
          new Date(
            Date.UTC(
              input.period.end.getUTCFullYear(),
              input.period.end.getUTCMonth(),
              1
            )
          ).getTime()
      ) {
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

  const annuity =
    input.annuityOverride != null ? input.annuityOverride : auto.annuity;
  const interest =
    input.interestOverride != null ? input.interestOverride : auto.interest;
  const principal =
    input.principalOverride != null ? input.principalOverride : auto.principal;

  const operatingCostsRaw =
    (input.propertyFeeNotRecoverable != null
      ? input.propertyFeeNotRecoverable
      : input.ancillaryCosts ?? 0) + (input.maintenance ?? 0);

  const annualDepreciation =
    input.buildingAfaBasis * input.depreciationRate +
    (input.otherAnnualDepreciation ?? 0);
  const depreciation = (annualDepreciation * months) / 12;

  const rentTotal = input.coldRent;
  const cashflowBeforeTax = rentTotal - operatingCostsRaw - annuity;
  const pretaxProfit = rentTotal - operatingCostsRaw - interest - depreciation;
  const taxEffect = pretaxProfit * input.taxRate;
  const afterTaxCashflow = cashflowBeforeTax - taxEffect;

  return {
    months,
    rentTotal,
    operatingCosts: operatingCostsRaw,
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
