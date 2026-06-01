"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SimulationForm, type SimulationDefaults } from "../simulation-form";
import {
  addSimulationInvestment,
  deleteSimulation,
  removeSimulationInvestment,
} from "../actions";
import type { SimulationProjectionRow } from "@/lib/calculations/simulation";

type InvestmentRow = {
  id: string;
  year: number;
  amount: number;
  description: string | null;
  tax_treatment: string;
};

export function SimulationDetailClient({
  simulationId,
  name,
  description,
  propertyId,
  propertyAddress,
  defaults,
  editable,
  rows,
  hasData,
  investments,
}: {
  simulationId: string;
  name: string;
  description: string | null;
  propertyId: string;
  propertyAddress: string;
  defaults: SimulationDefaults;
  editable: boolean;
  rows: SimulationProjectionRow[];
  hasData: boolean;
  investments: InvestmentRow[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pendingDelete, startDelete] = useTransition();
  const [pendingAddInv, startAddInv] = useTransition();
  const [pendingRemoveInv, startRemoveInv] = useTransition();
  const [invError, setInvError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm(t("simulations.confirm_delete"))) return;
    startDelete(() => deleteSimulation(simulationId));
  }

  async function onAddInvestment(formData: FormData) {
    setInvError(null);
    startAddInv(async () => {
      formData.set("simulation_id", simulationId);
      const res = await addSimulationInvestment(undefined, formData);
      if (res?.error) setInvError(res.error);
      else router.refresh();
    });
  }

  async function onRemoveInvestment(invId: string) {
    if (!confirm(t("common.confirm_delete"))) return;
    startRemoveInv(async () => {
      await removeSimulationInvestment(invId, simulationId);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="mt-2">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">
          {t("simulations.edit")}
        </h1>
        <SimulationForm
          simulationId={simulationId}
          defaults={defaults}
          properties={[]}
          onCancel={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  const chartData = rows.map((r) => ({
    year: r.calendarYear,
    baseline: Math.round(r.baseline.afterTaxCashflow),
    scenario: Math.round(r.scenario.afterTaxCashflow),
  }));

  return (
    <>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {propertyAddress}
          </p>
          {description && (
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl">
              {description}
            </p>
          )}
        </div>
        {editable && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {t("common.edit")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={pendingDelete}
              className="rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
            >
              {pendingDelete ? t("common.loading") : t("common.delete")}
            </button>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="mt-8 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm">
          <p className="font-medium">{t("simulations.no_baseline_title")}</p>
          <p className="mt-1 text-amber-700 dark:text-amber-300">
            {t("simulations.no_baseline_help")}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm">
          <p>{t("simulations.no_projection_help")}</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <h2 className="text-sm font-semibold mb-3">
              {t("simulations.chart_title")}
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis
                    tickFormatter={(v) =>
                      v.toLocaleString("de-DE", { maximumFractionDigits: 0 })
                    }
                  />
                  <Tooltip
                    formatter={(v) => {
                      const n = typeof v === "number" ? v : Number(v);
                      return Number.isFinite(n)
                        ? n.toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                            maximumFractionDigits: 0,
                          })
                        : String(v);
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name={t("simulations.legend_baseline")}
                    stroke="#94a3b8"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario"
                    name={t("simulations.legend_scenario")}
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabelle */}
          <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-950">
                <tr className="text-left">
                  <Th>{t("simulations.col_year")}</Th>
                  <Th className="text-right">
                    {t("simulations.col_baseline")}
                  </Th>
                  <Th className="text-right">
                    {t("simulations.col_scenario")}
                  </Th>
                  <Th className="text-right">{t("simulations.col_delta")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.year}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <Td>
                      <span className="font-medium">
                        {t("simulations.year_label", { year: r.year })}
                      </span>
                      <span className="ml-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                        {r.calendarYear}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {eur(r.baseline.afterTaxCashflow)}
                    </Td>
                    <Td className="text-right tabular-nums font-medium">
                      {eur(r.scenario.afterTaxCashflow)}
                    </Td>
                    <Td
                      className={
                        "text-right tabular-nums " +
                        (r.cashflowDelta >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400")
                      }
                    >
                      {(r.cashflowDelta >= 0 ? "+" : "") +
                        eur(r.cashflowDelta)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Zusätzliche Investitionen */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">
          {t("simulations.investments_section")}
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl">
          {t("simulations.investments_help")}
        </p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Liste */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            {investments.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
                {t("simulations.no_investments")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-950">
                  <tr className="text-left">
                    <Th>{t("investments.year")}</Th>
                    <Th className="text-right">{t("investments.amount")}</Th>
                    <Th>{t("investments.tax_treatment_column")}</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <Td>{inv.year}</Td>
                      <Td className="text-right tabular-nums">
                        {eur(inv.amount)}
                      </Td>
                      <Td className="text-xs text-neutral-600 dark:text-neutral-400">
                        {inv.tax_treatment}
                      </Td>
                      <Td>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => onRemoveInvestment(inv.id)}
                            disabled={pendingRemoveInv}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                          >
                            {t("common.delete")}
                          </button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add-Form */}
          {editable && (
            <form
              action={onAddInvestment}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
            >
              <h3 className="text-sm font-semibold">
                {t("simulations.add_investment")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="year"
                  type="number"
                  min={1900}
                  max={2200}
                  required
                  placeholder={t("investments.year")}
                  className={inputClass}
                />
                <input
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder={t("investments.amount")}
                  className={inputClass}
                />
              </div>
              <select
                name="tax_treatment"
                required
                defaultValue="expense_immediate"
                className={inputClass}
              >
                <option value="expense_immediate">
                  {t("investments.tax_expense_immediate")}
                </option>
                <option value="expense_82b">
                  {t("investments.tax_expense_82b")}
                </option>
                <option value="capitalized_building">
                  {t("investments.tax_capitalized_building")}
                </option>
                <option value="capitalized_separate">
                  {t("investments.tax_capitalized_separate")}
                </option>
                <option value="non_deductible">
                  {t("investments.tax_non_deductible")}
                </option>
              </select>
              <input
                name="description"
                type="text"
                placeholder={t("investments.description")}
                className={inputClass}
              />
              {invError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {invError}
                </p>
              )}
              <button
                type="submit"
                disabled={pendingAddInv}
                className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {pendingAddInv ? t("common.loading") : t("common.create")}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function eur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-2 align-middle ${className ?? ""}`}>{children}</td>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";
