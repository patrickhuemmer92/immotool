"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/modal";
import { createInvestment, type TaxTreatment } from "./investitionen/actions";

const MEASURE_TYPES = [
  "fixed_individual",
  "optional_individual",
  "fixed_common_reserve",
  "fixed_common_levy",
  "optional_common_reserve",
  "optional_common_levy",
] as const;

const TAX_TREATMENTS: TaxTreatment[] = [
  "expense_immediate",
  "expense_82b",
  "capitalized_building",
  "capitalized_separate",
  "non_deductible",
];

/**
 * "+ Investition" auf der Property-Detail-Seite.
 *
 * Investments haben einen relativ komplexen Tax-Treatment-Switch
 * (expense_82b braucht expense_82b_years, capitalized_separate
 * braucht useful_life_years) — den UI-Switch zeigen wir konditional.
 */
export function InlineInvestmentButton({
  propertyId,
}: {
  propertyId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [longTerm, setLongTerm] = useState(false);
  const [taxTreatment, setTaxTreatment] = useState<TaxTreatment>(
    "expense_immediate"
  );
  const thisYear = new Date().getUTCFullYear();

  function onSubmit(fd: FormData) {
    setError(null);
    // Mutually exclusive: year XOR is_long_term. Wenn longTerm gesetzt
    // ist, lösche year aus FormData.
    if (longTerm) {
      fd.delete("year");
      fd.set("is_long_term", "on");
    } else {
      fd.delete("is_long_term");
    }
    start(async () => {
      const result = await createInvestment(propertyId, undefined, fd);
      if (result?.error) {
        setError(result.error);
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
        + {t("investments.title")}
      </button>

      <Modal
        open={open}
        onClose={pending ? () => {} : () => setOpen(false)}
        size="lg"
      >
        <ModalHeader
          title={t("investments.inline_create_title")}
          subtitle={t("investments.inline_create_subtitle")}
          onClose={pending ? undefined : () => setOpen(false)}
        />
        <form action={onSubmit}>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field id="ii-amount" label={t("investments.amount")} required>
                <input
                  id="ii-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  required
                  className={inputClass}
                />
              </Field>
              <Field id="ii-desc" label={t("investments.description")}>
                <input
                  id="ii-desc"
                  name="description"
                  type="text"
                  className={inputClass}
                />
              </Field>

              <Field id="ii-measure" label={t("investments.measure_type")} required>
                <select
                  id="ii-measure"
                  name="measure_type"
                  required
                  defaultValue="fixed_individual"
                  className={inputClass}
                >
                  {MEASURE_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {t(`investments.type_${m}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="ii-tax" label={t("investments.tax_treatment")} required>
                <select
                  id="ii-tax"
                  name="tax_treatment"
                  value={taxTreatment}
                  onChange={(e) =>
                    setTaxTreatment(e.target.value as TaxTreatment)
                  }
                  required
                  className={inputClass}
                >
                  {TAX_TREATMENTS.map((tx) => (
                    <option key={tx} value={tx}>
                      {t(`investments.tax_${tx}`)}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Zeit-Zuordnung: konkretes Jahr ODER langfristig */}
              <Field id="ii-when" label={t("investments.when")}>
                <select
                  id="ii-when"
                  value={longTerm ? "long" : "year"}
                  onChange={(e) => setLongTerm(e.target.value === "long")}
                  className={inputClass}
                >
                  <option value="year">{t("investments.when_year")}</option>
                  <option value="long">{t("investments.when_long_term")}</option>
                </select>
              </Field>
              {!longTerm && (
                <Field id="ii-year" label={t("investments.year")} required>
                  <input
                    id="ii-year"
                    name="year"
                    type="number"
                    min={1900}
                    max={2200}
                    defaultValue={thisYear}
                    required
                    className={inputClass}
                  />
                </Field>
              )}

              {/* Konditional: 82b braucht Jahre 2-5 */}
              {taxTreatment === "expense_82b" && (
                <Field
                  id="ii-82b"
                  label={t("investments.expense_82b_years")}
                  required
                >
                  <input
                    id="ii-82b"
                    name="expense_82b_years"
                    type="number"
                    min={2}
                    max={5}
                    defaultValue={5}
                    required
                    className={inputClass}
                  />
                </Field>
              )}

              {/* Konditional: capitalized_separate braucht Nutzungsdauer */}
              {taxTreatment === "capitalized_separate" && (
                <Field
                  id="ii-life"
                  label={t("investments.useful_life_years")}
                  required
                >
                  <input
                    id="ii-life"
                    name="useful_life_years"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={10}
                    required
                    className={inputClass}
                  />
                </Field>
              )}
            </div>

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
