import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit, isOwner } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { computeValuation } from "@/lib/calculations/valuation";
import { loanBalance, monthlyAnnuity } from "@/lib/calculations/loan";
import { tenantScore } from "@/lib/calculations/tenant";
import { TenantScoreBadge } from "@/components/tenant-score-badge";
import {
  computeSnapshotResult,
  type LoanForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { deleteProperty } from "../actions";

export default async function PropertyFactsheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const [
    { data: property },
    { data: owners },
    { data: loans },
    { data: tenant },
    { data: snapshots },
    { data: valuations },
    { data: investments },
    { data: settings },
  ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("property_owners")
      .select("ownership_share, owner:owners!inner(id, name)")
      .eq("property_id", id),
    supabase
      .from("loans")
      .select(
        "id, designation, bank, loan_amount, interest_rate_pa, amortization_pa, first_payment_date, interest_share_first_rate, special_repayments(payment_date, amount)"
      )
      .eq("property_id", id),
    supabase.from("tenants").select("*").eq("property_id", id).maybeSingle(),
    supabase
      .from("pnl_snapshots")
      .select("*")
      .eq("property_id", id)
      .order("period_end", { ascending: false })
      .limit(1),
    supabase
      .from("portfolio_valuations")
      .select(
        "id, valuation_date, market_rent_per_sqm, multiple, building_value"
      )
      .eq("property_id", id)
      .order("valuation_date", { ascending: false })
      .limit(1),
    supabase
      .from("investment_plans")
      .select("amount, year, is_long_term")
      .eq("property_id", id),
    supabase
      .from("settings")
      .select("tax_rate, default_depreciation_rate")
      .eq("workspace_id", active.id)
      .maybeSingle(),
  ]);

  if (!property) notFound();

  const today = new Date();
  const editable = canEdit(active.role);
  const ownerEntries =
    (owners as unknown as {
      ownership_share: string | number;
      owner: { id: string; name: string };
    }[]) ?? [];

  const loanRefs =
    (loans as unknown as (LoanForPnL & {
      id: string;
      designation: string;
      bank: string | null;
    })[]) ?? [];

  let totalRemaining = 0;
  let totalAnnuity = 0;
  for (const l of loanRefs) {
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
    totalRemaining += loanBalance(
      input,
      today,
      (l.special_repayments ?? []).map((s) => ({
        date: new Date(s.payment_date),
        amount: Number(s.amount),
      }))
    );
    totalAnnuity += monthlyAnnuity(input);
  }

  const tenantSc = tenant
    ? tenantScore({
        family_status: tenant.family_status,
        schufa: tenant.schufa,
        rental_duration: tenant.rental_duration,
        personal_impression: tenant.personal_impression,
        employment_status: tenant.employment_status,
        income_level: tenant.income_level,
      })
    : null;

  const latestSnapshot = (snapshots ?? [])[0];
  const latestValuation = (valuations ?? [])[0];
  const settingsForCalc = settings ?? {
    tax_rate: 0.35,
    default_depreciation_rate: 0.02,
  };

  const snapshotResult = latestSnapshot
    ? computeSnapshotResult(
        latestSnapshot as SnapshotInputRow,
        property,
        loanRefs,
        settingsForCalc
      )
    : null;

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

  const equity =
    valuationResult?.combined != null
      ? valuationResult.combined - totalRemaining
      : null;

  const investmentSum = (investments ?? []).reduce(
    (acc, i) => acc + Number(i.amount),
    0
  );

  return (
    <div>
      <Link
        href="/objekte"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("properties.title")}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatPropertyAddress(property)}
          </h1>
          {property.unit_number && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t("properties.unit_number")}: {property.unit_number}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/pdf/factsheet/${id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {t("factsheet.download_factsheet")}
          </a>
          <a
            href={`/api/pdf/factbook/property/${id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {t("factsheet.download_factbook")}
          </a>
          {isOwner(active.role) && (
            <form action={deleteProperty.bind(null, property.id)}>
              <button
                type="submit"
                className="text-sm text-red-600 dark:text-red-400 hover:underline px-2"
              >
                {t("common.delete")}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <NavTab href={`/objekte/${id}/bearbeiten`} label={t("properties.go_to_edit")} editable={editable} />
        <NavTab href={`/objekte/${id}/bilder`} label={t("properties.go_to_images")} />
        <NavTab href={`/objekte/${id}/darlehen`} label={t("properties.go_to_loans")} />
        <NavTab href={`/objekte/${id}/mieter`} label={t("tenants.title")} />
        <NavTab href={`/objekte/${id}/guv`} label={t("pnl.title")} />
        <NavTab href={`/objekte/${id}/bewertung`} label={t("valuation.title")} />
        <NavTab
          href={`/objekte/${id}/investitionen`}
          label={t("investments.title")}
        />
        <NavTab href={`/objekte/${id}/afa`} label={t("afa.title")} />
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          label={t("properties.sqm")}
          value={
            property.sqm == null
              ? "—"
              : Number(property.sqm).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })
          }
        />
        <Kpi
          label={t("properties.purchase_price")}
          value={
            property.purchase_price == null
              ? "—"
              : eur(Number(property.purchase_price))
          }
        />
        <Kpi
          label={t("valuation.combined")}
          value={
            valuationResult?.combined == null
              ? "—"
              : eur(valuationResult.combined)
          }
        />
        <Kpi
          label={t("loans.remaining_balance")}
          value={loanRefs.length === 0 ? "—" : eur(totalRemaining)}
        />
        <Kpi
          label={t("portfolio.kpi_equity")}
          value={equity == null ? "—" : eur(equity)}
          strong
        />
        <Kpi
          label={t("pnl.after_tax_cashflow")}
          value={snapshotResult ? eur(snapshotResult.afterTaxCashflow) : "—"}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={t("properties.section_owners")}>
          {ownerEntries.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-1 text-sm">
              {ownerEntries.map((e) => (
                <li key={e.owner.id} className="flex justify-between">
                  <span>{e.owner.name}</span>
                  <span className="tabular-nums">
                    {(Number(e.ownership_share) * 100).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 2 }
                    )}{" "}
                    %
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("factsheet.tenant_summary")}>
          {tenant ? (
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{tenant.name}</span>
                <TenantScoreBadge score={tenantSc} />
              </div>
              {tenant.contract_start && (
                <div className="text-neutral-500 dark:text-neutral-400">
                  {t("tenants.contract_start")}: {tenant.contract_start}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("tenants.no_tenant")}
            </p>
          )}
        </Card>

        <Card title={t("factsheet.loans_summary")}>
          {loanRefs.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-1 text-sm">
              {loanRefs.map((l) => (
                <li key={l.id} className="flex justify-between">
                  <span className="truncate">{l.designation}</span>
                  <span className="tabular-nums">{eur(Number(l.loan_amount))}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-neutral-200 dark:border-neutral-800 pt-1 mt-1 font-semibold">
                <span>{t("loans.annuity")}</span>
                <span className="tabular-nums">{eur(totalAnnuity)}/M</span>
              </li>
            </ul>
          )}
        </Card>

        <Card title={t("factsheet.latest_pnl")}>
          {snapshotResult && latestSnapshot ? (
            <div className="text-sm space-y-1">
              <div className="text-xs text-neutral-500">
                {latestSnapshot.period_start} – {latestSnapshot.period_end}
              </div>
              <Row
                label={t("pnl.cashflow_before_tax")}
                value={snapshotResult.cashflowBeforeTax}
              />
              <Row
                label={t("pnl.after_tax_cashflow")}
                value={snapshotResult.afterTaxCashflow}
                strong
              />
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title={t("factsheet.latest_valuation")}>
          {valuationResult && latestValuation ? (
            <div className="text-sm space-y-1">
              <div className="text-xs text-neutral-500">
                {latestValuation.valuation_date}
              </div>
              <Row
                label={t("valuation.ertragswert")}
                value={valuationResult.ertragswert}
              />
              <Row
                label={t("valuation.sachwert")}
                value={valuationResult.sachwert}
              />
              <Row
                label={t("valuation.combined")}
                value={valuationResult.combined}
                strong
              />
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title={t("factsheet.investment_summary")}>
          {(investments ?? []).length === 0 ? (
            <Empty />
          ) : (
            <div className="text-sm space-y-1">
              <Row
                label={t("investments.title")}
                value={investmentSum}
                strong
              />
              <div className="text-xs text-neutral-500">
                {(investments ?? []).length} {t("investments.title")}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-1 tabular-nums ${strong ? "text-lg font-semibold" : "text-sm"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span
        className={`tabular-nums ${
          (value ?? 0) < 0 ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        {value == null ? "—" : eur(value)}
      </span>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-neutral-500 dark:text-neutral-400">—</p>;
}

function NavTab({
  href,
  label,
  editable,
}: {
  href: string;
  label: string;
  editable?: boolean;
}) {
  if (editable === false) return null;
  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      {label}
    </Link>
  );
}

function eur(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
