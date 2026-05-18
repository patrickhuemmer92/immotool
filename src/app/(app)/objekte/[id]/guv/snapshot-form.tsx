"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { MoneyInput } from "@/components/money-input";
import { createSnapshot, type SnapshotState } from "./actions";

export function SnapshotForm({
  propertyId,
  defaults,
}: {
  propertyId: string;
  defaults: {
    period_start: string;
    period_end: string;
  };
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<SnapshotState, FormData>(
    createSnapshot.bind(null, propertyId),
    undefined
  );

  // Q12 — live check that umlage + nicht-umlage matches the total
  const [totalAncillary, setTotalAncillary] = useState<number | null>(null);
  const [recoverable, setRecoverable] = useState<number | null>(null);
  const [notRecoverable, setNotRecoverable] = useState<number | null>(null);

  const summed =
    recoverable != null || notRecoverable != null
      ? (recoverable ?? 0) + (notRecoverable ?? 0)
      : null;
  const showMismatch =
    totalAncillary != null && summed != null && Math.abs(summed - totalAncillary) > 0.01;

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
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

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
          {t("pnl.section_inputs")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="cold_rent" label={t("pnl.cold_rent")}>
            <MoneyInput id="cold_rent" name="cold_rent" />
          </Field>
          <Field id="ancillary_costs" label={t("pnl.ancillary_costs")}>
            <MoneyInput
              id="ancillary_costs"
              name="ancillary_costs"
              onValueChange={setTotalAncillary}
            />
          </Field>
          <Field
            id="property_fee_recoverable"
            label={t("pnl.property_fee_recoverable")}
          >
            <MoneyInput
              id="property_fee_recoverable"
              name="property_fee_recoverable"
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
              onValueChange={setNotRecoverable}
            />
          </Field>
          <Field id="maintenance" label={t("pnl.maintenance")}>
            <MoneyInput id="maintenance" name="maintenance" />
          </Field>
          <Field
            id="management_costs"
            label={t("pnl.management_costs")}
            hint={t("pnl.management_costs_help")}
          >
            <MoneyInput id="management_costs" name="management_costs" />
          </Field>
          <Field
            id="vacancy_risk_amount"
            label={t("pnl.vacancy_amount_monthly")}
            hint={t("pnl.vacancy_amount_help")}
          >
            <MoneyInput id="vacancy_risk_amount" name="vacancy_risk_amount" />
          </Field>
          <Field id="annuity_override" label={t("pnl.annuity_override")}>
            <MoneyInput id="annuity_override" name="annuity_override" />
          </Field>
          <Field id="interest_override" label={t("pnl.interest_override")}>
            <MoneyInput id="interest_override" name="interest_override" />
          </Field>
          <Field id="principal_override" label={t("pnl.principal_override")}>
            <MoneyInput id="principal_override" name="principal_override" />
          </Field>
        </div>

        {showMismatch && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {t("pnl.hausgeld_sum_invalid")}
          </p>
        )}
      </div>

      <FormError raw={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("common.create")}
      </button>
    </form>
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
