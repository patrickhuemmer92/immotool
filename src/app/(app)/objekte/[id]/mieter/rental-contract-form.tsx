"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import {
  createRentalContract,
  updateRentalContract,
  type RentalContractFormState,
} from "./rental-contract-actions";

export type RentalContractDefaults = {
  tenant_name: string;
  contract_start: string;
  is_fixed_term: boolean;
  contract_end: string;
  cold_rent_per_month: string;
  notes: string;
};

export const EMPTY_RENTAL_CONTRACT_DEFAULTS: RentalContractDefaults = {
  tenant_name: "",
  contract_start: "",
  is_fixed_term: false,
  contract_end: "",
  cold_rent_per_month: "",
  notes: "",
};

export function RentalContractForm({
  propertyId,
  contractId,
  defaults,
  readOnly,
  onCancel,
}: {
  propertyId: string;
  contractId?: string;
  defaults: RentalContractDefaults;
  readOnly: boolean;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const action = contractId
    ? updateRentalContract.bind(null, contractId, propertyId)
    : createRentalContract.bind(null, propertyId);
  const [state, formAction, pending] = useActionState<
    RentalContractFormState,
    FormData
  >(action, undefined);
  const [isFixedTerm, setIsFixedTerm] = useState<boolean>(defaults.is_fixed_term);

  return (
    <form action={formAction} className="space-y-4 max-w-3xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="tenant_name" label={t("tenants.name")} required>
            <input
              id="tenant_name"
              name="tenant_name"
              type="text"
              defaultValue={defaults.tenant_name}
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
          <Field
            id="contract_start"
            label={t("tenants.contract_start")}
            required
          >
            <input
              id="contract_start"
              name="contract_start"
              type="date"
              defaultValue={defaults.contract_start}
              required
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
            rows={2}
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
            {pending
              ? t("common.loading")
              : contractId
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
