import { createClient } from "@/lib/supabase/server";
import { computeValuation } from "@/lib/calculations/valuation";
import { loanBalance, monthlyAnnuity } from "@/lib/calculations/loan";
import {
  computeSnapshotBankView,
  computeSnapshotResult,
  type LoanForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { formatPropertyAddress } from "@/lib/properties";
import { dateDe } from "@/lib/format";

export type PdfImage = {
  storage_path: string;
  category: string;
  caption: string | null;
  is_cover: boolean;
  signedUrl: string | null;
};

export type PdfPropertyData = {
  property: {
    id: string;
    address: string;
    unit_number: string | null;
    sqm: number | null;
    purchase_price: number | null;
    transfer_date: string | null;
  };
  owners: { id: string; name: string; share: number }[];
  loans: {
    id: string;
    designation: string;
    bank: string | null;
    loan_amount: number;
    interest_rate_pa: number;
    amortization_pa: number;
    monthly_annuity: number;
    remaining_balance: number;
  }[];
  totalRemaining: number;
  totalAnnuity: number;
  tenant: {
    name: string;
    contract_start: string | null;
    contract_end: string | null;
    is_fixed_term: boolean;
    cold_rent_per_month: number | null;
    ancillary_costs_per_month: number | null;
    /** €/m² Kaltmiete — derived from cold rent / sqm, null if either is missing. */
    rent_per_sqm: number | null;
  } | null;
  latestPnL: {
    period: string;
    rentTotal: number;
    operatingCosts: number;
    interest: number;
    principal: number;
    depreciation: number;
    cashflowBeforeTax: number;
    pretaxProfit: number;
    taxEffect: number;
    afterTaxCashflow: number;
  } | null;
  /**
   * Bank-Sicht (banker view) of the latest snapshot — NOI, debt service,
   * ICR. Surfaced separately so the Factbook can show what a credit officer
   * looks at without bleeding the investor's tax effects into the page.
   */
  bankView: {
    rentEffective: number;
    noi: number;
    debtService: number;
    icr: number | null;
    cashflowBeforeTax: number;
  } | null;
  pnlSnapshots: {
    period: string;
    rentTotal: number;
    afterTaxCashflow: number;
  }[];
  latestValuation: {
    valuation_date: string;
    ertragswert: number | null;
    sachwert: number | null;
    combined: number | null;
  } | null;
  investments: {
    year: number | null;
    is_long_term: boolean;
    amount: number;
    description: string | null;
    measure_type: string;
  }[];
  images: PdfImage[];
};

export async function fetchPropertyForPdf(
  propertyId: string,
  workspaceId: string
): Promise<PdfPropertyData | null> {
  const supabase = await createClient();
  const [
    { data: property },
    { data: owners },
    { data: loans },
    { data: tenant },
    { data: snapshots },
    { data: valuations },
    { data: investments },
    { data: images },
    { data: settings },
  ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", propertyId).maybeSingle(),
    supabase
      .from("property_owners")
      .select("ownership_share, owner:owners!inner(id, name)")
      .eq("property_id", propertyId),
    supabase
      .from("loans")
      .select(
        "id, designation, bank, loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate, special_repayments(payment_date, amount)"
      )
      .eq("property_id", propertyId),
    supabase
      .from("tenants")
      .select(
        "name, contract_start, is_fixed_term, contract_end, cold_rent_per_month, ancillary_costs_per_month"
      )
      .eq("property_id", propertyId)
      .maybeSingle(),
    supabase
      .from("pnl_snapshots")
      .select("*")
      .eq("property_id", propertyId)
      .order("period_end", { ascending: false }),
    supabase
      .from("portfolio_valuations")
      .select(
        "id, valuation_date, market_rent_per_sqm, multiple, building_value, land_value, income_weight"
      )
      .eq("property_id", propertyId)
      .order("valuation_date", { ascending: false })
      .limit(1),
    supabase
      .from("investment_plans")
      .select("year, is_long_term, amount, description, measure_type")
      .eq("property_id", propertyId)
      .order("is_long_term")
      .order("year"),
    supabase
      .from("property_images")
      .select("storage_path, category, caption, is_cover")
      .eq("property_id", propertyId)
      .order("is_cover", { ascending: false })
      .order("display_order")
      .limit(8),
    supabase
      .from("settings")
      .select("tax_rate, default_depreciation_rate")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  if (!property) return null;

  const today = new Date();
  const settingsForCalc = settings ?? {
    tax_rate: 0.35,
    default_depreciation_rate: 0.02,
  };

  const loanRefs = (loans ?? []) as LoanForPnL[];
  let totalRemaining = 0;
  let totalAnnuity = 0;
  const loansResolved: PdfPropertyData["loans"] = [];

  for (const l of (loans ?? []) as (LoanForPnL & {
    id: string;
    designation: string;
    bank: string | null;
  })[]) {
    const input = {
      loanAmount: Number(l.loan_amount),
      interestRatePa: Number(l.interest_rate_pa),
      amortizationPa: Number(l.amortization_pa),
      firstPaymentDate: new Date(l.first_payment_date),
      interestShareFirstRate:
        l.interest_share_first_rate == null
          ? null
          : Number(l.interest_share_first_rate),
    };
    const remaining = loanBalance(
      input,
      today,
      (l.special_repayments ?? []).map((s) => ({
        date: new Date(s.payment_date),
        amount: Number(s.amount),
      }))
    );
    const annuity = monthlyAnnuity(input);
    totalRemaining += remaining;
    totalAnnuity += annuity;
    loansResolved.push({
      id: l.id,
      designation: l.designation,
      bank: l.bank,
      loan_amount: Number(l.loan_amount),
      interest_rate_pa: Number(l.interest_rate_pa),
      amortization_pa: Number(l.amortization_pa),
      monthly_annuity: annuity,
      remaining_balance: remaining,
    });
  }

  const latestSnapshot = (snapshots ?? [])[0];
  const latestPnL = latestSnapshot
    ? (() => {
        const r = computeSnapshotResult(
          latestSnapshot as SnapshotInputRow,
          property,
          loanRefs,
          settingsForCalc
        );
        return {
          period: `${dateDe(latestSnapshot.period_start)} – ${dateDe(latestSnapshot.period_end)}`,
          rentTotal: r.rentTotal,
          operatingCosts: r.operatingCosts,
          interest: r.interest,
          principal: r.principal,
          depreciation: r.depreciation,
          cashflowBeforeTax: r.cashflowBeforeTax,
          pretaxProfit: r.pretaxProfit,
          taxEffect: r.taxEffect,
          afterTaxCashflow: r.afterTaxCashflow,
        };
      })()
    : null;
  const bankView = latestSnapshot
    ? (() => {
        const b = computeSnapshotBankView(
          latestSnapshot as SnapshotInputRow,
          property,
          loanRefs,
          settingsForCalc
        );
        return {
          rentEffective: b.rentEffective,
          noi: b.noi,
          debtService: b.debtService,
          icr: b.icr,
          cashflowBeforeTax: b.cashflowBeforeTax,
        };
      })()
    : null;

  const pnlSnapshots = (snapshots ?? []).map((s) => {
    const r = computeSnapshotResult(
      s as SnapshotInputRow,
      property,
      loanRefs,
      settingsForCalc
    );
    return {
      period: `${dateDe(s.period_start)} – ${dateDe(s.period_end)}`,
      rentTotal: r.rentTotal,
      afterTaxCashflow: r.afterTaxCashflow,
    };
  });

  const latestValuation = (valuations ?? [])[0] as
    | {
        id: string;
        valuation_date: string;
        market_rent_per_sqm: string | number | null;
        multiple: string | number | null;
        building_value: string | number | null;
        land_value: string | number | null;
        income_weight: string | number | null;
      }
    | undefined;
  const valuationResult = latestValuation
    ? computeValuation(
        {
          sqm: property.sqm == null ? null : Number(property.sqm),
          marketRentPerSqm:
            latestValuation.market_rent_per_sqm == null
              ? null
              : Number(latestValuation.market_rent_per_sqm),
          multiple:
            latestValuation.multiple == null
              ? null
              : Number(latestValuation.multiple),
          landValue:
            latestValuation.land_value != null
              ? Number(latestValuation.land_value)
              : property.land_value == null
                ? null
                : Number(property.land_value),
          buildingValue:
            latestValuation.building_value == null
              ? null
              : Number(latestValuation.building_value),
        },
        latestValuation.income_weight == null
          ? 0.5
          : Number(latestValuation.income_weight)
      )
    : null;

  const tenantSummary = tenant
    ? (() => {
        const cold =
          tenant.cold_rent_per_month == null
            ? null
            : Number(tenant.cold_rent_per_month);
        const sqm = property.sqm == null ? null : Number(property.sqm);
        return {
          name: tenant.name,
          contract_start: tenant.contract_start
            ? dateDe(tenant.contract_start)
            : null,
          contract_end: tenant.contract_end ? dateDe(tenant.contract_end) : null,
          is_fixed_term: tenant.is_fixed_term ?? false,
          cold_rent_per_month: cold,
          ancillary_costs_per_month:
            tenant.ancillary_costs_per_month == null
              ? null
              : Number(tenant.ancillary_costs_per_month),
          rent_per_sqm: cold != null && sqm && sqm > 0 ? cold / sqm : null,
        };
      })()
    : null;

  let pdfImages: PdfImage[] = [];
  if (images && images.length > 0) {
    const { data: signed } = await supabase.storage
      .from("property-images")
      .createSignedUrls(
        images.map((i) => i.storage_path),
        60 * 30
      );
    const map = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
    }
    pdfImages = images.map((i) => ({
      storage_path: i.storage_path,
      category: i.category,
      caption: i.caption,
      is_cover: i.is_cover ?? false,
      signedUrl: map.get(i.storage_path) ?? null,
    }));
  }

  return {
    property: {
      id: property.id,
      address: formatPropertyAddress(property),
      unit_number: property.unit_number,
      sqm: property.sqm == null ? null : Number(property.sqm),
      purchase_price:
        property.purchase_price == null ? null : Number(property.purchase_price),
      transfer_date: property.transfer_date,
    },
    owners: ((owners as unknown) as {
      ownership_share: string | number;
      owner: { id: string; name: string };
    }[] ?? []).map((o) => ({
      id: o.owner.id,
      name: o.owner.name,
      share: Number(o.ownership_share),
    })),
    loans: loansResolved,
    totalRemaining,
    totalAnnuity,
    tenant: tenantSummary,
    latestPnL,
    bankView,
    pnlSnapshots,
    latestValuation: valuationResult
      ? {
          valuation_date: dateDe(latestValuation!.valuation_date),
          ertragswert: valuationResult.ertragswert,
          sachwert: valuationResult.sachwert,
          combined: valuationResult.combined,
        }
      : null,
    investments: (investments ?? []).map((i) => ({
      year: i.year,
      is_long_term: i.is_long_term,
      amount: Number(i.amount),
      description: i.description,
      measure_type: i.measure_type,
    })),
    images: pdfImages,
  };
}
