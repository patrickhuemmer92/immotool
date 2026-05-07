export type LoanInput = {
  loanAmount: number;
  interestRatePa: number;
  amortizationPa: number;
  firstPaymentDate: Date;
  /** Optional: explicit interest portion of the first payment (Bankform). */
  interestShareFirstRate?: number | null;
};

export type SpecialRepayment = {
  date: Date;
  amount: number;
};

export type ScheduleEntry = {
  date: Date;
  payment: number;
  interest: number;
  principal: number;
  specialRepayment: number;
  balance: number;
};

/**
 * Deutsche Bankformel: A_monatlich = loan * (i + t) / 12.
 * Konstante Annuität, Anfangstilgung in % p.a.
 */
export function monthlyAnnuity(loan: LoanInput): number {
  return (loan.loanAmount * (loan.interestRatePa + loan.amortizationPa)) / 12;
}

/** Monatlicher Nominalzins (i / 12). */
export function monthlyInterestRate(loan: LoanInput): number {
  return loan.interestRatePa / 12;
}

/**
 * Aufteilung Zins/Tilgung für genau eine Rate gegen einen Restschuldstand.
 * Gibt die letzte Rate auf den exakten 0-Stand zurück (clamp).
 */
export function monthlySplit(
  loan: LoanInput,
  balanceBefore: number
): { interest: number; principal: number; payment: number } {
  const annuity = monthlyAnnuity(loan);
  const interest = balanceBefore * monthlyInterestRate(loan);
  let principal = annuity - interest;
  if (principal > balanceBefore) principal = balanceBefore;
  return { interest, principal, payment: interest + principal };
}

/**
 * Erzeugt einen Tilgungsplan ab firstPaymentDate bis untilDate (inklusive Monat).
 * Sondertilgungen werden im Monat ihres Datums vom Restschuldstand nach der
 * regulären Tilgung abgezogen.
 */
export function generateSchedule(
  loan: LoanInput,
  options: {
    untilDate: Date;
    specialRepayments?: SpecialRepayment[];
  }
): ScheduleEntry[] {
  const annuity = monthlyAnnuity(loan);
  const iM = monthlyInterestRate(loan);
  const specials = (options.specialRepayments ?? [])
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const entries: ScheduleEntry[] = [];
  let balance = loan.loanAmount;
  let cursor = startOfMonth(loan.firstPaymentDate);
  const target = startOfMonth(options.untilDate);
  let isFirst = true;

  while (cursor.getTime() <= target.getTime() && balance > 0.005) {
    const interest =
      isFirst && loan.interestShareFirstRate != null
        ? loan.interestShareFirstRate
        : balance * iM;
    let principal = annuity - interest;
    if (principal < 0) principal = 0;
    if (principal > balance) principal = balance;
    let newBalance = balance - principal;

    const specialSum = specials
      .filter((s) => isSameMonth(s.date, cursor))
      .reduce((acc, s) => acc + s.amount, 0);
    const appliedSpecial = Math.min(specialSum, newBalance);
    newBalance -= appliedSpecial;

    entries.push({
      date: new Date(cursor),
      payment: interest + principal,
      interest,
      principal,
      specialRepayment: appliedSpecial,
      balance: newBalance,
    });
    balance = newBalance;
    cursor = addMonths(cursor, 1);
    isFirst = false;
  }

  return entries;
}

/**
 * Restschuld zum Stichtag (inklusive: Tilgungen bis einschließlich Monat von atDate).
 */
export function loanBalance(
  loan: LoanInput,
  atDate: Date,
  specialRepayments: SpecialRepayment[] = []
): number {
  if (atDate.getTime() < startOfMonth(loan.firstPaymentDate).getTime()) {
    return loan.loanAmount;
  }
  const schedule = generateSchedule(loan, {
    untilDate: atDate,
    specialRepayments,
  });
  if (schedule.length === 0) return loan.loanAmount;
  return schedule[schedule.length - 1].balance;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function isSameMonth(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  );
}
