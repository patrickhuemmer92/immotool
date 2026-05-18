"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { decimalToPercentInput } from "@/lib/format";
import { FormError } from "@/components/form-error";
import { TENANT_SCORE_FIELDS } from "@/lib/calculations/tenant";
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
    cashflow_convention: "net" | "gross";
    default_vacancy_residential: number;
    default_vacancy_commercial: number;
    default_management_per_unit: number;
    bank_maintenance_per_sqm: number;
    tenant_score_weights: Record<string, number>;
  };
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateSettings,
    undefined
  );

  return (
    <form action={action} className="space-y-8">
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
      </fieldset>

      <fieldset disabled={readOnly} className="space-y-4 border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t("settings.cashflow_section")}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t("settings.cashflow_convention_help")}
          </p>
        </div>

        <Field id="cashflow_convention" label={t("pnl.convention_label")}>
          <select
            id="cashflow_convention"
            name="cashflow_convention"
            defaultValue={defaults.cashflow_convention}
            className={inputClass}
          >
            <option value="net">{t("pnl.convention_net")}</option>
            <option value="gross">{t("pnl.convention_gross")}</option>
          </select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            id="default_vacancy_residential"
            label={t("settings.default_vacancy_residential")}
            help={t("settings.default_vacancy_residential_help")}
          >
            <input
              id="default_vacancy_residential"
              name="default_vacancy_residential"
              type="text"
              inputMode="decimal"
              defaultValue={decimalToPercentInput(defaults.default_vacancy_residential)}
              required
              className={inputClass}
            />
          </Field>
          <Field
            id="default_vacancy_commercial"
            label={t("settings.default_vacancy_commercial")}
            help={t("settings.default_vacancy_commercial_help")}
          >
            <input
              id="default_vacancy_commercial"
              name="default_vacancy_commercial"
              type="text"
              inputMode="decimal"
              defaultValue={decimalToPercentInput(defaults.default_vacancy_commercial)}
              required
              className={inputClass}
            />
          </Field>
          <Field
            id="default_management_per_unit"
            label={t("settings.default_management_per_unit")}
            help={t("settings.default_management_help")}
          >
            <input
              id="default_management_per_unit"
              name="default_management_per_unit"
              type="text"
              inputMode="decimal"
              defaultValue={defaults.default_management_per_unit.toString().replace(".", ",")}
              className={inputClass}
            />
          </Field>
          <Field
            id="bank_maintenance_per_sqm"
            label={t("settings.bank_maintenance_per_sqm")}
            help={t("settings.bank_maintenance_help")}
          >
            <input
              id="bank_maintenance_per_sqm"
              name="bank_maintenance_per_sqm"
              type="text"
              inputMode="decimal"
              defaultValue={defaults.bank_maintenance_per_sqm.toString().replace(".", ",")}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset disabled={readOnly} className="space-y-4 border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t("settings.tenant_score_section")}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t("settings.tenant_score_help")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TENANT_SCORE_FIELDS.map((f) => (
            <Field
              key={f}
              id={`weight_${f}`}
              label={t(`tenants.factor_${f}`)}
            >
              <input
                id={`weight_${f}`}
                name={`weight_${f}`}
                type="text"
                inputMode="decimal"
                defaultValue={(defaults.tenant_score_weights[f] ?? 1).toString().replace(".", ",")}
                required
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </fieldset>

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
