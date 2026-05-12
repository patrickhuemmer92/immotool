"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { decimalToPercentInput } from "@/lib/format";
import { FormError } from "@/components/form-error";
import { updateSettings, type FormState } from "./actions";

export function SettingsForm({
  defaults,
  readOnly,
}: {
  defaults: {
    tax_rate: number;
    default_depreciation_rate: number;
    default_locale: "de" | "en";
    default_currency: string;
  };
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateSettings,
    undefined
  );

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={readOnly} className="space-y-6">
        <Field
          id="tax_rate"
          label={t("settings.tax_rate")}
          help={t("settings.tax_rate_help")}
        >
          <input
            id="tax_rate"
            name="tax_rate"
            type="text"
            inputMode="decimal"
            defaultValue={decimalToPercentInput(defaults.tax_rate)}
            required
            className={inputClass}
          />
        </Field>

        <Field
          id="default_depreciation_rate"
          label={t("settings.default_depreciation_rate")}
          help={t("settings.default_depreciation_help")}
        >
          <input
            id="default_depreciation_rate"
            name="default_depreciation_rate"
            type="text"
            inputMode="decimal"
            defaultValue={decimalToPercentInput(
              defaults.default_depreciation_rate
            )}
            required
            className={inputClass}
          />
        </Field>

        <Field id="default_locale" label={t("settings.default_locale")}>
          <select
            id="default_locale"
            name="default_locale"
            defaultValue={defaults.default_locale}
            className={inputClass}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </Field>

        <Field id="default_currency" label={t("settings.default_currency")}>
          <input
            id="default_currency"
            name="default_currency"
            type="text"
            maxLength={3}
            defaultValue={defaults.default_currency}
            required
            className={inputClass}
          />
        </Field>

        <FormError raw={state?.error} />
        {state?.success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {t("common.saved")}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("common.loading") : t("common.save")}
        </button>
      </fieldset>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100";

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
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {help}
        </p>
      )}
    </div>
  );
}
