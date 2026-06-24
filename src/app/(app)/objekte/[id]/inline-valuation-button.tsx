"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/modal";
import { createValuation } from "./bewertung/actions";

/**
 * "+ Bewertung" auf der Property-Detail-Seite. Mini-Form, danach
 * landet der User wieder auf der Property-Seite (refresh).
 *
 * Pflicht: nur valuation_date — alles andere optional. Wir nehmen
 * income_weight default 0.5; "Reine Sachwert"-/"Reine Ertrags"-Optik
 * lebt in der vollen Bewertung-Seite mit Preset-Buttons.
 */
export function InlineValuationButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const result = await createValuation(propertyId, undefined, fd);
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
        + {t("valuation.title")}
      </button>

      <Modal open={open} onClose={pending ? () => {} : () => setOpen(false)}>
        <ModalHeader
          title={t("valuation.inline_create_title")}
          subtitle={t("valuation.inline_create_subtitle")}
          onClose={pending ? undefined : () => setOpen(false)}
        />
        <form action={onSubmit}>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field id="iv-date" label={t("valuation.valuation_date")} required>
                <input
                  id="iv-date"
                  name="valuation_date"
                  type="date"
                  defaultValue={today}
                  required
                  className={inputClass}
                />
              </Field>
              <Field id="iv-cond" label={t("valuation.condition_score")}>
                <input
                  id="iv-cond"
                  name="condition_score"
                  type="number"
                  min={1}
                  max={10}
                  className={inputClass}
                />
              </Field>
              <Field
                id="iv-market"
                label={t("valuation.market_rent_per_sqm")}
              >
                <input
                  id="iv-market"
                  name="market_rent_per_sqm"
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                />
              </Field>
              <Field id="iv-mult" label={t("valuation.multiple")}>
                <input
                  id="iv-mult"
                  name="multiple"
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                />
              </Field>
              <Field id="iv-build" label={t("valuation.building_value")}>
                <input
                  id="iv-build"
                  name="building_value"
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                />
              </Field>
              <Field id="iv-weight" label={t("valuation.income_weight_short")}>
                <select
                  id="iv-weight"
                  name="income_weight"
                  defaultValue="0.5"
                  className={inputClass}
                >
                  <option value="1">{t("valuation.weight_only_income")}</option>
                  <option value="0.6">{t("valuation.weight_more_income")}</option>
                  <option value="0.5">{t("valuation.weight_equal")}</option>
                  <option value="0.4">{t("valuation.weight_more_sachwert")}</option>
                  <option value="0">{t("valuation.weight_only_sachwert")}</option>
                </select>
              </Field>
            </div>

            <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
              {t("valuation.inline_create_hint")}
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
