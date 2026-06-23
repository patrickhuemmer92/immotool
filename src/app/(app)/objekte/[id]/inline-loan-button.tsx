"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/modal";
import { createLoanInline } from "./darlehen/loan-actions";

type Props = {
  propertyId: string;
  /** Falls die Property ein Übergabe-Datum hat — vorbelegt als
   *  disbursement_date / first_payment_date, weil das in 95 % der
   *  Fälle stimmt. */
  defaultDate?: string | null;
};

/**
 * Trigger-Button + Modal für "+ Darlehen" auf der Property-Detail-Seite.
 *
 * Spart das Hopping über /objekte/<id>/darlehen/neu. Nach dem Anlegen
 * bleibt der User auf der Property-Seite (Refresh holt die neuen Daten),
 * statt auf die Loan-Detail-Seite weitergeleitet zu werden.
 */
export function InlineLoanButton({ propertyId, defaultDate }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const result = await createLoanInline(propertyId, undefined, fd);
      if (!result || "error" in result) {
        setError(result?.error ?? "unknown_error");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        + {t("loans.add_loan")}
      </button>

      <Modal open={open} onClose={pending ? () => {} : () => setOpen(false)} size="lg">
        <ModalHeader
          title={t("loans.inline_create_title")}
          subtitle={t("loans.inline_create_subtitle")}
          onClose={pending ? undefined : () => setOpen(false)}
        />
        <form action={onSubmit}>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field id="il-designation" label={t("loans.designation")} required>
                <input
                  id="il-designation"
                  name="designation"
                  type="text"
                  required
                  defaultValue={t("loans.default_designation")}
                  className={inputClass}
                />
              </Field>
              <Field id="il-bank" label={t("loans.bank")}>
                <input
                  id="il-bank"
                  name="bank"
                  type="text"
                  className={inputClass}
                />
              </Field>
              <Field id="il-amount" label={t("loans.loan_amount")} required>
                <input
                  id="il-amount"
                  name="loan_amount"
                  type="text"
                  inputMode="decimal"
                  required
                  className={inputClass}
                />
              </Field>
              <Field id="il-loan_number" label={t("loans.loan_number")}>
                <input
                  id="il-loan_number"
                  name="loan_number"
                  type="text"
                  className={inputClass}
                />
              </Field>
              <Field
                id="il-interest"
                label={t("loans.interest_rate_pa")}
                required
              >
                <input
                  id="il-interest"
                  name="interest_rate_pa"
                  type="text"
                  inputMode="decimal"
                  placeholder="3,5"
                  required
                  className={inputClass}
                />
              </Field>
              <Field
                id="il-amort"
                label={t("loans.amortization_pa")}
                required
              >
                <input
                  id="il-amort"
                  name="amortization_pa"
                  type="text"
                  inputMode="decimal"
                  placeholder="2"
                  required
                  className={inputClass}
                />
              </Field>
              <Field
                id="il-disburse"
                label={t("loans.disbursement_date")}
                required
              >
                <input
                  id="il-disburse"
                  name="disbursement_date"
                  type="date"
                  defaultValue={defaultDate ?? undefined}
                  required
                  className={inputClass}
                />
              </Field>
              <Field
                id="il-first-payment"
                label={t("loans.first_payment_date")}
                required
              >
                <input
                  id="il-first-payment"
                  name="first_payment_date"
                  type="date"
                  defaultValue={defaultDate ?? undefined}
                  required
                  className={inputClass}
                />
              </Field>
              <Field id="il-lock" label={t("loans.rate_lock_until")}>
                <input
                  id="il-lock"
                  name="rate_lock_until"
                  type="date"
                  className={inputClass}
                />
              </Field>
              <Field id="il-maturity" label={t("loans.maturity_date")}>
                <input
                  id="il-maturity"
                  name="maturity_date"
                  type="date"
                  className={inputClass}
                />
              </Field>
            </div>

            <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
              {t("loans.inline_create_hint")}
            </p>

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </ModalBody>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.loading") : t("common.create")}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

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
