/**
 * Strikte Output-Typen für den Dashboard-Aggregator. Jede Chart-Karte
 * konsumiert eine dieser Reihen — die Page selbst macht keine Rechen-
 * arbeit mehr, sie reicht die Daten nur durch.
 */

export type OwnerOption = {
  id: string;
  name: string;
};

export type DashboardTotals = {
  propertiesCount: number;
  marketValue: number;
  acquisitionTotal: number;
  remainingDebt: number;
  equity: number;
  coldRentAnnual: number;
  /** in %, null bis es einen Marktwert gibt. */
  ltvPct: number | null;
  /** in %, null bis es eine Anschaffung gibt. */
  grossYieldPct: number | null;
  /** Jahres-Cashflow nach Steuer aus den jüngsten Snapshots, summiert. */
  afterTaxCashflow: number;
};

export type CapitalStack = {
  debt: number;
  equity: number;
  acquisition: number;
  marketValue: number;
};

export type CapitalRow = {
  id: string;
  label: string;
  Restschuld: number;
  Eigenkapital: number;
};

export type OwnerSliceRow = {
  name: string;
  value: number;
};

export type CityRankingRow = {
  stadt: string;
  marktwert: number;
};

export type CashflowRow = {
  jahr: number;
  /** Brutto-Kaltmiete (Plan: aus Snapshot, Ist: aus Snapshot oder Schätzung). */
  kaltmiete: number | null;
  cfVor: number | null;
  cfNach: number | null;
  /** True, wenn dieser Eintrag in der Zukunft liegt (= Plan-Bereich). */
  isPlan: boolean;
};

export type LoanMaturityRow = {
  jahr: number;
  betrag: number;
};

export type DebtEquityRow = {
  jahr: number;
  restschuld: number;
  eigenkapital: number;
  isPlan: boolean;
};

export type AfaRow = {
  jahr: number;
  gebaude: number;
  beweglich: number;
  isPlan: boolean;
};

export type InvestmentRow = {
  jahr: number;
  sicher: number;
  eventuell: number;
};

export type DashboardData = {
  /** False → Empty-State (Onboarding-Stepper rendert die Page). */
  hasProperties: boolean;
  hasRealProperties: boolean;

  /** Workspace-weite Eigentümer-Liste für den Filter-Picker. */
  owners: OwnerOption[];
  activeOwnerId: string | null;

  /** Stichtag für die Topbar (aktuelles Datum). */
  asOfDate: string;

  /** Onboarding-Status — Stepper-Anzeige + nextStep im Greeting. */
  onboarding: {
    realPropertyCount: number;
    hasAnyLoan: boolean;
    hasAnyTenant: boolean;
    hasAnySnapshot: boolean;
    hasAnyValuation: boolean;
    firstRealPropertyId: string | null;
  };

  totals: DashboardTotals;
  capitalStack: CapitalStack;

  capitalByProperty: CapitalRow[];
  marketValueByOwner: OwnerSliceRow[];
  marketValueByCity: CityRankingRow[];
  cashflowOverTime: CashflowRow[];
  loanMaturities: LoanMaturityRow[];
  debtEquityTimeline: DebtEquityRow[];
  afaTimeline: AfaRow[];
  investmentPlan: InvestmentRow[];

  /** Letztes Ist-Jahr (Vergangenheit) — Chart-ReferenceLines zeichnen hier. */
  planCutYear: number;
};
