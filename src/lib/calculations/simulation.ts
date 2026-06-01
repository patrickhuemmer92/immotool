/**
 * Simulation = Hochrechnung mit "Was-wäre-wenn"-Variablen relativ zum
 * Status-Quo eines Objekts. Operiert auf demselben Snapshot/Property/Loan-
 * Material wie `computeTaxProjection`, mutiert die Inputs aber pro Jahr
 * gemäß den Simulation-Parametern.
 *
 * Variablen (alle relativ zum Baseline-Snapshot, kompound über die Jahre):
 *   - rentGrowthPa     — Mieterhöhung p.a. (wirkt auf cold_rent + vacancy_risk_amount)
 *   - costGrowthPa     — Kostensteigerung p.a. (wirkt auf Hausgeld, Wartung,
 *                        Verwaltung, Rücklage)
 *   - interestChangeBps — Zinsänderung in Basispunkten, greift ab dem
 *                        Folgejahr des rate_lock_until eines Darlehens
 *                        (Anschlussfinanzierung mit Restschuld + neuer Zins).
 *   - additionalInvestments — extra Investitionen, die zur regulären
 *                        Investitionsliste hinzukommen.
 *
 * Output je Jahr: Baseline + Szenario nebeneinander, plus Delta.
 */

import {
  computeSnapshotResult,
  computeTaxProjection,
  resolveDepreciationStartYear,
  type InvestmentForProjection,
  type LoanForPnL,
  type PropertyForPnL,
  type SettingsForPnL,
  type SnapshotInputRow,
  type TaxProjectionRow,
} from "@/lib/pnl-context";
import { loanBalance } from "@/lib/calculations/loan";

export interface SimulationParams {
  /** Mieterhöhung p.a. — z. B. 0.02 für +2 % jährlich (compound). */
  rentGrowthPa: number;
  /** Kostensteigerung p.a. — z. B. 0.03 für +3 % jährlich (compound). */
  costGrowthPa: number;
  /** Zinsänderung in Basispunkten zur Anschlussfinanzierung (100 = +1 pp).
   *  Greift, sobald `calendarYear > rate_lock_until.year`. */
  interestChangeBps: number;
  /** Zusätzliche, in dieser Simulation eingeplante Investitionen — werden
   *  zu den realen Investments aus investment_plans hinzugefügt. */
  additionalInvestments: InvestmentForProjection[];
}

export interface SimulationProjectionRow {
  year: number;
  calendarYear: number;
  /** Status-Quo-Werte (ohne Simulation, identisch zu computeTaxProjection). */
  baseline: TaxProjectionRow;
  /** Szenario-Werte (mit Mieterhöhung/Kostensteigerung/Zinsänderung/extra). */
  scenario: TaxProjectionRow;
  /** Delta scenario.afterTaxCashflow − baseline.afterTaxCashflow. Positiv:
   *  Szenario ist besser als Status Quo. */
  cashflowDelta: number;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** v × (1 + r)^(n−1). Erstes Jahr (n=1) bleibt unverändert. */
function compound(value: number | null, ratePa: number, yearOffset: number): number | null {
  if (value == null) return null;
  if (ratePa === 0 || yearOffset <= 0) return value;
  return value * Math.pow(1 + ratePa, yearOffset);
}

/**
 * Skaliert die in einer SnapshotInputRow gehaltenen Kalt- und Kostenfelder
 * compound um die Wachstumsraten. yearOffset = (calendarYear − startYear).
 */
function scaleSnapshot(
  base: SnapshotInputRow,
  yearOffset: number,
  rentGrowth: number,
  costGrowth: number
): SnapshotInputRow {
  const scaleRent = (v: SnapshotInputRow[keyof SnapshotInputRow]) => {
    const n = num(v as string | number | null);
    const scaled = compound(n, rentGrowth, yearOffset);
    return scaled == null ? null : scaled;
  };
  const scaleCost = (v: SnapshotInputRow[keyof SnapshotInputRow]) => {
    const n = num(v as string | number | null);
    const scaled = compound(n, costGrowth, yearOffset);
    return scaled == null ? null : scaled;
  };
  return {
    ...base,
    cold_rent: scaleRent(base.cold_rent),
    ancillary_costs: scaleCost(base.ancillary_costs),
    property_fee_recoverable: scaleCost(base.property_fee_recoverable),
    property_fee_not_recoverable: scaleCost(base.property_fee_not_recoverable),
    maintenance: scaleCost(base.maintenance),
    management_costs: scaleCost(base.management_costs),
    // Ausfallwagnis skaliert mit Miete (es ist ein % der Miete in €-Form).
    vacancy_risk_amount: scaleRent(base.vacancy_risk_amount),
  };
}

/**
 * Erstellt eine refinanzierte Darlehens-Version, sobald rate_lock_until
 * verstrichen ist. Restschuld am Lock-Datum + neuer Zinssatz (alter +
 * bps/10000), gleiche Tilgungsrate p.a., neuer Beginn = Folgemonat.
 *
 * Für Jahre vor Lock-Ende oder ohne rate_lock_until bleibt der Loan original.
 */
function refinanceLoanForYear(
  loan: LoanForPnL,
  calendarYear: number,
  bpsChange: number
): LoanForPnL {
  if (bpsChange === 0) return loan;
  if (!loan.rate_lock_until) return loan;
  const lockDate = new Date(loan.rate_lock_until);
  const lockYear = lockDate.getUTCFullYear();
  // Erst ab dem Jahr NACH dem Lock-Ende refinanzieren (im Lock-Jahr selbst
  // greift noch die alte Zinsbindung).
  if (calendarYear <= lockYear) return loan;

  const restschuld = loanBalance(
    {
      loanAmount: Number(loan.loan_amount),
      interestRatePa: Number(loan.interest_rate_pa),
      amortizationPa: Number(loan.amortization_pa),
      firstPaymentDate: new Date(loan.first_payment_date),
      interestShareFirstRate:
        loan.interest_share_first_rate == null
          ? null
          : Number(loan.interest_share_first_rate),
    },
    lockDate,
    (loan.special_repayments ?? []).map((s) => ({
      date: new Date(s.payment_date),
      amount: Number(s.amount),
    }))
  );

  if (restschuld <= 0) return loan;

  const newRate = Number(loan.interest_rate_pa) + bpsChange / 10000;
  // Erste neue Rate: Monat nach Lock-Ende.
  const nextStart = new Date(
    Date.UTC(lockDate.getUTCFullYear(), lockDate.getUTCMonth() + 1, 1)
  );

  return {
    ...loan,
    loan_amount: restschuld,
    interest_rate_pa: Math.max(0, newRate),
    first_payment_date: nextStart.toISOString().slice(0, 10),
    interest_share_first_rate: null,
    // Restschuld berücksichtigt bereits etwaige Sondertilgungen bis lockDate.
    special_repayments: [],
    // Anschluss-Phase wird in v1 ohne weiteres rate_lock_until modelliert.
    rate_lock_until: null,
  };
}

// ---------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------

export function computeSimulationProjection(args: {
  snapshot: SnapshotInputRow;
  property: PropertyForPnL;
  loans: LoanForPnL[];
  settings: SettingsForPnL;
  /** Reale Investitionen (z. B. aus investment_plans). */
  investments?: InvestmentForProjection[];
  /** Simulation-Parameter. */
  simulation: SimulationParams;
  /** Welche Jahre projizieren? Default: TAX_PROJECTION_YEARS. */
  years?: readonly number[];
}): SimulationProjectionRow[] {
  const startYear = resolveDepreciationStartYear(args.property);
  if (startYear == null) return [];

  // 1) Baseline: gleiche Logik wie die "normale" Steuereffekt-Projektion.
  const baselineRows = computeTaxProjection({
    snapshot: args.snapshot,
    property: args.property,
    loans: args.loans,
    settings: args.settings,
    investments: args.investments ?? [],
    years: args.years,
  });

  const taxRate = Number(args.settings.tax_rate ?? 0);
  const buildingAfaRate =
    num(args.property.depreciation_rate) ??
    num(args.settings.default_depreciation_rate) ??
    0.02;

  // Investments fürs Szenario = real + zusätzlich
  const allInvestments: InvestmentForProjection[] = [
    ...(args.investments ?? []),
    ...args.simulation.additionalInvestments,
  ];

  // 2) Szenario: pro Jahr Snapshot/Loans mutieren, dann TaxProjection-Logik
  //    inline (wir brauchen mehr Kontrolle, also nicht über computeTaxProjection).
  const scenarioRows = baselineRows.map((baseRow) => {
    const calendarYear = baseRow.calendarYear;
    const yearOffset = calendarYear - startYear; // 0 fürs erste Jahr

    const start = `${calendarYear}-01-01`;
    const end = `${calendarYear}-12-01`;
    const scaledSnap: SnapshotInputRow = {
      ...scaleSnapshot(
        args.snapshot,
        yearOffset,
        args.simulation.rentGrowthPa,
        args.simulation.costGrowthPa
      ),
      period_start: start,
      period_end: end,
      annuity_override: null,
      interest_override: null,
      principal_override: null,
    };

    const adjustedLoans = args.loans.map((l) =>
      refinanceLoanForYear(l, calendarYear, args.simulation.interestChangeBps)
    );

    const r = computeSnapshotResult(
      scaledSnap,
      args.property,
      adjustedLoans,
      args.settings
    );

    const { deductible, cashOutflow } = investmentImpactForYear(
      allInvestments,
      calendarYear,
      buildingAfaRate
    );

    const cashflowBeforeTax = r.cashflowBeforeTax - cashOutflow;
    const pretaxProfit = r.pretaxProfit - deductible;
    const taxEffect = pretaxProfit * taxRate;
    // Gleiche Konvention wie Tax-Projection: zwei Sichten nebeneinander.
    //   afterTaxResult   = pretaxProfit  - taxEffect  (Buch-Sicht, mit AfA)
    //   afterTaxCashflow = cashflowBeforeTax - taxEffect (Cash-Sicht, mit Tilgung)
    const afterTaxResult = pretaxProfit - taxEffect;
    const afterTaxCashflow = cashflowBeforeTax - taxEffect;

    const scenario: TaxProjectionRow = {
      year: baseRow.year,
      calendarYear,
      interest: r.interest,
      principal: r.principal,
      depreciation: r.depreciation,
      investmentDeductible: deductible,
      investmentCashOutflow: cashOutflow,
      cashflowBeforeTax,
      pretaxProfit,
      taxEffect,
      afterTaxResult,
      afterTaxCashflow,
    };
    return scenario;
  });

  // 3) Pair baseline + scenario row für row
  return baselineRows.map((baseline, i) => {
    const scenario = scenarioRows[i];
    return {
      year: baseline.year,
      calendarYear: baseline.calendarYear,
      baseline,
      scenario,
      cashflowDelta: scenario.afterTaxCashflow - baseline.afterTaxCashflow,
    };
  });
}

// ---------------------------------------------------------------------
// Inline-Kopie der Investment-Impact-Logik (analog zu pnl-context).
// Wir vermeiden Re-Export der internen Funktion und duplizieren bewusst.
// ---------------------------------------------------------------------
function investmentImpactForYear(
  investments: InvestmentForProjection[],
  calendarYear: number,
  buildingAfaRate: number
): { deductible: number; cashOutflow: number } {
  let deductible = 0;
  let cashOutflow = 0;
  for (const inv of investments) {
    const yr = inv.year;
    if (yr == null) continue;
    const amount = Number(inv.amount ?? 0);
    if (amount <= 0) continue;
    const treatment = inv.tax_treatment ?? "expense_immediate";

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
      const years = buildingAfaRate > 0 ? Math.round(1 / buildingAfaRate) : 50;
      if (calendarYear >= yr && calendarYear < yr + years) {
        deductible += amount / years;
      }
    }
  }
  return { deductible, cashOutflow };
}
