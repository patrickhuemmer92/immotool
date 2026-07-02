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
 * Convention for reporting rental income & ancillaries.
 *
 * - **net** (default): rentTotal = Kaltmiete only; on the expense side the
 *   non-recoverable Hausgeld + reserve are deducted. Recoverable Hausgeld is
 *   treated as a wash (passes through to tenant) and disappears from both
 *   sides. Closer to how a tax advisor or bank would frame the numbers.
 *
 * - **gross**: rentTotal = Kalt + recoverable Hausgeld (Warmmiete); on the
 *   expense side the full Hausgeld is deducted. The "investor view" the app
 *   carried originally.
 *
 * Both conventions yield identical cashflow numbers — only the line items
 * shift. We always store the convention used so reports are unambiguous.
 */
export type CashflowConvention = "net" | "gross";

/**
 * Inputs for one P&L snapshot. ALL non-override monetary fields are treated
 * as €/month and scaled to the period internally (so the user enters
 * "Kaltmiete 850" once, regardless of whether the snapshot covers a quarter
 * or a whole year). Override fields are also €/month — they replace the
 * auto-derived per-month value before scaling.
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
  /** SEV-Verwaltungskosten — €/month. */
  managementCosts?: number | null;
  /** Mietausfallwagnis €/month override; if null, derived from rate × cold rent. */
  vacancyAmountMonthly?: number | null;
  /** Mietausfallwagnis-Rate (0..1). Used to derive vacancyAmountMonthly when
   *  no explicit override is given. */
  vacancyRate?: number | null;
  /** Loan-service overrides — €/month. */
  annuityOverride?: number | null;
  interestOverride?: number | null;
  principalOverride?: number | null;
  loans?: PnLLoanRef[];
  /** Annual building Afa basis (€). */
  buildingAfaBasis: number;
  /** Annual building Afa rate (e.g. 0.02). */
  depreciationRate: number;
  /**
   * Override für die jährliche Gebäude-AfA. Wenn gesetzt, wird sie statt
   * `buildingAfaBasis × depreciationRate` verwendet — pnl-context nutzt
   * das, um methodikbasierte AfA (degressiv § 7 V / Sonder § 7b) für das
   * konkrete Periodenjahr durchzureichen.
   */
  annualBuildingDepreciationOverride?: number | null;
  /** Additional annual depreciation (e.g. kitchen, individual life). */
  otherAnnualDepreciation?: number;
  /** Personal income-tax rate applied to the taxable result. */
  taxRate: number;
  /** Convention for income/expense labelling. Defaults to 'net'. */
  convention?: CashflowConvention;
};

export type PnLResult = {
  months: number;
  convention: CashflowConvention;
  /** Income line for display, depends on convention. */
  rentTotal: number;
  /** Pure cold rent for the period — always available regardless of convention. */
  coldRentTotal: number;
  /** Recoverable Hausgeld for the period (used by gross convention income). */
  recoverableForGross: number;
  /** Hausgeld + Rücklage + SEV + MAW for the period (cash-out display). */
  operatingCosts: number;
  /** Hausgeld total for the period (deductible portion of operating costs). */
  hausgeldTotal: number;
  /** Non-recoverable Hausgeld for the period (the part owner pays in net view). */
  hausgeldNonRecoverable: number;
  /** Reserve contribution for the period (NOT tax-deductible). */
  reserveContribution: number;
  /** SEV-Verwaltungskosten for the period. */
  managementTotal: number;
  /** Mietausfallwagnis for the period (cash deduction). */
  vacancyLoss: number;
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
  const start = new Date(
    Date.UTC(p.start.getUTCFullYear(), p.start.getUTCMonth(), 1)
  );
  const end = new Date(
    Date.UTC(p.end.getUTCFullYear(), p.end.getUTCMonth(), 1)
  );
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
  const convention: CashflowConvention = input.convention ?? "net";
  const months = periodMonths(input.period);
  const auto = loansAggregate(input);

  const annuitySource: "auto" | "override" =
    input.annuityOverride != null ? "override" : "auto";
  const interestSource: "auto" | "override" =
    input.interestOverride != null ? "override" : "auto";
  const principalSource: "auto" | "override" =
    input.principalOverride != null ? "override" : "auto";

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

  const coldRentMonthly = input.coldRent ?? 0;
  const coldRentPeriod = coldRentMonthly * months;
  const propFeeRecPeriod = (input.propertyFeeRecoverable ?? 0) * months;
  const propFeeNotRecPeriod = (input.propertyFeeNotRecoverable ?? 0) * months;
  const ancillaryPeriod = (input.ancillaryCosts ?? 0) * months;

  const hasSplit =
    input.propertyFeeRecoverable != null ||
    input.propertyFeeNotRecoverable != null;
  const hausgeldTotal = hasSplit
    ? propFeeRecPeriod + propFeeNotRecPeriod
    : ancillaryPeriod;
  const hausgeldNonRecoverable = hasSplit
    ? propFeeNotRecPeriod
    : ancillaryPeriod;

  const reserveContribution = (input.maintenance ?? 0) * months;
  const managementTotal = (input.managementCosts ?? 0) * months;

  // Vacancy: snapshot override wins, else rate × cold rent.
  const vacancyMonthly =
    input.vacancyAmountMonthly != null
      ? input.vacancyAmountMonthly
      : (input.vacancyRate ?? 0) * coldRentMonthly;
  const vacancyLoss = vacancyMonthly * months;

  const annualBuilding =
    input.annualBuildingDepreciationOverride != null
      ? input.annualBuildingDepreciationOverride
      : input.buildingAfaBasis * input.depreciationRate;
  const annualDepreciation =
    annualBuilding + (input.otherAnnualDepreciation ?? 0);
  const depreciation = (annualDepreciation * months) / 12;

  // ------- Cashflow line items, convention-aware -------
  // Both conventions arrive at the same cashflow_before_tax, but the income
  // and expense buckets shift.
  let rentTotal: number;
  let operatingCosts: number;

  if (convention === "gross") {
    // income = cold + recoverable (Warmmiete)
    rentTotal = coldRentPeriod + propFeeRecPeriod;
    // expenses include the full Hausgeld
    operatingCosts =
      hausgeldTotal + reserveContribution + managementTotal + vacancyLoss;
  } else {
    // net: income = cold only (recoverable passes through)
    rentTotal = coldRentPeriod;
    // expenses include only the non-recoverable portion of Hausgeld + others
    operatingCosts =
      hausgeldNonRecoverable +
      reserveContribution +
      managementTotal +
      vacancyLoss;
  }

  const cashflowBeforeTax = rentTotal - annuity - operatingCosts;

  // Steuerlicher Gewinn — Konvention-unabhängig, weil das EStG die
  // Konvention nicht kennt.
  //
  // Steuerlich abzugsfähig als Werbungskosten (§ 9 EStG):
  //   - volles Hausgeld (umlag. Teil ist sowohl Einnahme als auch Ausgabe →
  //     hebt sich auf, ändert pretaxProfit aber nicht, weil Warmmiete +
  //     volles HG dieselbe Differenz ergibt wie Kalt + nicht-umlag.)
  //   - SEV-Verwaltungskosten
  //   - Zinsen
  //   - AfA
  //
  // NICHT abzugsfähig:
  //   - Tilgung
  //   - Zuführung zur Rücklage (erst bei tatsächlicher Verwendung als
  //     Erhaltungsaufwand, BFH-Rspr.)
  //   - Mietausfallwagnis — rein kalkulatorisch (mindert nur den Cashflow,
  //     nicht das zu versteuernde Einkommen).
  const deductibleOperating = hausgeldTotal + managementTotal;
  // Warmmiete is the relevant income for the tax calculation regardless of
  // display convention — because the recoverable Hausgeld is, formally,
  // additional rental income (Einnahmen V+V).
  const warmmiete = coldRentPeriod + propFeeRecPeriod;
  const pretaxProfit =
    warmmiete - deductibleOperating - interest - depreciation;
  const taxEffect = pretaxProfit * input.taxRate;
  const afterTaxCashflow = cashflowBeforeTax - taxEffect;

  return {
    months,
    convention,
    rentTotal,
    coldRentTotal: coldRentPeriod,
    recoverableForGross: propFeeRecPeriod,
    operatingCosts,
    hausgeldTotal,
    hausgeldNonRecoverable,
    reserveContribution,
    managementTotal,
    vacancyLoss,
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

// =====================================================================
// Bank-Sicht (banker view) — pre-tax, conservative.
// =====================================================================

export type BankViewInput = {
  pnl: PnLInput;
  /** Living area (m²) used for the conservative IH-Pauschale. */
  sqm?: number | null;
  /** Bank-side maintenance allowance (€/m²/p.a.). */
  bankMaintenancePerSqm: number;
  /** Optional stress: extra basis points (e.g. 250) applied to the loan
   *  interest **after** the rate lock ends. If a rate lock is in the past
   *  (or unknown), the stress applies from the start of the period. */
  stressBps?: number;
  /** Rate lock end date used for the stress projection. */
  rateLockUntil?: Date | null;
};

export type BankViewResult = {
  months: number;
  /** Cold rent — Sollmiete (Soll, not Ist). */
  rentScheduled: number;
  /** Mietausfallwagnis. */
  vacancyLoss: number;
  /** Effective rent reaching the owner. */
  rentEffective: number;
  /** Non-recoverable Hausgeld for the period. */
  hausgeldNonRecoverable: number;
  /** Conservative IH-Pauschale (€/m² × sqm × months / 12). */
  bankMaintenance: number;
  /** SEV-Verwaltungskosten. */
  managementTotal: number;
  /** NOI = rentEffective − hausgeldNonRecoverable − bankMaintenance − management. */
  noi: number;
  /** Interest portion of the debt service over the period. */
  interest: number;
  /** Principal portion of the debt service. */
  principal: number;
  /** Full debt service (annuity). */
  debtService: number;
  /** ICR = NOI / interest. */
  icr: number | null;
  /** Cashflow before tax = NOI − debtService. */
  cashflowBeforeTax: number;
  /** Whether stress was applied (and what it was). */
  stress: { applied: boolean; bps: number };
};

/**
 * Bank-Sicht (banker view). Returns conservative pre-tax numbers without
 * the personal-tax effect.
 *
 * Conventions used here:
 *  - "Sollmiete" is the cold rent input (we don't model a separate Ist).
 *  - Mietausfallwagnis defaults to the PnL input's vacancyRate; the snapshot
 *    override (vacancyAmountMonthly) still wins when set.
 *  - IH-Pauschale Bank is bankMaintenancePerSqm × sqm × months / 12, charged
 *    in addition to any Rücklage the investor view applies. (We deliberately
 *    do not deduct the investor's Rücklage here — bank ignores soft costs.)
 *  - SEV-Verwaltung comes through as PnL.managementCosts.
 *  - Interest is taken from the PnL input. The optional stress increases the
 *    interest portion by `stressBps` of the loan balance for the months after
 *    `rateLockUntil`.
 */
export function computeBankView(args: BankViewInput): BankViewResult {
  const months = periodMonths(args.pnl.period);
  const coldRentMonthly = args.pnl.coldRent ?? 0;
  const rentScheduled = coldRentMonthly * months;

  const vacancyMonthly =
    args.pnl.vacancyAmountMonthly != null
      ? args.pnl.vacancyAmountMonthly
      : (args.pnl.vacancyRate ?? 0) * coldRentMonthly;
  const vacancyLoss = vacancyMonthly * months;
  const rentEffective = rentScheduled - vacancyLoss;

  const propFeeNotRecPeriod = (args.pnl.propertyFeeNotRecoverable ?? 0) * months;
  const ancillaryPeriod = (args.pnl.ancillaryCosts ?? 0) * months;
  const hasSplit =
    args.pnl.propertyFeeRecoverable != null ||
    args.pnl.propertyFeeNotRecoverable != null;
  const hausgeldNonRecoverable = hasSplit
    ? propFeeNotRecPeriod
    : ancillaryPeriod;

  const sqm = args.sqm ?? 0;
  const bankMaintenance = (sqm * args.bankMaintenancePerSqm * months) / 12;

  const managementTotal = (args.pnl.managementCosts ?? 0) * months;

  const noi =
    rentEffective - hausgeldNonRecoverable - bankMaintenance - managementTotal;

  // Borrow PnL aggregate for interest/principal.
  const auto = loansAggregate(args.pnl);
  let interest =
    args.pnl.interestOverride != null
      ? args.pnl.interestOverride * months
      : auto.interest;
  const principal =
    args.pnl.principalOverride != null
      ? args.pnl.principalOverride * months
      : auto.principal;

  // Stress test — legt stressBps auf die Restschuld drauf. Die Logik
  // ist dreiteilig, damit sowohl "Zinsbindung endet in der Periode" als
  // auch "Zinsbindung liegt vollständig außerhalb" sinnvoll behandelt
  // werden:
  //   - lockEnd VOR Periodenstart  → Zinsbindung abgelaufen: Stress
  //                                   greift auf die ganze Periode.
  //   - lockEnd IN der Periode      → Stress nur ab lockEnd bis Ende.
  //   - lockEnd NACH Periodenende   → reine Sensitivitätsanalyse
  //                                   ("was wäre, wenn die Zinsen sofort
  //                                   +250 bp wären"): Stress auf die
  //                                   ganze Periode. Vorher wurde der
  //                                   Stress hier stillschweigend
  //                                   verworfen — bei historischen
  //                                   Snapshots mit Zinsbindung weit in
  //                                   der Zukunft blieben die Zahlen
  //                                   dann identisch zur Nicht-Stress-
  //                                   Sicht.
  const stressBps = args.stressBps ?? 0;
  let stressApplied = false;
  if (stressBps > 0 && args.pnl.loans && args.pnl.loans.length > 0) {
    const lockEnd = args.rateLockUntil;
    const periodStart = args.pnl.period.start;
    const periodEnd = args.pnl.period.end;
    let stressedStart: Date;
    if (!lockEnd || lockEnd.getTime() <= periodStart.getTime()) {
      // keine Zinsbindung oder bereits abgelaufen → volle Periode
      stressedStart = periodStart;
    } else if (lockEnd.getTime() < periodEnd.getTime()) {
      // Zinsbindung endet mitten in der Periode → ab dem Ende stressen
      stressedStart = lockEnd;
    } else {
      // Zinsbindung reicht über die Periode hinaus → volle Periode
      // als Sensitivitätsanalyse. Restschuld nehmen wir zum Beginn
      // der Periode, damit der Wert reproduzierbar ist.
      stressedStart = periodStart;
    }
    const stressedMonths =
      (periodEnd.getUTCFullYear() - stressedStart.getUTCFullYear()) * 12 +
      (periodEnd.getUTCMonth() - stressedStart.getUTCMonth()) +
      1;
    if (stressedMonths > 0) {
      const stressRateMonthly = stressBps / 10000 / 12;
      let balanceAtStress = 0;
      for (const ref of args.pnl.loans) {
        const sched = generateSchedule(ref.loan, {
          untilDate: stressedStart,
          specialRepayments: ref.specialRepayments,
        });
        const last = sched[sched.length - 1];
        if (last) balanceAtStress += last.balance;
        else balanceAtStress += ref.loan.loanAmount;
      }
      const extraInterest =
        balanceAtStress * stressRateMonthly * stressedMonths;
      interest += extraInterest;
      stressApplied = true;
    }
  }

  const debtService = interest + principal;
  const icr = interest > 0 ? noi / interest : null;
  const cashflowBeforeTax = noi - debtService;

  return {
    months,
    rentScheduled,
    vacancyLoss,
    rentEffective,
    hausgeldNonRecoverable,
    bankMaintenance,
    managementTotal,
    noi,
    interest,
    principal,
    debtService,
    icr,
    cashflowBeforeTax,
    stress: { applied: stressApplied, bps: stressBps },
  };
}

// =====================================================================
// Property KPIs — yields, LTV.
// =====================================================================

export type PropertyKPIInput = {
  /** Annualized cold rent (€/year). */
  annualColdRent: number;
  /** Acquisition cost including incidentals (€). */
  acquisitionCost: number;
  /** Annualized non-recoverable operating costs (€/year). */
  annualNetOperatingCosts: number;
  /** Current remaining loan balance (€) — for LTV. */
  remainingLoans?: number | null;
  /** Current market value (€) — for LTV. */
  marketValue?: number | null;
};

export type PropertyKPIResult = {
  /** Brutto-Mietrendite = Jahres-Kaltmiete / Anschaffung. */
  grossYield: number | null;
  /** Netto-Mietrendite = (Kaltmiete − nicht-umlagef. Kosten) / Anschaffung. */
  netYield: number | null;
  /** Loan-to-Value (Restschuld / Marktwert). */
  ltv: number | null;
};

export function computePropertyKPIs(args: PropertyKPIInput): PropertyKPIResult {
  const grossYield =
    args.acquisitionCost > 0 ? args.annualColdRent / args.acquisitionCost : null;
  const netYield =
    args.acquisitionCost > 0
      ? (args.annualColdRent - args.annualNetOperatingCosts) /
        args.acquisitionCost
      : null;
  const ltv =
    args.marketValue && args.marketValue > 0 && args.remainingLoans != null
      ? args.remainingLoans / args.marketValue
      : null;
  return { grossYield, netYield, ltv };
}

// =====================================================================
// Property → AfA basis helpers (unchanged).
// =====================================================================

/**
 * AfA-Bemessungsgrundlage nach § 7 Abs. 4 EStG:
 * Gebäudeanteil am Kaufpreis PLUS anteilige Anschaffungsnebenkosten
 * (Grunderwerbsteuer, Maklerprovision, Notar, Grundbuch).
 * Nebenkosten werden im selben Verhältnis wie der Kaufpreis aufgeteilt.
 * Geldbeschaffungskosten gehören NICHT dazu (Werbungskosten, § 9 EStG).
 */
export function buildingAfaBreakdown(args: {
  purchasePrice: number | null;
  buildingValueSharePct: number | null;
  landValue: number | null;
  ancillaryCosts?: number | null;
}): {
  basis: number;
  buildingShare: number;
  fromPurchase: number;
  fromAncillary: number;
  ancillary: number;
} {
  let buildingShare = 0;
  let fromPurchase = 0;
  if (args.buildingValueSharePct != null && args.purchasePrice != null) {
    buildingShare = args.buildingValueSharePct;
    fromPurchase = args.purchasePrice * buildingShare;
  } else if (args.landValue != null && args.purchasePrice != null) {
    fromPurchase = Math.max(0, args.purchasePrice - args.landValue);
    buildingShare =
      args.purchasePrice > 0 ? fromPurchase / args.purchasePrice : 0;
  }
  const ancillary = args.ancillaryCosts ?? 0;
  const fromAncillary = ancillary * buildingShare;
  return {
    basis: fromPurchase + fromAncillary,
    buildingShare,
    fromPurchase,
    fromAncillary,
    ancillary,
  };
}

export function buildingAfaBasis(args: {
  purchasePrice: number | null;
  buildingValueSharePct: number | null;
  landValue: number | null;
  ancillaryCosts?: number | null;
}): number {
  return buildingAfaBreakdown(args).basis;
}
