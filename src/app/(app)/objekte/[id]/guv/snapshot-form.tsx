"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
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
            <input id="cold_rent" name="cold_rent" {...numProps} />
          </Field>
          <Field id="ancillary_costs" label={t("pnl.ancillary_costs")}>
            <input id="ancillary_costs" name="ancillary_costs" {...numProps} />
          </Field>
          <Field
            id="property_fee_recoverable"
            label={t("pnl.property_fee_recoverable")}
          >
            <input
              id="property_fee_recoverable"
              name="property_fee_recoverable"
              {...numProps}
            />
          </Field>
          <Field
            id="property_fee_not_recoverable"
            label={t("pnl.property_fee_not_recoverable")}
          >
            <input
              id="property_fee_not_recoverable"
              name="property_fee_not_recoverable"
              {...numProps}
            />
          </Field>
          <Field id="maintenance" label={t("pnl.maintenance")}>
            <input id="maintenance" name="maintenance" {...numProps} />
          </Field>
          <Field id="annuity_override" label={t("pnl.annuity_override")}>
            <input
              id="annuity_override"
              name="annuity_override"
              {...numProps}
            />
          </Field>
          <Field id="interest_override" label={t("pnl.interest_override")}>
            <input
              id="interest_override"
              name="interest_override"
              {...numProps}
            />
          </Field>
          <Field id="principal_override" label={t("pnl.principal_override")}>
            <input
              id="principal_override"
              name="principal_override"
              {...numProps}
            />
          </Field>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("common.create")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";
const numProps = {
  type: "text" as const,
  inputMode: "decimal" as const,
  className: inputClass,
};

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
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
    </div>
  );
}
