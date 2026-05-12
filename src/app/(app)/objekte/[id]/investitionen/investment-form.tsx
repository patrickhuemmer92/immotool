"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { createInvestment, type InvestmentState } from "./actions";

const TYPES = [
  "fixed_individual",
  "optional_individual",
  "fixed_common_reserve",
  "fixed_common_levy",
  "optional_common_reserve",
  "optional_common_levy",
] as const;

export function InvestmentForm({ propertyId }: { propertyId: string }) {
  const t = useTranslations();
  const [longTerm, setLongTerm] = useState(false);
  const [state, formAction, pending] = useActionState<InvestmentState, FormData>(
    createInvestment.bind(null, propertyId),
    undefined
  );

  const yearOptions = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = thisYear - 5; y <= thisYear + 30; y++) arr.push(y);
    return arr;
  }, []);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("investments.year")}
          </label>
          <select
            name="year"
            disabled={longTerm}
            required={!longTerm}
            defaultValue={String(new Date().getFullYear())}
            className={`${inputClass} ${longTerm ? "opacity-50" : ""}`}
          >
            <option value="">—</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 mt-6 text-sm">
          <input
            name="is_long_term"
            type="checkbox"
            checked={longTerm}
            onChange={(e) => setLongTerm(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          {t("investments.long_term")}
        </label>
        <div>
          <label className="text-xs font-medium block mb-1">
            {t("investments.amount")}
          </label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="z. B. 1.500,00"
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          {t("investments.measure_type")}
        </label>
        <select name="measure_type" required className={inputClass}>
          {TYPES.map((m) => (
            <option key={m} value={m}>
              {t(`investments.type_${m}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          {t("investments.description")}
        </label>
        <input name="description" type="text" className={inputClass} />
      </div>

      <FormError raw={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("investments.new")}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm";
