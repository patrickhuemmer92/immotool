import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, isOwner } from "@/lib/workspace";
import { formatPropertyAddress, propertyHeadline } from "@/lib/properties";
import { computeValuation } from "@/lib/calculations/valuation";
import { loanBalance, monthlyAnnuity } from "@/lib/calculations/loan";
import { dateDe, eur as fmtEur } from "@/lib/format";
import {
  computeSnapshotResult,
  type LoanForPnL,
  type SnapshotInputRow,
} from "@/lib/pnl-context";
import { deleteProperty } from "../actions";

const SIGNED_URL_TTL = 60 * 60;

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
    { data: images },
    { data: childUnits },
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
        "id, valuation_date, market_rent_per_sqm, multiple, building_value, income_weight"
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
    supabase
      .from("property_images")
      .select("id, storage_path, caption, is_cover")
      .eq("property_id", id)
      .order("is_cover", { ascending: false })
      .order("display_order")
      .limit(7),
    supabase
      .from("properties")
      .select("id, kind, street, postal_code, city, location_detail, description, sqm")
      .eq("parent_property_id", id)
      .order("city")
      .order("street"),
  ]);

  if (!property) notFound();

  // Resolve parent property label if this is a sub-unit.
  let parent: {
    id: string;
    street: string;
    postal_code: string;
    city: string;
    location_detail: string | null;
    description: string | null;
  } | null = null;
  if (property.parent_property_id) {
    const { data } = await supabase
      .from("properties")
      .select("id, street, postal_code, city, location_detail, description")
      .eq("id", property.parent_property_id)
      .maybeSingle();
    parent = data ?? null;
  }

  const today = new Date();
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
            property.land_value == null ? null : Number(property.land_value),
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

  const equity =
    valuationResult?.combined != null
      ? valuationResult.combined - totalRemaining
      : null;

  // Σ Anschaffungskosten = Kaufpreis + Nebenkosten der Erwerbsphase.
  const num = (v: string | number | null | undefined): number =>
    v === null || v === undefined || v === ""
      ? 0
      : Number.isFinite(Number(v))
        ? Number(v)
        : 0;
  const acquisitionTotal =
    num(property.purchase_price) +
    num(property.transfer_tax) +
    num(property.broker_fee) +
    num(property.notary_fee) +
    num(property.registration_cost);

  // Original FK (Σ Darlehensbetrag bei Auszahlung) und derived EK.
  const totalDebtOriginal = loanRefs.reduce(
    (acc, l) => acc + Number(l.loan_amount),
    0
  );
  const equityInitial =
    acquisitionTotal > 0
      ? acquisitionTotal - totalDebtOriginal
      : null;
  const debtRatio =
    acquisitionTotal > 0 ? totalDebtOriginal / acquisitionTotal : null;

  const investmentSum = (investments ?? []).reduce(
    (acc, i) => acc + Number(i.amount),
    0
  );

  // Sign image URLs (1 cover + up to 6 thumbnails).
  const imagePaths = (images ?? []).map((i) => i.storage_path);
  let signed: Record<string, string> = {};
  if (imagePaths.length > 0) {
    const { data: urls } = await supabase.storage
      .from("property-images")
      .createSignedUrls(imagePaths, SIGNED_URL_TTL);
    signed = Object.fromEntries(
      (urls ?? [])
        .filter((u) => u.path && u.signedUrl)
        .map((u) => [u.path as string, u.signedUrl as string])
    );
  }
  const coverImage = (images ?? []).find((i) => signed[i.storage_path]);
  const thumbnails = (images ?? [])
    .filter((i) => i.id !== coverImage?.id && signed[i.storage_path])
    .slice(0, 6);

  const headline = propertyHeadline(property);
  const ownerSummary =
    ownerEntries.length === 0
      ? null
      : ownerEntries
          .map(
            (e) =>
              `${e.owner.name} (${(
                Number(e.ownership_share) * 100
              ).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %)`
          )
          .join(" · ");

  return (
    <div>
      <Link
        href="/objekte"
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {t("properties.title")}
      </Link>

      {/* Cover image hero */}
      {coverImage && signed[coverImage.storage_path] && (
        <div className="mt-3 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 relative">
          <div className="aspect-[21/9] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signed[coverImage.storage_path]}
              alt={coverImage.caption ?? ""}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* 3-line headline + actions */}
      <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {t(`properties.kind_${(property.kind ?? "apartment") as
                | "apartment"
                | "house"
                | "parking"
                | "commercial"
                | "other"}`)}
            </span>
            {parent && (
              <Link
                href={`/objekte/${parent.id}`}
                className="text-xs text-accent hover:underline"
              >
                ↳ {t("properties.part_of")}: {formatPropertyAddress(parent)}
              </Link>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{headline.street}</h1>
          <p className="text-base text-neutral-700 dark:text-neutral-300 mt-1">
            {headline.cityLine}
          </p>
          {headline.detail && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {headline.detail}
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

      {/* Quick metadata row */}
      {ownerSummary && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="uppercase tracking-wider mr-2">
            {t("properties.section_owners")}
          </span>
          {ownerSummary}
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          label={t("properties.sqm")}
          value={
            property.sqm == null
              ? "—"
              : Number(property.sqm).toLocaleString("de-DE", {
                  maximumFractionDigits: 1,
                })
          }
        />
        <Kpi
          label={t("properties.purchase_price")}
          value={fmtEur(
            property.purchase_price == null
              ? null
              : Number(property.purchase_price)
          )}
        />
        <Kpi
          label={t("valuation.combined")}
          value={fmtEur(valuationResult?.combined ?? null)}
        />
        <Kpi
          label={t("loans.remaining_balance")}
          value={loanRefs.length === 0 ? "—" : fmtEur(totalRemaining)}
        />
        <Kpi
          label={t("portfolio.kpi_equity")}
          value={equity == null ? "—" : fmtEur(equity)}
          strong
        />
        <Kpi
          label={t("pnl.after_tax_cashflow")}
          value={snapshotResult ? fmtEur(snapshotResult.afterTaxCashflow) : "—"}
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
                    {(Number(e.ownership_share) * 100).toLocaleString("de-DE", {
                      maximumFractionDigits: 2,
                    })}{" "}
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
              <span className="font-medium">{tenant.name}</span>
              {tenant.contract_start && (
                <div className="text-neutral-500 dark:text-neutral-400">
                  {t("tenants.contract_start")}: {dateDe(tenant.contract_start)}
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
                  <span className="tabular-nums">
                    {fmtEur(Number(l.loan_amount))}
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t border-neutral-200 dark:border-neutral-800 pt-1 mt-1 font-semibold">
                <span>{t("loans.annuity")}</span>
                <span className="tabular-nums">{fmtEur(totalAnnuity)}/M</span>
              </li>
            </ul>
          )}
        </Card>

        <Card title={t("factsheet.latest_pnl")}>
          {snapshotResult && latestSnapshot ? (
            <div className="text-sm space-y-1">
              <div className="text-xs text-neutral-500">
                {dateDe(latestSnapshot.period_start)} –{" "}
                {dateDe(latestSnapshot.period_end)}
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
                {dateDe(latestValuation.valuation_date)}
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
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-2 leading-snug">
                {t("valuation.method_footnote")}
              </p>
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title={t("factsheet.finance_summary")}>
          {acquisitionTotal === 0 ? (
            <Empty />
          ) : (
            <div className="text-sm space-y-1">
              <Row
                label={t("factsheet.acquisition_total")}
                value={acquisitionTotal}
                strong
              />
              <Row
                label={t("factsheet.debt_original")}
                value={totalDebtOriginal}
              />
              <Row
                label={t("factsheet.equity_initial")}
                value={equityInitial}
              />
              {debtRatio != null && (
                <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                  <span>{t("factsheet.debt_ratio")}</span>
                  <span className="tabular-nums">
                    {(debtRatio * 100).toLocaleString("de-DE", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    %
                  </span>
                </div>
              )}
            </div>
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

      {/* Sub-units (when this property is a house with child units) */}
      {(childUnits ?? []).length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            {t("properties.units_in_house")}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">
              <tbody>
                {(childUnits ?? []).map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-neutral-200 dark:border-neutral-800 first:border-t-0"
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 mr-2">
                        {t(`properties.kind_${(u.kind ?? "apartment") as
                          | "apartment"
                          | "house"
                          | "parking"
                          | "commercial"
                          | "other"}`)}
                      </span>
                      <Link
                        href={`/objekte/${u.id}`}
                        className="font-medium hover:underline"
                      >
                        {formatPropertyAddress(u)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                      {u.sqm == null
                        ? ""
                        : `${Number(u.sqm).toLocaleString("de-DE", {
                            maximumFractionDigits: 1,
                          })} m²`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Thumbnail strip — additional images, click to gallery */}
      {thumbnails.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t("images.title")}
            </h2>
            <Link
              href={`/objekte/${id}/bilder`}
              className="text-xs text-accent hover:underline"
            >
              {t("factsheet.see_all_images")} →
            </Link>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {thumbnails.map((img) => (
              <Link
                key={img.id}
                href={`/objekte/${id}/bilder`}
                className="aspect-square rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signed[img.storage_path]}
                  alt={img.caption ?? ""}
                  className="w-full h-full object-cover"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
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
        {fmtEur(value)}
      </span>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-neutral-500 dark:text-neutral-400">—</p>;
}

