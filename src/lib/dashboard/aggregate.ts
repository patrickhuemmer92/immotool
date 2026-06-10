import { createClient } from "@/lib/supabase/server";
import { computeValuation } from "@/lib/calculations/valuation";
import { loanBalance, generateSchedule } from "@/lib/calculations/loan";
import { buildingAfaBasis } from "@/lib/calculations/pnl";
import {
  buildDepreciationParams,
  computeSnapshotResult,
  computeTaxProjection,
  type LoanForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { depreciationForCalendarYear } from "@/lib/calculations/depreciation";
import type {
  AfaRow,
  CapitalRow,
  CashflowRow,
  CityRankingRow,
  DashboardData,
  DebtEquityRow,
  InvestmentRow,
  LoanMaturityRow,
  OwnerSliceRow,
} from "./types";

/**
 * Server-side Daten-Aggregator für das Portfolio-Dashboard.
 *
 * - Ein Aufruf, ein Roundtrip — die Page-Komponente macht keine eigenen
 *   Berechnungen mehr, sie reicht das Ergebnis nur an die Charts durch.
 * - `ownerId` filtert vor der Aggregation: alle Objekte, an denen der
 *   gewählte Eigentümer einen Anteil hält, kommen unverkürzt in die
 *   Summen. Das spiegelt den Mock-up — der Filter sagt "zeig mir das
 *   Privat-Portfolio", nicht "zeig mir nur den Privatanteil pro Objekt".
 *   (Owner-Splits gibt es ohnehin nur für den Pie-Slice "Marktwert nach
 *   Eigentümer", dort wird ownership_share angewendet.)
 */

const PROJECTION_YEARS = 30;
const LOAN_PROJECTION_HORIZON_YEARS = 30;
const AFA_HORIZON_YEARS = 12;

type PropertyRow = {
  id: string;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  location_detail: string | null;
  sqm: string | number | null;
  land_value: string | number | null;
  purchase_price: string | number | null;
  transfer_date: string | null;
  transfer_tax: string | number | null;
  broker_fee: string | number | null;
  notary_fee: string | number | null;
  registration_cost: string | number | null;
  equity_amount: string | number | null;
  is_demo: boolean | null;
  building_value_share_pct: string | number | null;
  depreciation_rate: string | number | null;
  depreciation_method: string | null;
  depreciation_start_year: number | null;
  sonder_7b_basis_limit: string | number | null;
  portfolio_valuations: ValuationRow[] | null;
  loans: LoanRow[] | null;
  pnl_snapshots: SnapshotInputRow[] | null;
  property_owners:
    | Array<{
        owner_id: string;
        ownership_share: string | number;
      }>
    | null;
  investment_plans: InvestmentPlanRow[] | null;
  other_depreciation_items: OtherDepRow[] | null;
};

type ValuationRow = {
  valuation_date: string;
  market_rent_per_sqm: string | number | null;
  multiple: string | number | null;
  building_value: string | number | null;
  land_value: string | number | null;
  income_weight: string | number | null;
};

type LoanRow = {
  loan_amount: string | number;
  interest_rate_pa: string | number;
  amortization_pa: string | number;
  first_payment_date: string;
  interest_share_first_rate: string | number | null;
  rate_lock_until: string | null;
  special_repayments:
    | Array<{ payment_date: string; amount: string | number }>
    | null;
};

type InvestmentPlanRow = {
  year: number | null;
  is_long_term: boolean;
  amount: string | number;
  measure_type:
    | "fixed_individual"
    | "optional_individual"
    | "fixed_common_reserve"
    | "fixed_common_levy"
    | "optional_common_reserve"
    | "optional_common_levy";
};

type OtherDepRow = {
  acquisition_cost: string | number;
  acquisition_date: string;
  duration_years: number;
};

type SettingsRow = {
  tax_rate: number | string | null;
  default_depreciation_rate: number | string | null;
};

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ */
/*  Hauptfunktion                                                      */
/* ------------------------------------------------------------------ */

export async function aggregateDashboard(
  workspaceId: string,
  ownerId: string | null
): Promise<DashboardData> {
  const supabase = await createClient();

  const [propsRes, ownersRes, tenantsRes, settingsRes] = await Promise.all([
    supabase
      .from("properties")
      .select(
        `id, street, postal_code, city, location_detail, sqm, land_value,
         purchase_price, transfer_date, transfer_tax, broker_fee, notary_fee,
         registration_cost, equity_amount, is_demo, building_value_share_pct,
         depreciation_rate, depreciation_method, depreciation_start_year,
         sonder_7b_basis_limit,
         portfolio_valuations(valuation_date, market_rent_per_sqm, multiple,
           building_value, land_value, income_weight),
         loans(loan_amount, interest_rate_pa, amortization_pa, first_payment_date,
           interest_share_first_rate, rate_lock_until,
           special_repayments(payment_date, amount)),
         pnl_snapshots(id, period_start, period_end, cold_rent, ancillary_costs,
           property_fee_recoverable, property_fee_not_recoverable, maintenance,
           annuity_override, interest_override, principal_override),
         property_owners(owner_id, ownership_share),
         investment_plans(year, is_long_term, amount, measure_type),
         other_depreciation_items(acquisition_cost, acquisition_date, duration_years)`
      )
      .eq("workspace_id", workspaceId),
    supabase
      .from("owners")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .order("name"),
    supabase
      .from("tenants")
      .select(
        "property_id, cold_rent_per_month, is_fixed_term, contract_end, properties!inner(workspace_id)"
      )
      .eq("properties.workspace_id", workspaceId),
    supabase
      .from("settings")
      .select("tax_rate, default_depreciation_rate")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  const allProperties = (propsRes.data ?? []) as PropertyRow[];
  const ownersAll = (ownersRes.data ?? []) as Array<{ id: string; name: string }>;
  const tenantsAll = (tenantsRes.data ?? []) as Array<{
    property_id: string;
    cold_rent_per_month: string | number | null;
    is_fixed_term: boolean | null;
    contract_end: string | null;
  }>;
  const settings = (settingsRes.data ?? null) as SettingsRow | null;
  const settingsForCalc = {
    tax_rate: num(settings?.tax_rate ?? 0.35),
    default_depreciation_rate: num(settings?.default_depreciation_rate ?? 0.02),
  };

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const currentYear = today.getUTCFullYear();

  // Owner-Filter — properties.property_owners enthält owner_id-Liste.
  const propertiesScoped = ownerId
    ? allProperties.filter((p) =>
        (p.property_owners ?? []).some((po) => po.owner_id === ownerId)
      )
    : allProperties;

  // Empty-State direkt zurück, wenn der Workspace null Objekte hat — die
  // Page rendert dann nur den Onboarding-Stepper.
  if (propertiesScoped.length === 0) {
    return emptyResult(ownersAll, ownerId, todayIso, allProperties.length);
  }

  /* ---------- Kennzahlen pro Property vorrechnen ---------- */
  const enriched = propertiesScoped.map((p) => {
    const sqm = numOrNull(p.sqm);
    const purchase = num(p.purchase_price);
    const ancillary =
      num(p.transfer_tax) +
      num(p.broker_fee) +
      num(p.notary_fee) +
      num(p.registration_cost);
    const acquisitionTotal = purchase + ancillary;

    const valuations = (p.portfolio_valuations ?? [])
      .slice()
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date));
    const latestVal = valuations[0];

    let marketValue: number | null = null;
    if (latestVal) {
      const r = computeValuation(
        {
          sqm,
          marketRentPerSqm: numOrNull(latestVal.market_rent_per_sqm),
          multiple: numOrNull(latestVal.multiple),
          landValue:
            numOrNull(latestVal.land_value) ?? numOrNull(p.land_value),
          buildingValue: numOrNull(latestVal.building_value),
        },
        numOrNull(latestVal.income_weight) ?? 0.5
      );
      marketValue = r.combined;
    }

    const loans = (p.loans ?? []) as LoanRow[];
    const loanInputs = loans.map((l) => ({
      loan: {
        loanAmount: num(l.loan_amount),
        interestRatePa: num(l.interest_rate_pa),
        amortizationPa: num(l.amortization_pa),
        firstPaymentDate: new Date(l.first_payment_date),
        interestShareFirstRate: numOrNull(l.interest_share_first_rate),
      },
      rateLockUntil: l.rate_lock_until ? new Date(l.rate_lock_until) : null,
      specials: (l.special_repayments ?? []).map((s) => ({
        date: new Date(s.payment_date),
        amount: num(s.amount),
      })),
    }));

    const remainingDebtToday = loanInputs.reduce(
      (acc, li) => acc + loanBalance(li.loan, today, li.specials),
      0
    );

    const equity =
      marketValue != null ? Math.max(0, marketValue - remainingDebtToday) : 0;

    const city = (p.city ?? "").toString().trim() || "—";
    const label = (p.street ?? city).toString().trim() || p.id.slice(0, 6);

    return {
      raw: p,
      sqm,
      purchase,
      ancillary,
      acquisitionTotal,
      marketValue,
      loanInputs,
      remainingDebtToday,
      equity,
      city,
      label,
    };
  });

  /* ---------- Eigentümer-Filter: Owner-Liste ---------- */
  const owners = ownersAll;
  const activeOwnerId =
    ownerId && owners.some((o) => o.id === ownerId) ? ownerId : null;

  /* ---------- Onboarding-State ---------- */
  const realProperties = enriched.filter((e) => !e.raw.is_demo);
  const firstReal = realProperties[0]?.raw ?? null;
  const hasAnyLoan = enriched.some((e) => e.loanInputs.length > 0);
  const hasAnySnapshot = enriched.some(
    (e) => (e.raw.pnl_snapshots ?? []).length > 0
  );
  const hasAnyValuation = enriched.some(
    (e) => (e.raw.portfolio_valuations ?? []).length > 0
  );

  /* ---------- KPI-Summen ---------- */
  const totalMarketValue = enriched.reduce(
    (acc, e) => acc + (e.marketValue ?? 0),
    0
  );
  const totalAcquisition = enriched.reduce(
    (acc, e) => acc + e.acquisitionTotal,
    0
  );
  const totalRemainingDebt = enriched.reduce(
    (acc, e) => acc + e.remainingDebtToday,
    0
  );
  const totalEquity = enriched.reduce((acc, e) => acc + e.equity, 0);

  // Kaltmiete: aktive Mieter, scoped auf die gefilterten properties.
  const scopedIds = new Set(enriched.map((e) => e.raw.id));
  let coldRentAnnual = 0;
  for (const tr of tenantsAll) {
    if (!scopedIds.has(tr.property_id)) continue;
    const isActive =
      !tr.is_fixed_term ||
      !tr.contract_end ||
      tr.contract_end >= todayIso;
    if (!isActive) continue;
    coldRentAnnual += num(tr.cold_rent_per_month) * 12;
  }

  /* ---------- Cashflow nach Steuer + Multi-Year-Projektion ---------- */
  // Kaltmiete projizieren wir als konstant aus dem jeweiligen Snapshot
  // hoch — keine Mietsteigerungs-Annahme, das wäre sonst eine versteckte
  // Prämisse. Pre-Tax + After-Tax kommen direkt aus computeTaxProjection.
  type Proj = {
    year: number;
    afterTax: number;
    preTax: number;
    coldRent: number;
  };
  const projectionByYear = new Map<number, Proj>();
  const projectionRanges: Array<{ min: number; max: number }> = [];
  let afterTaxCashflowCurrent = 0;

  for (const e of enriched) {
    const snaps = (e.raw.pnl_snapshots ?? [])
      .slice()
      .sort((a, b) => b.period_end.localeCompare(a.period_end));
    const latestSnap = snaps[0];
    if (!latestSnap) continue;
    const loansForPnL = (e.raw.loans ?? []) as LoanForPnL[];
    const r = computeSnapshotResult(
      latestSnap,
      e.raw,
      loansForPnL,
      settingsForCalc
    );
    afterTaxCashflowCurrent += r.afterTaxCashflow;

    const snapAnnualColdRent = num(latestSnap.cold_rent) * 12;

    const proj = computeTaxProjection({
      snapshot: latestSnap,
      property: e.raw,
      loans: loansForPnL,
      settings: settingsForCalc,
      years: Array.from({ length: PROJECTION_YEARS }, (_, i) => i + 1),
    });
    if (proj.length > 0) {
      const ys = proj.map((row) => row.calendarYear);
      projectionRanges.push({ min: Math.min(...ys), max: Math.max(...ys) });
    }
    for (const row of proj) {
      const acc = projectionByYear.get(row.calendarYear) ?? {
        year: row.calendarYear,
        afterTax: 0,
        preTax: 0,
        coldRent: 0,
      };
      acc.afterTax += row.afterTaxCashflow;
      acc.preTax += row.cashflowBeforeTax;
      acc.coldRent += snapAnnualColdRent;
      projectionByYear.set(row.calendarYear, acc);
    }
  }

  // Cliff-Fix: nur Jahre behalten, in denen ALLE projizierenden Properties
  // mitliefern — verhindert Aggregations-Sprünge an den Rändern, wenn die
  // Objekte unterschiedliche transfer_date haben.
  const overlapMin = projectionRanges.length
    ? Math.max(...projectionRanges.map((r) => r.min))
    : Number.POSITIVE_INFINITY;
  const overlapMax = projectionRanges.length
    ? Math.min(...projectionRanges.map((r) => r.max))
    : Number.NEGATIVE_INFINITY;
  const cashflowOverTime: CashflowRow[] = Array.from(projectionByYear.values())
    .filter((v) => v.year >= overlapMin && v.year <= overlapMax)
    .sort((a, b) => a.year - b.year)
    .map((v) => ({
      jahr: v.year,
      kaltmiete: v.coldRent || null,
      cfVor: v.preTax,
      cfNach: v.afterTax,
      isPlan: v.year > currentYear,
    }));

  /* ---------- Capital-Stack pro Objekt (Chart 1) ---------- */
  const capitalByProperty: CapitalRow[] = enriched
    .filter((e) => e.marketValue != null && e.marketValue > 0)
    .sort(
      (a, b) =>
        (b.marketValue ?? 0) - (a.marketValue ?? 0)
    )
    .map((e) => ({
      id: e.raw.id,
      label: shortLabel(e.label),
      Restschuld: round(e.remainingDebtToday),
      Eigenkapital: round(e.equity),
    }));

  /* ---------- Marktwert nach Eigentümer (Chart 2a) ---------- */
  // Pro Property: marketValue * ownership_share je Eigentümer summieren.
  // Das gewichtet im Pie korrekt; bei mehreren Owners pro Objekt würde der
  // ungefilterte Datensatz sonst alles doppelt zeigen.
  const ownerNameById = new Map<string, string>();
  for (const o of ownersAll) ownerNameById.set(o.id, o.name);
  const marketValueByOwnerMap = new Map<string, number>();
  for (const e of enriched) {
    if (e.marketValue == null) continue;
    const links = e.raw.property_owners ?? [];
    if (links.length === 0) {
      marketValueByOwnerMap.set(
        "—",
        (marketValueByOwnerMap.get("—") ?? 0) + e.marketValue
      );
      continue;
    }
    for (const link of links) {
      const share = num(link.ownership_share);
      const slice = e.marketValue * share;
      const name = ownerNameById.get(link.owner_id) ?? "—";
      marketValueByOwnerMap.set(
        name,
        (marketValueByOwnerMap.get(name) ?? 0) + slice
      );
    }
  }
  const marketValueByOwner: OwnerSliceRow[] = Array.from(
    marketValueByOwnerMap.entries()
  )
    .map(([name, value]) => ({ name, value: round(value) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  /* ---------- Marktwert nach Stadt (Chart 2b) ---------- */
  const cityMap = new Map<string, number>();
  for (const e of enriched) {
    if (e.marketValue == null) continue;
    cityMap.set(e.city, (cityMap.get(e.city) ?? 0) + e.marketValue);
  }
  const marketValueByCity: CityRankingRow[] = Array.from(cityMap.entries())
    .map(([stadt, marktwert]) => ({ stadt, marktwert: round(marktwert) }))
    .sort((a, b) => b.marktwert - a.marktwert);

  /* ---------- Darlehensfälligkeiten (Chart 4a) ---------- */
  // Pro Loan: rate_lock_until + Restschuld zum Zinsbindungs-Ende. Wir
  // bauen einen Plan-Schedule auf, der auch zukünftig läuft (sonst gibt
  // loanBalance den startwert für rate_lock_until in der Zukunft zurück).
  const maturityMap = new Map<number, number>();
  for (const e of enriched) {
    for (const li of e.loanInputs) {
      if (!li.rateLockUntil) continue;
      const balance = projectLoanBalanceAt(
        li.loan,
        li.rateLockUntil,
        li.specials
      );
      if (balance <= 0) continue;
      const y = li.rateLockUntil.getUTCFullYear();
      maturityMap.set(y, (maturityMap.get(y) ?? 0) + balance);
    }
  }
  const loanMaturities: LoanMaturityRow[] = Array.from(maturityMap.entries())
    .map(([jahr, betrag]) => ({ jahr, betrag: round(betrag) }))
    .sort((a, b) => a.jahr - b.jahr);

  /* ---------- Restschuld + Eigenkapital-Entwicklung (Chart 4b) ---------- */
  // Restschuld pro Kalenderjahr (Jahresende) aus loan schedules.
  // Eigenkapital = aktueller Marktwert − Restschuld (Marktwert wird nicht
  // projiziert — wir nehmen den heutigen Wert als konstant; das ist die
  // konservative Standard-Sicht ohne Wertsteigerungs-Annahme).
  const debtByYear = new Map<number, number>();
  for (let yOffset = -5; yOffset <= LOAN_PROJECTION_HORIZON_YEARS; yOffset++) {
    const year = currentYear + yOffset;
    const targetDate = new Date(Date.UTC(year, 11, 31));
    let sum = 0;
    for (const e of enriched) {
      for (const li of e.loanInputs) {
        sum += projectLoanBalanceAt(li.loan, targetDate, li.specials);
      }
    }
    debtByYear.set(year, sum);
  }
  const debtEquityTimeline: DebtEquityRow[] = Array.from(debtByYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, debt]) => ({
      jahr: year,
      restschuld: round(debt),
      eigenkapital: round(Math.max(0, totalMarketValue - debt)),
      isPlan: year > currentYear,
    }));

  /* ---------- AfA-Zeitverlauf (Chart 5) ---------- */
  // Pro Property + Gebäude-Methode → jährliche AfA. Plus other_depreciation_items
  // (bewegliche WG, linear über duration_years).
  const afaMap = new Map<number, { gebaude: number; beweglich: number }>();
  const afaWindowStart = currentYear - 2;
  const afaWindowEnd = currentYear + AFA_HORIZON_YEARS;

  for (const e of enriched) {
    const startYear =
      e.raw.depreciation_start_year ??
      (e.raw.transfer_date
        ? new Date(e.raw.transfer_date).getUTCFullYear()
        : currentYear);
    const afaBasis = buildingAfaBasis({
      purchasePrice: e.purchase,
      buildingValueSharePct: numOrNull(e.raw.building_value_share_pct),
      landValue: numOrNull(e.raw.land_value),
      ancillaryCosts: e.ancillary || null,
    });
    const dp = buildDepreciationParams(e.raw, settingsForCalc, afaBasis);
    if (dp != null) {
      for (let y = afaWindowStart; y <= afaWindowEnd; y++) {
        const dy = depreciationForCalendarYear(dp, startYear, y);
        const cur = afaMap.get(y) ?? { gebaude: 0, beweglich: 0 };
        cur.gebaude += dy.total;
        afaMap.set(y, cur);
      }
    }
    for (const od of e.raw.other_depreciation_items ?? []) {
      const acq = new Date(od.acquisition_date);
      const acqYear = acq.getUTCFullYear();
      const lastYear = acqYear + od.duration_years - 1;
      const annual = num(od.acquisition_cost) / Math.max(1, od.duration_years);
      for (let y = afaWindowStart; y <= afaWindowEnd; y++) {
        if (y < acqYear || y > lastYear) continue;
        const cur = afaMap.get(y) ?? { gebaude: 0, beweglich: 0 };
        cur.beweglich += annual;
        afaMap.set(y, cur);
      }
    }
  }
  const afaTimeline: AfaRow[] = Array.from(afaMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, v]) => ({
      jahr,
      gebaude: round(v.gebaude),
      beweglich: round(v.beweglich),
      isPlan: jahr > currentYear,
    }));

  /* ---------- Investitionsplan (Chart 6) ---------- */
  // measure_type → Sicher (fixed_*) vs. Eventuell (optional_*). is_long_term
  // → in den Topf des nächsten Jahres rollen (keine konkrete Jahresangabe).
  const invMap = new Map<number, { sicher: number; eventuell: number }>();
  for (const e of enriched) {
    for (const ip of e.raw.investment_plans ?? []) {
      const year =
        ip.is_long_term || ip.year == null ? currentYear + 1 : ip.year;
      const amount = num(ip.amount);
      const isSicher = ip.measure_type.startsWith("fixed_");
      const cur = invMap.get(year) ?? { sicher: 0, eventuell: 0 };
      if (isSicher) cur.sicher += amount;
      else cur.eventuell += amount;
      invMap.set(year, cur);
    }
  }
  const investmentPlan: InvestmentRow[] = Array.from(invMap.entries())
    .filter(([y]) => y >= currentYear)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 8)
    .map(([jahr, v]) => ({
      jahr,
      sicher: round(v.sicher),
      eventuell: round(v.eventuell),
    }));

  /* ---------- Totals & Stack ---------- */
  const ltvPct =
    totalMarketValue > 0 ? (totalRemainingDebt / totalMarketValue) * 100 : null;
  const grossYieldPct =
    totalAcquisition > 0 ? (coldRentAnnual / totalAcquisition) * 100 : null;

  return {
    hasProperties: true,
    hasRealProperties: realProperties.length > 0,
    owners,
    activeOwnerId,
    asOfDate: todayIso,
    onboarding: {
      realPropertyCount: realProperties.length,
      hasAnyLoan,
      hasAnyTenant: tenantsAll.some((t) => scopedIds.has(t.property_id)),
      hasAnySnapshot,
      hasAnyValuation,
      firstRealPropertyId: firstReal?.id ?? null,
    },
    totals: {
      propertiesCount: enriched.length,
      marketValue: round(totalMarketValue),
      acquisitionTotal: round(totalAcquisition),
      remainingDebt: round(totalRemainingDebt),
      equity: round(totalEquity),
      coldRentAnnual: round(coldRentAnnual),
      ltvPct,
      grossYieldPct,
      afterTaxCashflow: round(afterTaxCashflowCurrent),
    },
    capitalStack: {
      debt: round(totalRemainingDebt),
      equity: round(totalEquity),
      acquisition: round(totalAcquisition),
      marketValue: round(totalMarketValue),
    },
    capitalByProperty,
    marketValueByOwner,
    marketValueByCity,
    cashflowOverTime,
    loanMaturities,
    debtEquityTimeline,
    afaTimeline,
    investmentPlan,
    planCutYear: currentYear,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function shortLabel(s: string): string {
  // "Designstraße 10, 90411 Nürnberg" → "Designstraße 10"
  const split = s.split(",")[0]?.trim() ?? s;
  if (split.length <= 22) return split;
  return split.slice(0, 20) + "…";
}

/**
 * Restschuld zum Stichtag — auch wenn der Stichtag in der ZUKUNFT liegt.
 * loanBalance() läuft bis dort durch und gibt 0 zurück, sobald der Kredit
 * getilgt ist. Vor dem first_payment_date wird der Startsaldo retourniert.
 */
function projectLoanBalanceAt(
  loan: Parameters<typeof loanBalance>[0],
  atDate: Date,
  specials: Array<{ date: Date; amount: number }>
): number {
  if (atDate.getTime() < loan.firstPaymentDate.getTime()) {
    return loan.loanAmount;
  }
  const schedule = generateSchedule(loan, {
    untilDate: atDate,
    specialRepayments: specials,
  });
  if (schedule.length === 0) return loan.loanAmount;
  return schedule[schedule.length - 1].balance;
}

function emptyResult(
  owners: Array<{ id: string; name: string }>,
  ownerId: string | null,
  asOfDate: string,
  totalPropertyCountBeforeFilter: number
): DashboardData {
  return {
    hasProperties: totalPropertyCountBeforeFilter > 0,
    hasRealProperties: false,
    owners,
    activeOwnerId: ownerId && owners.some((o) => o.id === ownerId) ? ownerId : null,
    asOfDate,
    onboarding: {
      realPropertyCount: 0,
      hasAnyLoan: false,
      hasAnyTenant: false,
      hasAnySnapshot: false,
      hasAnyValuation: false,
      firstRealPropertyId: null,
    },
    totals: {
      propertiesCount: 0,
      marketValue: 0,
      acquisitionTotal: 0,
      remainingDebt: 0,
      equity: 0,
      coldRentAnnual: 0,
      ltvPct: null,
      grossYieldPct: null,
      afterTaxCashflow: 0,
    },
    capitalStack: { debt: 0, equity: 0, acquisition: 0, marketValue: 0 },
    capitalByProperty: [],
    marketValueByOwner: [],
    marketValueByCity: [],
    cashflowOverTime: [],
    loanMaturities: [],
    debtEquityTimeline: [],
    afaTimeline: [],
    investmentPlan: [],
    planCutYear: new Date().getUTCFullYear(),
  };
}
