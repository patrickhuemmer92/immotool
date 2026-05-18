"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { dateDe, eurExact, pct } from "@/lib/format";
import type {
  BankViewResult,
  PnLResult,
} from "@/lib/calculations/pnl";

export type SnapshotKPIs = {
  grossYield: number | null;
  netYield: number | null;
  ltv: number | null;
};

export type LtvContext = {
  remainingLoans: number;
  marketValue: number | null;
  /** ISO date of the valuation that drove the market value. */
  marketValueDate: string | null;
};

export function CashflowResultCard({
  periodStart,
  periodEnd,
  investor,
  bank,
  bankStressed,
  kpis,
  ltvContext,
  rateLockUntil,
  onDelete,
}: {
  periodStart: string;
  periodEnd: string;
  investor: PnLResult;
  bank: BankViewResult;
  /** Same period under +250 bp stress. */
  bankStressed: BankViewResult;
  kpis: SnapshotKPIs;
  /** Background info for the LTV tooltip. */
  ltvContext?: LtvContext;
  /** ISO date of the earliest rate lock end. Used for the stress hint. */
  rateLockUntil: string | null;
  onDelete?: React.ReactNode;
}) {
  const t = useTranslations();
  const [tab, setTab] = useState<"investor" | "bank">("investor");
  const [stress, setStress] = useState(false);
  const activeBank = stress ? bankStressed : bank;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {dateDe(periodStart)} – {dateDe(periodEnd)}
        </h3>
        {onDelete}
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs overflow-hidden">
        <TabBtn active={tab === "investor"} onClick={() => setTab("investor")}>
          {t("pnl.view_investor")}
        </TabBtn>
        <TabBtn active={tab === "bank"} onClick={() => setTab("bank")}>
          {t("pnl.view_bank")}
        </TabBtn>
      </div>
      <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
        {tab === "investor" ? t("pnl.view_investor_help") : t("pnl.view_bank_help")}
      </p>

      {tab === "investor" ? (
        <>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="pb-1 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                >
                  {t("pnl.section_cashflow")}
                </th>
              </tr>
            </thead>
            <tbody>
              <ResultRow
                label={
                  investor.convention === "gross"
                    ? t("pnl.rent_warm_total")
                    : t("pnl.rent_cold_total")
                }
                value={investor.rentTotal}
              />
              <ResultRow
                label={t("pnl.operating_costs")}
                value={-investor.operatingCosts}
              />
              <ResultRow
                label={t("pnl.interest")}
                value={-investor.interest}
                tag={investor.source.interest}
              />
              <ResultRow
                label={t("pnl.principal")}
                value={-investor.principal}
                tag={investor.source.principal}
              />
              <ResultRow
                label={t("pnl.cashflow_before_tax")}
                value={investor.cashflowBeforeTax}
                strong
              />
            </tbody>
          </table>

          <table className="mt-6 w-full text-sm border-t-2 border-neutral-200 dark:border-neutral-800 pt-4">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="pt-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                >
                  {t("pnl.section_tax")}
                </th>
              </tr>
            </thead>
            <tbody>
              <ResultRow
                label={t("pnl.depreciation")}
                value={-investor.depreciation}
                muted
                annotation={t("pnl.depreciation_calc_only")}
              />
              <ResultRow
                label={t("pnl.pretax_profit")}
                value={investor.pretaxProfit}
                strong
              />
              <ResultRow
                label={t("pnl.tax_effect")}
                value={-investor.taxEffect}
              />
            </tbody>
          </table>

          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            {t("pnl.tax_section_help")}
          </p>

          <table className="mt-4 w-full text-sm border-t-2 border-neutral-200 dark:border-neutral-800 pt-4">
            <tbody>
              <ResultRow
                label={t("pnl.after_tax_cashflow")}
                value={investor.afterTaxCashflow}
                strong
              />
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={stress}
                onChange={(e) => setStress(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              {t("pnl.stress_label")}
            </label>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {stress && !rateLockUntil
              ? t("pnl.stress_no_lock")
              : t("pnl.stress_help")}
          </p>

          <table className="mt-4 w-full text-sm">
            <tbody>
              <ResultRow
                label={t("pnl.rent_cold_total")}
                value={activeBank.rentScheduled}
              />
              <ResultRow
                label={t("pnl.vacancy_total")}
                value={-activeBank.vacancyLoss}
                muted
              />
              <ResultRow
                label={t("pnl.rent_effective_total")}
                value={activeBank.rentEffective}
              />
              <ResultRow
                label={t("pnl.operating_costs")}
                value={
                  -(activeBank.hausgeldNonRecoverable +
                    activeBank.bankMaintenance +
                    activeBank.managementTotal)
                }
              />
              <ResultRow
                label={t("pnl.noi")}
                value={activeBank.noi}
                strong
              />
              <ResultRow
                label={t("pnl.debt_service")}
                value={-activeBank.debtService}
              />
              <ResultRow
                label={t("pnl.cashflow_before_tax")}
                value={activeBank.cashflowBeforeTax}
                strong
              />
            </tbody>
          </table>
        </>
      )}

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <KpiCell
          label={t("pnl.kpi_gross_yield")}
          value={kpis.grossYield != null ? pct(kpis.grossYield) : "—"}
        />
        <KpiCell
          label={t("pnl.kpi_net_yield")}
          value={kpis.netYield != null ? pct(kpis.netYield) : "—"}
        />
        <KpiCell
          label={t("pnl.icr")}
          value={
            activeBank.icr != null
              ? activeBank.icr.toLocaleString("de-DE", { maximumFractionDigits: 2 })
              : "—"
          }
          hint={t("pnl.icr_help")}
        />
        <KpiCell
          label={t("pnl.kpi_ltv")}
          value={kpis.ltv != null ? pct(kpis.ltv) : "—"}
          hint={
            ltvContext
              ? t("pnl.kpi_ltv_breakdown", {
                  loans: eurExact(ltvContext.remainingLoans),
                  market:
                    ltvContext.marketValue != null
                      ? eurExact(ltvContext.marketValue)
                      : "—",
                  date:
                    ltvContext.marketValueDate != null
                      ? dateDe(ltvContext.marketValueDate)
                      : "—",
                })
              : t("pnl.kpi_ltv_help")
          }
        />
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 " +
        (active
          ? "bg-accent text-accent-foreground font-medium"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800")
      }
    >
      {children}
    </button>
  );
}

function ResultRow({
  label,
  value,
  strong,
  muted,
  tag,
  annotation,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  tag?: "auto" | "override";
  annotation?: string;
}) {
  return (
    <tr
      className={`border-t border-neutral-200 dark:border-neutral-800 ${
        muted ? "text-neutral-500 dark:text-neutral-400" : ""
      }`}
    >
      <td className={`py-2 ${strong ? "font-semibold" : ""}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span>{label}</span>
          {tag && (
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">
              {tag}
            </span>
          )}
          {annotation && (
            <span className="text-[10px] uppercase tracking-wider rounded bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 text-neutral-600 dark:text-neutral-400">
              {annotation}
            </span>
          )}
        </div>
      </td>
      <td
        className={`py-2 text-right tabular-nums ${
          strong ? "font-semibold" : ""
        } ${value < 0 ? "text-red-600 dark:text-red-400" : ""}`}
      >
        {eurExact(value)}
      </td>
    </tr>
  );
}

function KpiCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-lg bg-neutral-100 dark:bg-neutral-800/50 p-3"
      title={hint}
    >
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug whitespace-pre-line">
          {hint}
        </div>
      )}
    </div>
  );
}
