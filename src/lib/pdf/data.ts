import { createClient } from "@/lib/supabase/server";
import { computeValuation } from "@/lib/calculations/valuation";
import { loanBalance, monthlyAnnuity } from "@/lib/calculations/loan";
import { tenantScore } from "@/lib/calculations/tenant";
import {
  computeSnapshotResult,
  type LoanForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { formatPropertyAddress } from "@/lib/properties";

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
  owners: { name: string; share: number }[];
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
    score: number | null;
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
      .select("ownership_share, owner:owners!inner(name)")
      .eq("property_id", propertyId),
    supabase
      .from("loans")
      .select(
        "id, designation, bank, loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate, special_repayments(payment_date, amount)"
      )
      .eq("property_id", propertyId),
    supabase.from("tenants").select("*").eq("property_id", propertyId).maybeSingle(),
    supabase
      .from("pnl_snapshots")
      .select("*")
      .eq("property_id", propertyId)
      .order("period_end", { ascending: false }),
    supabase
      .from("portfolio_valuations")
      .select(
        "id, valuation_date, market_rent_per_sqm, multiple, building_value"
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
          period: `${latestSnapshot.period_start} – ${latestSnapshot.period_end}`,
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

  const pnlSnapshots = (snapshots ?? []).map((s) => {
    const r = computeSnapshotResult(
      s as SnapshotInputRow,
      property,
      loanRefs,
      settingsForCalc
    );
    return {
      period: `${s.period_start} – ${s.period_end}`,
      rentTotal: r.rentTotal,
      afterTaxCashflow: r.afterTaxCashflow,
    };
  });

  const latestValuation = (valuations ?? [])[0];
  const valuationResult = latestValuation
    ? computeValuation({
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
          property.land_value == null ? null : Number(property.land_value),
        buildingValue:
          latestValuation.building_value == null
            ? null
            : Number(latestValuation.building_value),
      })
    : null;

  const tenantSummary = tenant
    ? {
        name: tenant.name,
        contract_start: tenant.contract_start,
        score: tenantScore({
          family_status: tenant.family_status,
          schufa: tenant.schufa,
          rental_duration: tenant.rental_duration,
          personal_impression: tenant.personal_impression,
          employment_status: tenant.employment_status,
          income_level: tenant.income_level,
        }),
      }
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
      owner: { name: string };
    }[] ?? []).map((o) => ({
      name: o.owner.name,
      share: Number(o.ownership_share),
    })),
    loans: loansResolved,
    totalRemaining,
    totalAnnuity,
    tenant: tenantSummary,
    latestPnL,
    pnlSnapshots,
    latestValuation: valuationResult
      ? {
          valuation_date: latestValuation!.valuation_date,
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
