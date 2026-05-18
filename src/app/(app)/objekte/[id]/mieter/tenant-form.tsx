"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { upsertTenant, type TenantFormState } from "./actions";

export type TenantDefaults = {
  name: string;
  contract_start: string;
  is_fixed_term: boolean;
  contract_end: string;
  cold_rent_per_month: string;
  notes: string;
};

export const EMPTY_TENANT_DEFAULTS: TenantDefaults = {
  name: "",
  contract_start: "",
  is_fixed_term: false,
  contract_end: "",
  cold_rent_per_month: "",
  notes: "",
};

export function TenantForm({
  propertyId,
  defaults,
  readOnly,
}: {
  propertyId: string;
  defaults: TenantDefaults;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<
    TenantFormState,
    FormData
  >(upsertTenant.bind(null, propertyId), undefined);
  const [isFixedTerm, setIsFixedTerm] = useState<boolean>(defaults.is_fixed_term);

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      <fieldset disabled={readOnly} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="name" label={t("tenants.name")} required>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={defaults.name}
              required
              className={inputClass}
            />
          </Field>
          <Field
            id="cold_rent_per_month"
            label={t("tenants.cold_rent_per_month")}
          >
            <input
              id="cold_rent_per_month"
              name="cold_rent_per_month"
              type="text"
              inputMode="decimal"
              placeholder="z. B. 850"
              defaultValue={defaults.cold_rent_per_month}
              className={inputClass}
            />
          </Field>
          <Field id="contract_start" label={t("tenants.contract_start")}>
            <input
              id="contract_start"
              name="contract_start"
              type="date"
              defaultValue={defaults.contract_start}
              className={inputClass}
            />
          </Field>
          <div>
            <div className="text-sm font-medium block mb-1">
              {t("tenants.term_type")}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsFixedTerm(false)}
                disabled={readOnly}
                className={
                  "rounded-lg px-3 py-1.5 text-sm border " +
                  (!isFixedTerm
                    ? "bg-accent text-accent-foreground border-transparent"
                    : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800")
                }
              >
                {t("tenants.term_open_ended")}
              </button>
              <button
                type="button"
                onClick={() => setIsFixedTerm(true)}
                disabled={readOnly}
                className={
                  "rounded-lg px-3 py-1.5 text-sm border " +
                  (isFixedTerm
                    ? "bg-accent text-accent-foreground border-transparent"
                    : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800")
                }
              >
                {t("tenants.term_fixed")}
              </button>
            </div>
            <input
              type="hidden"
              name="is_fixed_term"
              value={isFixedTerm ? "true" : "false"}
            />
          </div>
          {isFixedTerm && (
            <Field
              id="contract_end"
              label={t("tenants.contract_end")}
              required
            >
              <input
                id="contract_end"
                name="contract_end"
                type="date"
                defaultValue={defaults.contract_end}
                required
                className={inputClass}
              />
            </Field>
          )}
        </div>

        <Field id="notes" label={t("tenants.notes")}>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaults.notes}
            className={inputClass}
          />
        </Field>

        <FormError raw={state?.error} />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100";

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
