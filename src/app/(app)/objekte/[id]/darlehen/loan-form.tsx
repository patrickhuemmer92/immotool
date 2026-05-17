"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import {
  createLoan,
  updateLoan,
  type LoanFormState,
} from "./loan-actions";

export type LoanDefaults = {
  designation: string;
  bank: string;
  loan_number: string;
  disbursement_date: string;
  loan_amount: string;
  interest_rate_pa: string;
  amortization_pa: string;
  first_payment_date: string;
  rate_lock_until: string;
  maturity_date: string;
  interest_share_first_rate: string;
  notes: string;
};

export const EMPTY_LOAN_DEFAULTS: LoanDefaults = {
  designation: "",
  bank: "",
  loan_number: "",
  disbursement_date: "",
  loan_amount: "",
  interest_rate_pa: "",
  amortization_pa: "",
  first_payment_date: "",
  rate_lock_until: "",
  maturity_date: "",
  interest_share_first_rate: "",
  notes: "",
};

export function LoanForm({
  propertyId,
  defaults,
  loanId,
  readOnly,
}: {
  propertyId: string;
  defaults: LoanDefaults;
  loanId?: string;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const action = loanId
    ? updateLoan.bind(null, loanId, propertyId)
    : createLoan.bind(null, propertyId);
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      <fieldset disabled={readOnly} className="space-y-6">
        <Grid>
          <Field id="designation" label={t("loans.designation")} required>
            <input
              id="designation"
              name="designation"
              type="text"
              defaultValue={defaults.designation}
              required
              className={inputClass}
            />
          </Field>
          <Field id="bank" label={t("loans.bank")}>
            <input
              id="bank"
              name="bank"
              type="text"
              defaultValue={defaults.bank}
              className={inputClass}
            />
          </Field>
          <Field id="loan_number" label={t("loans.loan_number")}>
            <input
              id="loan_number"
              name="loan_number"
              type="text"
              defaultValue={defaults.loan_number}
              className={inputClass}
            />
          </Field>
          <Field id="loan_amount" label={t("loans.loan_amount")} required>
            <input
              id="loan_amount"
              name="loan_amount"
              type="text"
              inputMode="decimal"
              defaultValue={defaults.loan_amount}
              required
              className={inputClass}
            />
          </Field>
          <Field id="interest_rate_pa" label={t("loans.interest_rate_pa")} required>
            <input
              id="interest_rate_pa"
              name="interest_rate_pa"
              type="text"
              inputMode="decimal"
              defaultValue={defaults.interest_rate_pa}
              required
              className={inputClass}
            />
          </Field>
          <Field id="amortization_pa" label={t("loans.amortization_pa")} required>
            <input
              id="amortization_pa"
              name="amortization_pa"
              type="text"
              inputMode="decimal"
              defaultValue={defaults.amortization_pa}
              required
              className={inputClass}
            />
          </Field>
          <Field id="disbursement_date" label={t("loans.disbursement_date")} required>
            <input
              id="disbursement_date"
              name="disbursement_date"
              type="date"
              defaultValue={defaults.disbursement_date}
              required
              className={inputClass}
            />
          </Field>
          <Field
            id="first_payment_date"
            label={t("loans.first_payment_date")}
            required
          >
            <input
              id="first_payment_date"
              name="first_payment_date"
              type="date"
              defaultValue={defaults.first_payment_date}
              required
              className={inputClass}
            />
          </Field>
          <Field id="rate_lock_until" label={t("loans.rate_lock_until")}>
            <input
              id="rate_lock_until"
              name="rate_lock_until"
              type="date"
              defaultValue={defaults.rate_lock_until}
              className={inputClass}
            />
          </Field>
          <Field id="maturity_date" label={t("loans.maturity_date")}>
            <input
              id="maturity_date"
              name="maturity_date"
              type="date"
              defaultValue={defaults.maturity_date}
              className={inputClass}
            />
          </Field>
          <Field
            id="interest_share_first_rate"
            label={t("loans.interest_share_first_rate")}
          >
            <input
              id="interest_share_first_rate"
              name="interest_share_first_rate"
              type="text"
              inputMode="decimal"
              defaultValue={defaults.interest_share_first_rate}
              className={inputClass}
            />
          </Field>
        </Grid>

        <Field id="notes" label={t("properties.notes")}>
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
            {pending
              ? t("common.loading")
              : loanId
                ? t("common.save")
                : t("common.create")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100";

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

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
