"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { createValuation, type ValuationState } from "./actions";

export function ValuationForm({ propertyId }: { propertyId: string }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<ValuationState, FormData>(
    createValuation.bind(null, propertyId),
    undefined
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field id="valuation_date" label={t("valuation.valuation_date")}>
          <input
            id="valuation_date"
            name="valuation_date"
            type="date"
            defaultValue={today}
            required
            className={inputClass}
          />
        </Field>
        <Field
          id="condition_score"
          label={t("valuation.condition_score")}
          help={t("valuation.help_condition")}
        >
          <input
            id="condition_score"
            name="condition_score"
            type="number"
            min={1}
            max={10}
            className={inputClass}
          />
        </Field>
        <Field
          id="market_rent_per_sqm"
          label={t("valuation.market_rent_per_sqm")}
          help={t("valuation.help_market_rent")}
        >
          <input
            id="market_rent_per_sqm"
            name="market_rent_per_sqm"
            type="text"
            inputMode="decimal"
            placeholder="z. B. 9,50"
            className={inputClass}
          />
        </Field>
        <Field
          id="multiple"
          label={t("valuation.multiple")}
          help={t("valuation.help_multiple")}
        >
          <input
            id="multiple"
            name="multiple"
            type="text"
            inputMode="decimal"
            placeholder="z. B. 22"
            className={inputClass}
          />
        </Field>
        <Field
          id="building_value"
          label={t("valuation.building_value")}
          help={t("valuation.help_building_value")}
        >
          <input
            id="building_value"
            name="building_value"
            type="text"
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>

      <FormError raw={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("valuation.new")}
      </button>

      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug pt-2 border-t border-neutral-200 dark:border-neutral-800">
        {t("valuation.source_footnote")}
      </p>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium block mb-1">
        {label}
      </label>
      {children}
      {help && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
          {help}
        </p>
      )}
    </div>
  );
}
