"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { MoneyInput } from "@/components/money-input";
import {
  createSnapshot,
  updateSnapshot,
  type SnapshotState,
} from "./actions";
import type { SnapshotDefaults } from "./snapshot-defaults";

export type { SnapshotDefaults };

type HausgeldMode = "total" | "split";

export function SnapshotForm({
  propertyId,
  snapshotId,
  defaults,
  tenantColdRentMonthly,
  onCancel,
}: {
  propertyId: string;
  /** When provided, the form updates an existing snapshot. */
  snapshotId?: string;
  defaults: SnapshotDefaults;
  /**
   * Aktuelle Kaltmiete des hinterlegten Mieters (€/Monat) — wird im Form
   * als Info angezeigt. Speicherung passiert serverseitig: die Action
   * zieht den Wert live aus tenants beim Insert/Update, sodass Snapshots
   * nicht mehr aus dem Mieter-Datensatz auseinanderlaufen können.
   */
  tenantColdRentMonthly: number | null;
  /** Render a cancel button (useful for inline-edit). */
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const action = snapshotId
    ? updateSnapshot.bind(null, snapshotId, propertyId)
    : createSnapshot.bind(null, propertyId);
  const [state, formAction, pending] = useActionState<SnapshotState, FormData>(
    action,
    undefined
  );

  // Hausgeld-Modus initial: split, wenn split-Werte vorhanden, sonst total.
  const initialMode: HausgeldMode =
    defaults.property_fee_recoverable !== "" ||
    defaults.property_fee_not_recoverable !== ""
      ? "split"
      : "total";
  const [hausgeldMode, setHausgeldMode] = useState<HausgeldMode>(initialMode);
  const [recoverable, setRecoverable] = useState<number | null>(null);
  const [notRecoverable, setNotRecoverable] = useState<number | null>(null);
  const splitSum = (recoverable ?? 0) + (notRecoverable ?? 0);

  return (
    <form action={formAction} className="space-y-8 max-w-3xl">
      {/* ============ Periode ============ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field id="period_start" label={t("pnl.period_start")} required>
          <input
            id="period_start"
            name="period_start"
            type="date"
            defaultValue={defaults.period_start}
            required
            className={inputClass}
          />
        </Field>
        <Field id="period_end" label={t("pnl.period_end")} required>
          <input
            id="period_end"
            name="period_end"
            type="date"
            defaultValue={defaults.period_end}
            required
            className={inputClass}
          />
        </Field>
      </div>

      {/* ============ Einnahmen ============ */}
      <Section title={t("pnl.section_rent")}>
        {tenantColdRentMonthly != null && tenantColdRentMonthly > 0 ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-neutral-700 dark:text-neutral-300">
                {t("pnl.cold_rent_from_tenant")}
              </span>
              <span className="font-medium tabular-nums">
                {tenantColdRentMonthly.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  / {t("pnl.month")}
                </span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug">
              {t("pnl.cold_rent_from_tenant_help")}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm">
            <p className="text-neutral-700 dark:text-neutral-300">
              {t("pnl.cold_rent_no_tenant")}
            </p>
            <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug">
              {t("pnl.cold_rent_no_tenant_help")}
            </p>
          </div>
        )}
      </Section>

      {/* ============ Hausgeld ============ */}
      <Section
        title={t("pnl.section_hausgeld")}
        subtitle={t("pnl.hausgeld_mode_help")}
      >
        <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs overflow-hidden mb-4">
          <ModeBtn
            active={hausgeldMode === "total"}
            onClick={() => setHausgeldMode("total")}
          >
            {t("pnl.hausgeld_mode_total")}
          </ModeBtn>
          <ModeBtn
            active={hausgeldMode === "split"}
            onClick={() => setHausgeldMode("split")}
          >
            {t("pnl.hausgeld_mode_split")}
          </ModeBtn>
        </div>

        {hausgeldMode === "total" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="ancillary_costs"
              label={t("pnl.ancillary_costs")}
              hint={t("pnl.hausgeld_total_help")}
            >
              <MoneyInput
                id="ancillary_costs"
                name="ancillary_costs"
                defaultValue={defaults.ancillary_costs}
              />
            </Field>
            <input type="hidden" name="property_fee_recoverable" value="" />
            <input type="hidden" name="property_fee_not_recoverable" value="" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                id="property_fee_recoverable"
                label={t("pnl.property_fee_recoverable")}
              >
                <MoneyInput
                  id="property_fee_recoverable"
                  name="property_fee_recoverable"
                  defaultValue={defaults.property_fee_recoverable}
                  onValueChange={setRecoverable}
                />
              </Field>
              <Field
                id="property_fee_not_recoverable"
                label={t("pnl.property_fee_not_recoverable")}
              >
                <MoneyInput
                  id="property_fee_not_recoverable"
                  name="property_fee_not_recoverable"
                  defaultValue={defaults.property_fee_not_recoverable}
                  onValueChange={setNotRecoverable}
                />
              </Field>
            </div>
            <input type="hidden" name="ancillary_costs" value="" />
            {(recoverable != null || notRecoverable != null) && (
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                {t("pnl.hausgeld_split_sum", {
                  sum: splitSum.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 2,
                  }),
                })}
              </p>
            )}
          </>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="maintenance" label={t("pnl.maintenance")}>
            <MoneyInput
              id="maintenance"
              name="maintenance"
              defaultValue={defaults.maintenance}
            />
          </Field>
        </div>
      </Section>

      {/* ============ Sonstige Betriebskosten ============ */}
      <Section title={t("pnl.section_other_costs")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            id="management_costs"
            label={t("pnl.management_costs")}
            hint={t("pnl.management_costs_help")}
          >
            <MoneyInput
              id="management_costs"
              name="management_costs"
              defaultValue={defaults.management_costs}
            />
          </Field>
          <Field
            id="vacancy_risk_amount"
            label={t("pnl.vacancy_amount_monthly")}
            hint={t("pnl.vacancy_amount_help")}
          >
            <MoneyInput
              id="vacancy_risk_amount"
              name="vacancy_risk_amount"
              defaultValue={defaults.vacancy_risk_amount}
            />
          </Field>
        </div>
      </Section>

      {/* ============ Darlehen-Overrides ============ */}
      <Section
        title={t("pnl.section_loan_overrides")}
        subtitle={t("pnl.section_inputs")}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field id="annuity_override" label={t("pnl.annuity_override")}>
            <MoneyInput
              id="annuity_override"
              name="annuity_override"
              defaultValue={defaults.annuity_override}
            />
          </Field>
          <Field id="interest_override" label={t("pnl.interest_override")}>
            <MoneyInput
              id="interest_override"
              name="interest_override"
              defaultValue={defaults.interest_override}
            />
          </Field>
          <Field id="principal_override" label={t("pnl.principal_override")}>
            <MoneyInput
              id="principal_override"
              name="principal_override"
              defaultValue={defaults.principal_override}
            />
          </Field>
        </div>
      </Section>

      <FormError raw={state?.error} />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? t("common.loading")
            : snapshotId
              ? t("common.save")
              : t("common.create")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {subtitle && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">
          {subtitle}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ModeBtn({
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

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
